import { getSiteUrl } from "@/lib/server/env";

/**
 * The embeddable widget loader, served at `/widget.js`.
 *
 * A customer drops one <script> tag with `data-chatbot` and `data-token`. This
 * builds the launcher and panel inside a **Shadow DOM**, so the host page's CSS
 * can never leak in or out, and streams answers from the chat gateway over SSE.
 * It holds only the public token (chat-only); every request is re-authorised
 * server-side against the bot's domain allowlist.
 *
 * Embed API:
 *
 *   <script src="https://…/widget.js"
 *           data-chatbot="…" data-token="…"
 *           data-mode="bubble|popup|fullscreen|embedded"
 *           data-container="#chat-host"
 *           data-label="Chat with us"></script>
 *
 * - `data-mode` overrides the bot's configured display mode for this page only.
 * - `data-container` is a CSS selector for embedded mode's host element. Without
 *   it the script's parent element is used; that element must have a height.
 * - `data-label` overrides the launcher's accessible name.
 *
 * Versioning: appearance is a growing contract. The server normalizes every
 * stored document to the current shape, new fields are additive, and the widget
 * ignores unknown fields — so an embed cached from an older deploy keeps working
 * while a newer config is served. `window.BitecodesChat.version` and
 * `window.BitecodesChat.widgets[chatbotId]` expose the runtime for diagnostics
 * and for opening a closed popup/fullscreen programmatically.
 */
export const dynamic = "force-static";

/** Bump when the emitted script changes in a way worth identifying in the wild. */
const WIDGET_VERSION = "2.0.0";

