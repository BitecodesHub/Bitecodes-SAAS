import { getSiteUrl } from "@/lib/server/env";

/**
 * The embeddable widget loader, served at `/widget.js`.
 *
 * A customer drops one <script> tag with `data-chatbot` and `data-token`. This
 * builds a floating launcher and a chat panel inside a **Shadow DOM**, so the
 * host page's CSS can never leak in or out, and streams answers from the chat
 * gateway over SSE. It holds only the public token (chat-only); every request
 * is re-authorised server-side against the bot's domain allowlist.
 *
 * Served as static JS with a long cache. This is the MVP skeleton: it renders,
 * opens, sends, and streams. Appearance is fetched from the (future) public
 * config endpoint; until then it uses sensible defaults and the data-attrs.
 */
export const dynamic = "force-static";

export function GET() {
  const origin = getSiteUrl();

  const js = `(function () {
  "use strict";
  var current = document.currentScript;
  if (!current) return;
  var chatbotId = current.getAttribute("data-chatbot");
  var token = current.getAttribute("data-token");
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

  var host = document.createElement("div");
  host.setAttribute("data-bitecodes-chat", chatbotId);
  // Anchored right by default; applyLook() moves it if the bot says bottom-left.
  host.style.cssText = "position:fixed;z-index:2147483000;bottom:20px;right:20px;";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  // Appearance defaults. The config endpoint overrides these per bot; if it is
  // unreachable the widget still renders with these, because a visitor seeing a
  // slightly off-brand assistant is far better than seeing none.
  var look = {
    theme: "auto",
    primaryColor: "#4f46e5",
    position: "bottom-right",
    size: "regular",
    welcomeMessage: "Hi! How can I help you today?",
    placeholder: "Ask a question\u2026",
    title: "Chat with us",
    branding: true,
    typingAnimation: true,
    avatar: null,
    logo: null
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

  function css() {
    var dim = SIZES[look.size] || SIZES.regular;
    var accent = safeColor(look.primaryColor, "#4f46e5");
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
      "background:" + accent + ";color:#fff;font-size:" + Math.round(dim.bubble * 0.43) + "px;",
      "box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}",
      ".panel{position:absolute;bottom:" + (dim.bubble + 14) + "px;" + side + ":0;width:" + dim.w + "px;",
      "max-width:calc(100vw - 40px);height:" + dim.h + "px;max-height:calc(100vh - 120px);",
      "background:" + panelBg + ";color:" + panelFg + ";border-radius:16px;",
      "box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden}",
      ".panel.open{display:flex}",
      ".hd{padding:14px 16px;background:" + accent + ";color:#fff;font-weight:600;",
      "display:flex;align-items:center;gap:9px}",
      ".hd img{width:20px;height:20px;border-radius:4px;object-fit:contain}",
      ".log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
      ".msg{padding:9px 12px;border-radius:12px;max-width:85%;font-size:" + dim.font + "px;",
      "line-height:1.45;white-space:pre-wrap}",
      ".user{align-self:flex-end;background:" + accent + ";color:#fff}",
      ".bot{align-self:flex-start;background:" + botBg + ";color:" + panelFg + "}",
      ".row{display:flex;align-items:flex-end;gap:7px;max-width:100%}",
      ".row img{width:24px;height:24px;border-radius:50%;object-fit:cover;flex:0 0 auto}",
      ".dots span{display:inline-block;width:5px;height:5px;margin:0 1px;border-radius:50%;",
      "background:currentColor;opacity:.45;animation:bcbounce 1.2s infinite}",
      ".dots span:nth-child(2){animation-delay:.15s}.dots span:nth-child(3){animation-delay:.3s}",
      "@keyframes bcbounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}",
      ".ft{display:flex;gap:8px;padding:12px;border-top:1px solid " + line + "}",
      ".ft input{flex:1;padding:9px 12px;border:1px solid " + inputBorder + ";border-radius:10px;",
      "font-size:" + dim.font + "px;background:" + inputBg + ";color:" + panelFg + "}",
      ".ft button{border:0;background:" + accent + ";color:#fff;border-radius:10px;padding:0 14px;cursor:pointer}",
      ".brand{padding:0 12px 10px;font-size:11px;opacity:.55;text-align:center}",
      ".brand a{color:inherit}"
    ].join("");
  }

  var style = document.createElement("style");
  style.textContent = css();
  root.appendChild(style);

  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.textContent = "\\uD83D\\uDCAC";

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML =
    '<div class="hd"><span class="hdlogo"></span><span class="hdtitle"></span></div>' +
    '<div class="log" role="log"></div>' +
    '<div class="ft"><input type="text" aria-label="Message"/>' +
    '<button type="button">Send</button></div>';

  root.appendChild(panel);
  root.appendChild(bubble);

  /**
   * Pushes look into the DOM. Called once with the defaults and again when the
   * config arrives, so the widget is usable immediately and simply restyles.
   */
  function applyLook() {
    style.textContent = css();
    host.style.cssText =
      "position:fixed;z-index:2147483000;bottom:20px;" +
      (look.position === "bottom-left" ? "left:20px;" : "right:20px;");

    var title = panel.querySelector(".hdtitle");
    if (title) title.textContent = look.title || "Chat with us";

    var slot = panel.querySelector(".hdlogo");
    if (slot) {
      slot.innerHTML = "";
      // Only http(s) and data:image are rendered. The value is a URL an operator
      // typed, and this ends up as an <img> on a customer's page.
      // No slash escape in this regex: the whole script is a template literal, so
      // a backslash-slash here would be resolved before the browser ever sees it,
      // emitting a bare slash that closes the regex early. A character class
      // avoids needing the escape at all.
      if (look.logo && /^(https?:|data:image[/])/i.test(look.logo)) {
        var im = document.createElement("img");
        im.src = look.logo;
        im.alt = "";
        slot.appendChild(im);
      }
    }

    var input = panel.querySelector(".ft input");
    if (input) input.placeholder = look.placeholder || "Ask a question\u2026";

    var brand = panel.querySelector(".brand");
    if (look.branding && !brand) {
      brand = document.createElement("div");
      brand.className = "brand";
      brand.innerHTML =
        'Powered by <a href="' + origin + '/ai-chatbot" target="_blank" rel="noopener">Bitecodes</a>';
      panel.appendChild(brand);
    } else if (!look.branding && brand) {
      brand.remove();
    }
  }

  applyLook();

  // Fetch this bot's appearance. Failure is silent on purpose: the widget already
  // works with defaults, and a visitor must never be shown a configuration error.
  // the t parameter is required for the preflight — see the note on the chat fetch below.
  fetch(
    origin + "/api/v1/chatbots/" + encodeURIComponent(chatbotId) +
      "/config?t=" + encodeURIComponent(token)
  )
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (payload) {
      if (!payload || !payload.ok || !payload.data || !payload.data.appearance) return;
      var a = payload.data.appearance;
      if (a.theme) look.theme = a.theme;
      if (a.primaryColor) look.primaryColor = a.primaryColor;
      if (a.position) look.position = a.position;
      if (a.size) look.size = a.size;
      if (a.welcomeMessage) look.welcomeMessage = a.welcomeMessage;
      if (a.placeholder) look.placeholder = a.placeholder;
      if (typeof a.branding === "boolean") look.branding = a.branding;
      if (typeof a.typingAnimation === "boolean") look.typingAnimation = a.typingAnimation;
      look.avatar = a.avatar || null;
      look.logo = a.logo || null;
      if (payload.data.name) look.title = payload.data.name;
      applyLook();
    })
    .catch(function () { /* Defaults stand. */ });

  // Follow the system theme live while "auto" is in effect, matching what the
  // stylesheet's media query used to do before the theme became configurable.
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onScheme = function () { if (look.theme === "auto") style.textContent = css(); };
    if (mq.addEventListener) mq.addEventListener("change", onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  }

  var log = panel.querySelector(".log");
  var input = panel.querySelector("input");
  var sendBtn = panel.querySelector(".ft button");
  var conversationId = null;
  var greeted = false;
  // Prior turns, so a follow-up like "and how long does that take?" makes
  // sense. Only the recent tail is sent; the server trims it again and the
  // prompt budget is bounded there, not trusted from here.
  var history = [];

  function addMsg(who, text) {
    var el = document.createElement("div");
    el.className = "msg " + who;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  bubble.addEventListener("click", function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      if (!greeted) { addMsg("bot", look.welcomeMessage); greeted = true; }
      input.focus();
    }
  });

  async function send() {
    var text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    addMsg("user", text);
    var out = addMsg("bot", "");
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
        out.textContent =
          res.status === 402 ? "This assistant is out of credits right now."
          : res.status === 403 ? "This assistant is not enabled on this site."
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
            if (payload.delta) { out.textContent += payload.delta; log.scrollTop = log.scrollHeight; }
            if (payload.message && !out.textContent) { out.textContent = payload.message; }
          } catch (e) { /* ignore keep-alive lines */ }
        }
      }
      if (!out.textContent) {
        out.textContent = "Sorry, I could not answer that. Please try again.";
      }
      history.push({ role: "user", content: text });
      history.push({ role: "assistant", content: out.textContent });
    } catch (e) {
      out.textContent = "Sorry, the assistant is unreachable right now.";
    }
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
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
