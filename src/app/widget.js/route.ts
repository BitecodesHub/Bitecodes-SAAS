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
  host.style.cssText = "position:fixed;z-index:2147483000;bottom:20px;right:20px;";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
    ".bubble{width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;",
    "background:#4f46e5;color:#fff;font-size:24px;box-shadow:0 6px 20px rgba(0,0,0,.25)}",
    ".panel{position:absolute;bottom:70px;right:0;width:360px;max-width:calc(100vw - 40px);",
    "height:520px;max-height:calc(100vh - 120px);background:#fff;color:#111;border-radius:16px;",
    "box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden}",
    ".panel.open{display:flex}",
    ".hd{padding:14px 16px;background:#4f46e5;color:#fff;font-weight:600}",
    ".log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
    ".msg{padding:9px 12px;border-radius:12px;max-width:85%;font-size:14px;line-height:1.45;white-space:pre-wrap}",
    ".user{align-self:flex-end;background:#4f46e5;color:#fff}",
    ".bot{align-self:flex-start;background:#f1f1f4;color:#111}",
    ".ft{display:flex;gap:8px;padding:12px;border-top:1px solid #eee}",
    ".ft input{flex:1;padding:9px 12px;border:1px solid #ddd;border-radius:10px;font-size:14px}",
    ".ft button{border:0;background:#4f46e5;color:#fff;border-radius:10px;padding:0 14px;cursor:pointer}",
    "@media(prefers-color-scheme:dark){.panel{background:#15151b;color:#eee}.bot{background:#26262e;color:#eee}",
    ".ft{border-top-color:#26262e}.ft input{background:#0f0f14;border-color:#33333d;color:#eee}}"
  ].join("");
  root.appendChild(style);

  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.textContent = "\\uD83D\\uDCAC";

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML =
    '<div class="hd">Chat with us</div>' +
    '<div class="log" role="log"></div>' +
    '<div class="ft"><input type="text" placeholder="Ask a question\\u2026" aria-label="Message"/>' +
    '<button type="button">Send</button></div>';

  root.appendChild(panel);
  root.appendChild(bubble);

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
      if (!greeted) { addMsg("bot", "Hi! How can I help you today?"); greeted = true; }
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