export function GET() {
  const origin = getSiteUrl();

  const js = `(function () {
  "use strict";
  var current = document.currentScript;
  if (!current) return;
  var chatbotId = current.getAttribute("data-chatbot");
  var token = current.getAttribute("data-token");
  var requestedMode = current.getAttribute("data-mode");
  var containerSelector = current.getAttribute("data-container");
  var labelOverride = current.getAttribute("data-label");
  var WIDGET_VERSION = ${JSON.stringify(WIDGET_VERSION)};

  // The host this script was actually loaded from, NOT a baked-in constant.
  //
  // A CORS preflight may not follow a redirect — browsers fail the request
  // outright rather than re-issuing OPTIONS at the new location. So when the
  // configured site URL was the apex, which 308s to www, every embedded widget
  // died on preflight with "Redirect is not allowed for a preflight request",
  // while curl (which follows redirects) worked fine and hid the bug.
  //
  // Deriving the origin from the script's own src means the API is always on
  // exactly the host that just successfully served this file, so the redirect
  // can never be introduced by a mismatch between the two.
  var origin = ${JSON.stringify(origin)};
  try {
    origin = new URL(current.src, document.baseURI).origin;
  } catch (e) {
    /* Keep the server-rendered default. */
  }

  if (!chatbotId || !token) {
    console.error("[bitecodes-chat] data-chatbot and data-token are required");
    return;
  }

  var MODES = ["bubble", "popup", "fullscreen", "embedded"];
  function oneOf(value, allowed) {
    return allowed.indexOf(value) === -1 ? null : value;
  }
  var modeOverride = oneOf(requestedMode, MODES);

  /**
   * Why a request failed, in words a developer can act on.
   *
   * The gateway sends a precise refusal — ORIGIN_NOT_ALLOWED with instructions —
   * but when it refuses an origin it also sends no Access-Control-Allow-Origin,
   * so the browser hides the whole response from this script. All the widget can
   * observe is that fetch rejected. That is why every configuration mistake used
   * to surface to a visitor as "the assistant is unreachable right now", which
   * tells the site owner nothing and cost real debugging time.
   *
   * So the cause is inferred from what IS observable, and written to the console
   * where whoever installed the snippet will look.
   */
  function explainFailure() {
    if (location.protocol === "file:") {
      return (
        "This page was opened directly from disk (file://), which sends no " +
        "Origin header, so the assistant cannot verify which site is asking. " +
        "Serve the page over http instead - for example: python3 -m http.server 8080 " +
        "- then open http://localhost:8080/. Localhost is always allowed."
      );
    }
    return (
      "The request was blocked before a reply could be read, which almost " +
      "always means this site is not on the assistant's allowed domains. Add " +
      location.hostname + " in the Bitecodes dashboard under the chatbot's " +
      "settings. Loopback addresses such as localhost are always allowed."
    );
  }

  function reportFailure() {
    var why = explainFailure();
    console.error("[bitecodes-chat] " + why);
    return why;
  }

  // Appearance defaults. The config endpoint overrides these per bot; if it is
  // unreachable the widget still renders with these, because a visitor seeing a
  // slightly off-brand assistant is far better than seeing none.
  var look = {
    theme: "auto",
    emoji: "💬",
    primaryColor: "#4f46e5",
    secondaryColor: "#0ea5e9",
    position: "bottom-right",
    size: "regular",
    displayMode: "bubble",
    suggestedQuestions: [],
    starterPrompts: [],
    welcomeMessage: "Hi! How can I help you today?",
    placeholder: "Ask a question…",
    title: "Chat with us",
    branding: true,
    typingAnimation: true,
    avatar: null,
    logo: null,
    launcherLabel: "Open chat"
  };

  var SIZES = {
    compact: { bubble: 48, w: 320, h: 440, font: 13 },
    regular: { bubble: 56, w: 360, h: 520, font: 14 },
    large:   { bubble: 64, w: 420, h: 620, font: 15 }
  };

  // Only a hex colour reaches the stylesheet. The server validates this too, but
  // this is the sink: an arbitrary string interpolated into CSS is an injection
  // point, and the widget runs on somebody else's page.
  function safeColor(c, fallback) {
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c || "")) ? c : fallback;
  }

  // Only an image URL may become an img src. This runs on a customer's page and
  // the value is whatever an operator typed into the dashboard.
  function imageOk(u) {
    return !!u && /^(https?:|data:image[/])/i.test(u);
  }

  function css() {
    var dim = SIZES[look.size] || SIZES.regular;
    var accent = safeColor(look.primaryColor, "#4f46e5");
    var secondary = safeColor(look.secondaryColor, accent);
    var dark =
      look.theme === "dark" ||
      (look.theme === "auto" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    var side = look.position === "bottom-left" ? "left" : "right";

    var panelBg = dark ? "#15151b" : "#fff";
    var panelFg = dark ? "#eee" : "#111";
    var botBg = dark ? "#26262e" : "#f1f1f4";
    var line = dark ? "#26262e" : "#eee";
    var inputBg = dark ? "#0f0f14" : "#fff";
    var inputBorder = dark ? "#33333d" : "#ddd";

    return [
      ":host{all:initial}",
      "*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
      ".bubble{width:" + dim.bubble + "px;height:" + dim.bubble + "px;border-radius:50%;border:0;cursor:pointer;",
      "background:linear-gradient(135deg," + accent + "," + secondary + ");color:#fff;font-size:" + Math.round(dim.bubble * 0.43) + "px;",
      "box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}",
      ".bubble:focus-visible{outline:3px solid " + accent + ";outline-offset:3px}",
      ".panel{position:absolute;bottom:" + (dim.bubble + 14) + "px;" + side + ":0;width:" + dim.w + "px;",
      "max-width:calc(100vw - 40px);height:" + dim.h + "px;",
      "max-height:calc(100vh - 120px);max-height:calc(100dvh - 120px);",
      "background:" + panelBg + ";color:" + panelFg + ";border-radius:16px;",
      "box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;z-index:1}",
      ".panel.open{display:flex}",
      ".panel.popup{position:fixed;inset:auto;top:50%;left:50%;bottom:auto;right:auto;",
      "transform:translate(-50%,-50%);width:" + dim.w + "px;height:" + dim.h + "px;",
      "max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}",
      ".panel.fullscreen{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;",
      "max-width:none;max-height:none;border-radius:0}",
      ".panel.embedded{position:relative;inset:auto;width:100%;height:100%;min-height:420px;",
      "max-width:none;max-height:none;border-radius:0}",
      ".backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;z-index:0}",
      ".backdrop.open{display:block}",
      ".hd{padding:14px 16px;background:" + accent + ";color:#fff;font-weight:600;",
      "display:flex;align-items:center;gap:9px;position:relative}",
      ".panel.fullscreen .hd{padding-top:max(14px, env(safe-area-inset-top))}",
      ".hdlogo{display:flex;flex:0 0 auto}",
      ".hd img{width:20px;height:20px;border-radius:4px;object-fit:contain}",
      ".hdtitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".close{border:0;background:transparent;color:inherit;font-size:22px;line-height:1;",
      "padding:2px 5px;cursor:pointer;border-radius:8px;flex:0 0 auto}",
      ".close:hover{background:rgba(255,255,255,.16)}",
      ".close:focus-visible{outline:2px solid #fff;outline-offset:1px}",
      ".log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
      ".msg{padding:9px 12px;border-radius:12px;max-width:85%;font-size:" + dim.font + "px;",
      "line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}",
      ".user{align-self:flex-end;background:" + accent + ";color:#fff}",
      ".bot{align-self:flex-start;background:" + botBg + ";color:" + panelFg + "}",
      ".row{display:flex;align-items:flex-end;gap:7px;max-width:100%}",
      ".row img{width:24px;height:24px;border-radius:50%;object-fit:cover;flex:0 0 auto}",
      ".dots span{display:inline-block;width:5px;height:5px;margin:0 1px;border-radius:50%;",
      "background:currentColor;opacity:.45;animation:bcbounce 1.2s infinite}",
      ".dots span:nth-child(2){animation-delay:.15s}.dots span:nth-child(3){animation-delay:.3s}",
      "@keyframes bcbounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}",
      ".suggestions{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}",
      ".suggestions button{border:1px solid " + accent + ";background:transparent;color:" + panelFg + ";",
      "border-radius:999px;padding:6px 10px;font-size:" + Math.max(11, dim.font - 2) + "px;line-height:1.3;",
      "cursor:pointer;text-align:left;max-width:100%;overflow-wrap:anywhere}",
      ".suggestions button:hover{background:" + botBg + "}",
      ".suggestions button:focus-visible{outline:2px solid " + accent + ";outline-offset:1px}",
      ".ft{display:flex;gap:8px;padding:12px;border-top:1px solid " + line + "}",
      ".panel.fullscreen .ft{padding-bottom:max(12px, env(safe-area-inset-bottom))}",
      ".ft input{flex:1;padding:9px 12px;border:1px solid " + inputBorder + ";border-radius:10px;",
      "font-size:" + dim.font + "px;background:" + inputBg + ";color:" + panelFg + "}",
      ".ft input:focus-visible{border-color:" + accent + ";outline:2px solid " + accent + ";outline-offset:0}",
      ".ft button{border:0;background:" + accent + ";color:#fff;border-radius:10px;padding:0 14px;cursor:pointer}",
      ".ft button:focus-visible{outline:2px solid " + panelFg + ";outline-offset:1px}",
      ".brand{padding:0 12px 10px;font-size:11px;opacity:.55;text-align:center}",
      ".brand a{color:inherit}",
      "@media (prefers-reduced-motion: reduce){.dots span{animation:none}}"
    ].join("");
  }

  var host;
  var root;
  var style;
  var panel;
  var backdrop;
  var bubble;
  var log;
  var input;
  var sendBtn;
  var closeBtn;
  var titleEl;
  var mounted = false;
  var mode = modeOverride || look.displayMode;
  var openState = false;
  var greeted = false;
  var conversationId = null;
  var lastFocused = null;
  // Prior turns, so a follow-up like "and how long does that take?" makes
  // sense. Only the recent tail is sent; the server trims it again and the
  // prompt budget is bounded there, not trusted from here.
  var history = [];

  /** The element embedded mode mounts into, or where the script itself sits. */
  function resolveContainer() {
    if (containerSelector) {
      try {
        var found = document.querySelector(containerSelector);
        if (found) return found;
        console.warn(
          "[bitecodes-chat] data-container matched nothing: " + containerSelector,
        );
      } catch (e) {
        console.warn("[bitecodes-chat] data-container is not a valid selector: " + containerSelector);
      }
    }
    var parent = current.parentElement;
    return parent && parent !== document.head ? parent : document.body;
  }

  function renderOpenState() {
    if (!panel) return;
    panel.classList.toggle("open", openState);
    backdrop.classList.toggle("open", mode === "popup" && openState);
    bubble.style.display = mode === "bubble" ? "flex" : "none";
    bubble.setAttribute("aria-expanded", openState ? "true" : "false");
  }

  function applyLook() {
    style.textContent = css();
    host.style.cssText =
      mode === "embedded"
        ? "display:block;width:100%;height:100%;"
        : "position:fixed;z-index:2147483000;bottom:20px;" +
          (look.position === "bottom-left" ? "left:20px;" : "right:20px;");

    panel.className = "panel " + mode;
    panel.setAttribute("role", "dialog");
    if (mode === "popup" || mode === "fullscreen") {
      panel.setAttribute("aria-modal", "true");
    } else {
      panel.removeAttribute("aria-modal");
    }
    renderOpenState();

    if (closeBtn) closeBtn.style.display = mode === "embedded" ? "none" : "";
    titleEl.textContent = look.title || "Chat with us";
    bubble.textContent = look.emoji || "\\uD83D\\uDCAC";
    bubble.setAttribute("aria-label", look.launcherLabel || "Open chat");
    bubble.setAttribute("title", look.launcherLabel || "Open chat");
    bubble.setAttribute("aria-expanded", openState ? "true" : "false");

    var slot = panel.querySelector(".hdlogo");
    if (slot) {
      slot.innerHTML = "";
      // Only http(s) and data:image are rendered. The value is a URL an operator
      // typed, and this ends up as an <img> on a customer's page.
      // No slash escape in this regex: the whole script is a template literal, so
      // a backslash-slash here would be resolved before the browser ever sees it,
      // emitting a bare slash that closes the regex early. A character class
      // avoids needing the escape at all.
      if (look.logo && imageOk(look.logo)) {
        var im = document.createElement("img");
        im.src = look.logo;
        im.alt = "";
        slot.appendChild(im);
      }
    }

    if (input) input.placeholder = look.placeholder || "Ask a question…";

    var brand = panel.querySelector(".brand");
    if (look.branding && !brand) {
      brand = document.createElement("div");
      brand.className = "brand";
      brand.innerHTML =
        'Powered by <a href="' + origin + '/ai-chatbot" target="_blank" rel="noopener">Bitecodes</a>';
      var footer = panel.querySelector(".ft");
      if (footer) panel.insertBefore(brand, footer);
      else panel.appendChild(brand);
    } else if (!look.branding && brand) {
      brand.remove();
    }

    if (mode === "embedded") {
      var target = resolveContainer();
      if (target && host.parentNode !== target) target.appendChild(host);
    }
  }

  function focusInput() {
    try {
      input.focus();
    } catch (e) {
      /* A hidden or detached input cannot take focus; the panel is still usable. */
    }
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    addMsg("bot", look.welcomeMessage);
    // Starter prompts are the initial suggestions. Falling back to
    // suggestedQuestions keeps bots configured before starterPrompts existed
    // looking exactly as they did.
    addPrompts(
      look.starterPrompts.length ? look.starterPrompts : look.suggestedQuestions,
    );
  }

  function giveFocusOnOpen() {
    if (mode !== "embedded") {
      lastFocused = document.activeElement;
      document.addEventListener("keydown", onKeydown);
      focusInput();
    }
  }

  function openPanel() {
    if (openState || mode === "embedded") return;
    openState = true;
    renderOpenState();
    greet();
    giveFocusOnOpen();
  }

  function closePanel(restoreFocus) {
    if (!openState || mode === "embedded") return;
    openState = false;
    renderOpenState();
    document.removeEventListener("keydown", onKeydown);
    if (restoreFocus) {
      var target = mode === "bubble" ? bubble : lastFocused;
      if (target && typeof target.focus === "function") {
        try {
          target.focus();
        } catch (e) {
          /* The previously focused element may be gone. */
        }
      }
    }
  }

  function focusable() {
    var nodes = panel.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), a[href]',
    );
    var visible = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getClientRects().length > 0) visible.push(nodes[i]);
    }
    return visible;
  }

  function onKeydown(event) {
    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      closePanel(true);
      return;
    }
    if (event.key !== "Tab" || (mode !== "popup" && mode !== "fullscreen")) return;

    // Modal modes trap Tab inside the panel. The bubble is not modal — a visitor
    // must be able to tab back into the host page — so it is deliberately exempt.
    var nodes = focusable();
    if (nodes.length === 0) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    var active = root.activeElement;
    if (event.shiftKey && (active === first || !active)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Applies the configured mode, opening the panel when the mode has no
   * launcher. Popup, fullscreen and embedded must be visible on arrival — a
   * configured mode whose panel stays hidden is indistinguishable from a broken
   * embed.
   */
  function activateMode() {
    if (mode === "bubble") {
      openState = false;
      renderOpenState();
      return;
    }
    openState = true;
    renderOpenState();
    greet();
    if (mode === "popup" || mode === "fullscreen") giveFocusOnOpen();
  }

  function setMode(next) {
    if (!next || next === mode) return;
    document.removeEventListener("keydown", onKeydown);
    mode = next;
    openState = false;
    applyLook();
    activateMode();
  }

  function readPrompts(value) {
    var out = [];
    if (!Array.isArray(value)) return out;
    for (var i = 0; i < value.length && out.length < 4; i++) {
      if (typeof value[i] !== "string") continue;
      var text = value[i].trim();
      if (text && text.length <= 160) out.push(text);
    }
    return out;
  }

  function addMsg(who, text) {
    var el = document.createElement("div");
    el.className = "msg " + who;
    el.textContent = text;

    // An avatar beside the assistant's replies, when one is configured. The CSS
    // for this existed before the markup did, so the setting saved and changed
    // nothing — which the dashboard was warning operators about.
    if (who === "bot" && imageOk(look.avatar)) {
      var row = document.createElement("div");
      row.className = "row";
      var img = document.createElement("img");
      img.src = look.avatar;
      img.alt = "";
      row.appendChild(img);
      row.appendChild(el);
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function clearPrompts() {
    var wraps = log.querySelectorAll(".suggestions");
    for (var i = 0; i < wraps.length; i++) wraps[i].remove();
  }

  /**
   * Quick replies. Text only: textContent means a prompt containing markup is
   * displayed as written, never parsed. Clicking submits it exactly as if the
   * visitor had typed it.
   */
  function addPrompts(list) {
    var questions = readPrompts(list);
    if (questions.length === 0) return;
    var wrap = document.createElement("div");
    wrap.className = "suggestions";
    questions.forEach(function (question) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = question;
      button.addEventListener("click", function () {
        input.value = question;
        send();
        focusInput();
      });
      wrap.appendChild(button);
    });
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  /**
   * Three bouncing dots while the first token is still on its way.
   *
   * Answers take a second or two, and an empty bubble reads as a hang. Removed by
   * the caller as soon as any text arrives, so it never overlaps the reply.
   */
  function showTyping(el) {
    if (!look.typingAnimation) return;
    el.classList.add("dots");
    el.innerHTML = "<span></span><span></span><span></span>";
  }

  function clearTyping(el) {
    if (el.classList.contains("dots")) {
      el.classList.remove("dots");
      el.textContent = "";
    }
  }

  function applyConfig(a) {
    if (!a || typeof a !== "object") return;
    if (oneOf(a.theme, ["light", "dark", "auto"])) look.theme = a.theme;
    if (typeof a.emoji === "string" && a.emoji.length <= 16) look.emoji = a.emoji;
    if (a.primaryColor) look.primaryColor = a.primaryColor;
    if (a.secondaryColor) look.secondaryColor = a.secondaryColor;
    if (oneOf(a.position, ["bottom-right", "bottom-left"])) look.position = a.position;
    if (oneOf(a.size, ["compact", "regular", "large"])) look.size = a.size;
    if (oneOf(a.displayMode, MODES)) look.displayMode = a.displayMode;
    if (Array.isArray(a.suggestedQuestions)) {
      look.suggestedQuestions = readPrompts(a.suggestedQuestions);
    }
    if (Array.isArray(a.starterPrompts)) {
      look.starterPrompts = readPrompts(a.starterPrompts);
    }
    if (typeof a.welcomeMessage === "string" && a.welcomeMessage) {
      look.welcomeMessage = a.welcomeMessage.slice(0, 300);
    }
    if (typeof a.placeholder === "string" && a.placeholder) {
      look.placeholder = a.placeholder.slice(0, 120);
    }
    if (typeof a.launcherLabel === "string" && a.launcherLabel.trim()) {
      look.launcherLabel = a.launcherLabel.trim().slice(0, 60);
    }
    if (typeof a.branding === "boolean") look.branding = a.branding;
    if (typeof a.typingAnimation === "boolean") look.typingAnimation = a.typingAnimation;
    look.avatar = a.avatar || null;
    look.logo = a.logo || null;
  }

  function subscribeTheme() {
    // Follow the system theme live while "auto" is in effect, matching what the
    // stylesheet's media query used to do before the theme became configurable.
    if (!window.matchMedia) return;
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onScheme = function () {
      if (look.theme === "auto") style.textContent = css();
    };
    if (mq.addEventListener) mq.addEventListener("change", onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  }

  function loadConfig() {
    // Failure is silent on purpose: the widget already works with defaults, and
    // a visitor must never be shown a configuration error. The t parameter is
    // required for the preflight — see the note on the chat fetch below.
    fetch(
      origin + "/api/v1/chatbots/" + encodeURIComponent(chatbotId) +
        "/config?t=" + encodeURIComponent(token),
    )
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) {
        if (!payload || !payload.ok || !payload.data) return;
        applyConfig(payload.data.appearance);
        if (payload.data.name) look.title = String(payload.data.name).slice(0, 80);
        applyLook();
        // A per-page data-mode override wins over the stored setting; without
        // one, adopt the configured mode and open it if it has no launcher.
        if (!modeOverride) {
          var next = oneOf(look.displayMode, MODES);
          if (next && next !== mode) setMode(next);
        }
      })
      .catch(function () { /* Defaults stand. */ });
  }

  async function send() {
    var text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    clearPrompts();
    addMsg("user", text);
    var out = addMsg("bot", "");
    showTyping(out);
    try {
      // The id and token go in the QUERY STRING as well as the body, and this is
      // load-bearing rather than redundant.
      //
      // A cross-origin POST with a JSON content type triggers a CORS preflight,
      // and a preflight carries no body — so OPTIONS cannot know which bot is
      // being addressed unless it is told in the URL. Without them the handler
      // resolves no bot, grants no Access-Control-Allow-Origin, and the browser
      // blocks the real request before it is ever sent. The visitor sees
      // "the assistant is unreachable".
      //
      // It went unnoticed because bitecodes.com is the SAME ORIGIN as the API,
      // where browsers skip CORS entirely and no preflight happens. The widget
      // therefore worked on our own site and could not work on a single
      // customer's site — which is the entire product.
      var chatUrl =
        origin +
        "/api/v1/chat?id=" +
        encodeURIComponent(chatbotId) +
        "&t=" +
        encodeURIComponent(token);
      var res = await fetch(chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId: chatbotId,
          publicToken: token,
          conversationId: conversationId,
          message: text,
          history: history.slice(-6)
        })
      });
      if (!res.ok) {
        clearTyping(out);
        if (res.status === 403) console.error("[bitecodes-chat] " + explainFailure());
        out.textContent =
          res.status === 402 ? "This assistant is out of credits right now."
          : res.status === 403 ? "This assistant is not enabled on this site."
          : res.status === 404 ? "This assistant is not available. Check the chatbot id and token."
          : "Sorry, something went wrong. Please try again.";
        return;
      }
      var cid = res.headers.get("x-conversation-id");
      if (cid) conversationId = cid;
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        var parts = buf.split("\\n\\n");
        buf = parts.pop() || "";
        for (var i = 0; i < parts.length; i++) {
          var line = parts[i];
          var m = /data:\\s?(.*)/.exec(line);
          if (!m) continue;
          try {
            var payload = JSON.parse(m[1]);
            if (payload.delta) { clearTyping(out); out.textContent += payload.delta; log.scrollTop = log.scrollHeight; }
            if (payload.message && !out.textContent) { clearTyping(out); out.textContent = payload.message; }
          } catch (e) { /* ignore keep-alive lines */ }
        }
      }
      if (!out.textContent) {
        out.textContent = "Sorry, I could not answer that. Please try again.";
      } else {
        addPrompts(look.suggestedQuestions);
      }
      history.push({ role: "user", content: text });
      history.push({ role: "assistant", content: out.textContent });
    } catch (e) {
      // fetch rejected without a readable response. That is what a refused origin
      // looks like from inside the page: the gateway answered 403 with a precise
      // explanation, but withheld the CORS header, so the browser will not let
      // this script see any of it. The console gets the real reason; the visitor
      // gets something true but not alarming, because a misconfigured allowlist
      // is the site owner's problem to fix, not theirs to decipher.
      clearTyping(out);
      reportFailure();
      out.textContent =
        location.protocol === "file:"
          ? "This demo page needs to be served over http, not opened from a file. See the console."
          : "Sorry, the assistant is unreachable right now.";
    }
  }

  function mount() {
    if (mounted || !document.body) return;
    mounted = true;

    if (labelOverride) {
      look.launcherLabel = labelOverride.trim().slice(0, 60) || look.launcherLabel;
    }

    host = document.createElement("div");
    host.setAttribute("data-bitecodes-chat", chatbotId);
    host.style.cssText =
      mode === "embedded"
        ? "display:block;width:100%;height:100%;"
        : "position:fixed;z-index:2147483000;bottom:20px;right:20px;";

    if (mode === "embedded") resolveContainer().appendChild(host);
    else document.body.appendChild(host);

    root = host.attachShadow({ mode: "open" });

    style = document.createElement("style");
    root.appendChild(style);

    // The backdrop sits behind the panel and is only shown by popup mode.
    backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.addEventListener("click", function () { closePanel(true); });
    root.appendChild(backdrop);

    panel = document.createElement("div");
    panel.className = "panel";
    panel.id = "bc-panel";
    panel.setAttribute("aria-labelledby", "bc-title");
    // The title id lives inside the shadow root, so it cannot collide with an id
    // on the host page even though it is a fixed string.
    panel.innerHTML =
      '<div class="hd"><span class="hdlogo"></span>' +
      '<span class="hdtitle" id="bc-title"></span>' +
      '<button class="close" type="button" aria-label="Close chat">&times;</button></div>' +
      '<div class="log" role="log" aria-live="polite" aria-relevant="additions text"></div>' +
      '<div class="ft"><input type="text" aria-label="Message"/>' +
      '<button type="button">Send</button></div>';
    root.appendChild(panel);

    bubble = document.createElement("button");
    bubble.className = "bubble";
    bubble.type = "button";
    bubble.setAttribute("aria-controls", "bc-panel");
    bubble.addEventListener("click", function () {
      if (openState) closePanel(true);
      else openPanel();
    });
    root.appendChild(bubble);

    log = panel.querySelector(".log");
    input = panel.querySelector(".ft input");
    sendBtn = panel.querySelector(".ft button");
    closeBtn = panel.querySelector(".close");
    titleEl = panel.querySelector(".hdtitle");

    closeBtn.addEventListener("click", function () { closePanel(true); });
    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });

    applyLook();
    activateMode();
    loadConfig();
    subscribeTheme();

    // Small diagnostics/control surface, keyed by bot so two embeds on one page
    // do not overwrite each other. Versioning is additive: older script copies
    // simply never define this.
    window.BitecodesChat = window.BitecodesChat || {
      version: WIDGET_VERSION,
      widgets: {}
    };
    window.BitecodesChat.version = WIDGET_VERSION;
    window.BitecodesChat.widgets = window.BitecodesChat.widgets || {};
    window.BitecodesChat.widgets[chatbotId] = {
      version: WIDGET_VERSION,
      open: function () { openPanel(); },
      close: function () { closePanel(true); },
      isOpen: function () { return openState; }
    };
  }

  if (document.body) mount();
  else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "X-Bitecodes-Widget-Version": WIDGET_VERSION,
      // Short in the browser, long at the edge.
      //
      // This file is a loader embedded on sites we do not control, so it is the
      // one asset we can never ask anyone to bust. An hour of browser caching
      // meant the CORS preflight fix took an hour to reach live embeds — the
      // deploy was green while visitors still ran the broken copy. Five minutes
      // bounds that; `s-maxage` keeps the edge doing the actual serving, and
      // `stale-while-revalidate` means a revalidation is never in a visitor's
      // critical path.
      "Cache-Control":
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
