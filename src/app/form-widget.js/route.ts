import { getSiteUrl } from "@/lib/server/env";

/**
 * The embeddable form loader, served at `/form-widget.js`.
 *
 * A customer drops one <script> tag with `data-form` and `data-token`. It
 * fetches the form's public config, renders the fields inside a **Shadow DOM**
 * (so the host page's CSS can neither leak in nor be disturbed), and posts to
 * the submit endpoint.
 *
 * The script holds only the public token, which grants submission to this one
 * form from an allowed domain and nothing else. Every request is re-authorised
 * server-side against the form's allowlist.
 */
export const dynamic = "force-static";

export function GET() {
  const origin = getSiteUrl();

  const js = `(function () {
  "use strict";
  var current = document.currentScript;
  if (!current) return;
  var formId = current.getAttribute("data-form");
  var token = current.getAttribute("data-token");
  // Derived from this script's own URL rather than baked in — see the note in
  // widget.js. A baked-in apex origin that 308s to www makes every embedded
  // form fail its CORS preflight, because a preflight may not be redirected.
  var origin = ${JSON.stringify(origin)};
  try {
    origin = new URL(current.src, document.baseURI).origin;
  } catch (e) {
    /* Keep the server-rendered default. */
  }
  if (!formId || !token) {
    console.error("[bitecodes-forms] data-form and data-token are required");
    return;
  }

  var host = document.createElement("div");
  host.setAttribute("data-bitecodes-form", formId);
  // Replace the script tag in the flow, so the form lands where it was embedded.
  current.parentNode.insertBefore(host, current.nextSibling);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  root.appendChild(style);
  var wrap = document.createElement("div");
  wrap.className = "bcf";
  root.appendChild(wrap);

  function css(accent) {
    return [
      ":host{all:initial;display:block}",
      "*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
      ".bcf{max-width:560px;color:#111}",
      ".row{margin-bottom:14px}",
      "label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}",
      ".req{color:" + accent + "}",
      "input,textarea,select{width:100%;padding:10px 12px;border:1px solid #d6d6de;",
      "border-radius:10px;font-size:15px;background:#fff;color:#111}",
      "input:focus,textarea:focus,select:focus{outline:2px solid " + accent + "40;border-color:" + accent + "}",
      "textarea{min-height:120px;resize:vertical}",
      ".cbrow{display:flex;align-items:flex-start;gap:9px}",
      ".cbrow input{width:auto;margin-top:3px}",
      ".cbrow label{margin:0;font-weight:500}",
      "button{background:" + accent + ";color:#fff;border:0;border-radius:10px;",
      "padding:11px 20px;font-size:15px;font-weight:600;cursor:pointer}",
      "button[disabled]{opacity:.6;cursor:default}",
      ".err{color:#b42318;font-size:13px;margin-top:5px}",
      ".note{padding:14px 16px;border-radius:12px;font-size:15px;line-height:1.5}",
      ".ok{background:#ecfdf3;color:#05603a;border:1px solid #abefc6}",
      ".bad{background:#fef3f2;color:#b42318;border:1px solid #fecdca}",
      ".trap{position:absolute!important;left:-9999px!important;opacity:0!important}",
      "@media(prefers-color-scheme:dark){.bcf{color:#eee}",
      "input,textarea,select{background:#15151b;border-color:#33333d;color:#eee}",
      ".ok{background:#052e1f;color:#a6f4c5;border-color:#074d31}",
      ".bad{background:#2e0d0b;color:#fda29b;border-color:#5b1a15}}"
    ].join("");
  }

  function note(cls, text) {
    wrap.innerHTML = "";
    var el = document.createElement("div");
    el.className = "note " + cls;
    el.textContent = text;
    wrap.appendChild(el);
  }

  function field(f) {
    var row = document.createElement("div");
    row.className = f.type === "checkbox" ? "row cbrow" : "row";
    var id = "bcf_" + f.name;

    var input;
    if (f.type === "textarea") {
      input = document.createElement("textarea");
    } else if (f.type === "select") {
      input = document.createElement("select");
      if (!f.required) {
        var blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "Please choose…";
        input.appendChild(blank);
      }
      (f.options || []).forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type =
        f.type === "email" ? "email"
        : f.type === "number" ? "number"
        : f.type === "phone" ? "tel"
        : f.type === "checkbox" ? "checkbox"
        : f.type === "hidden" ? "hidden"
        : "text";
    }
    input.id = id;
    input.name = f.name;
    if (f.placeholder && f.type !== "checkbox") input.placeholder = f.placeholder;
    if (f.required) input.required = true;
    if (f.maxLength && input.setAttribute) input.setAttribute("maxlength", f.maxLength);

    if (f.type === "hidden") {
      row.appendChild(input);
      return row;
    }

    var label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = f.label;
    if (f.required) {
      var star = document.createElement("span");
      star.className = "req";
      star.textContent = " *";
      label.appendChild(star);
    }

    if (f.type === "checkbox") {
      row.appendChild(input);
      row.appendChild(label);
    } else {
      row.appendChild(label);
      row.appendChild(input);
    }
    return row;
  }

  function render(cfg) {
    style.textContent = css((cfg.appearance && cfg.appearance.primaryColor) || "#4f46e5");
    wrap.innerHTML = "";
    var form = document.createElement("form");
    form.setAttribute("novalidate", "novalidate");

    cfg.fields.forEach(function (f) { form.appendChild(field(f)); });

    if (cfg.honeypotField) {
      var trap = document.createElement("div");
      trap.className = "trap";
      trap.setAttribute("aria-hidden", "true");
      var ti = document.createElement("input");
      ti.type = "text";
      ti.name = cfg.honeypotField;
      ti.tabIndex = -1;
      ti.autocomplete = "off";
      trap.appendChild(ti);
      form.appendChild(trap);
    }

    var errBox = document.createElement("div");
    errBox.className = "err";
    errBox.setAttribute("role", "alert");
    form.appendChild(errBox);

    var btn = document.createElement("button");
    btn.type = "submit";
    btn.textContent = (cfg.appearance && cfg.appearance.buttonText) || "Send";
    form.appendChild(btn);
    wrap.appendChild(form);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      errBox.textContent = "";
      btn.disabled = true;
      var original = btn.textContent;
      btn.textContent = "Sending…";

      var body = { _token: token };
      cfg.fields.forEach(function (f) {
        var el = form.querySelector('[name="' + f.name + '"]');
        if (!el) return;
        body[f.name] = f.type === "checkbox" ? el.checked : el.value;
      });
      if (cfg.honeypotField) {
        var trapEl = form.querySelector('[name="' + cfg.honeypotField + '"]');
        if (trapEl) body[cfg.honeypotField] = trapEl.value;
      }

      try {
        // The t query parameter is required for the CORS preflight, not merely
        // convenient: a preflight has no body, so the OPTIONS handler can only
        // resolve this form — and therefore its allowlist — from the URL.
        // Without it no Access-Control-Allow-Origin comes back and the browser
        // blocks the submission before sending it. Longer note in widget.js.
        // (No backticks in here: this whole script is a template literal.)
        var submitUrl =
          origin +
          "/api/forms/" +
          encodeURIComponent(formId) +
          "/submit?t=" +
          encodeURIComponent(token);
        var res = await fetch(submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        var payload = await res.json().catch(function () { return {}; });

        if (res.ok) {
          if (payload.redirectUrl) { window.location.href = payload.redirectUrl; return; }
          note("ok", payload.message || "Thanks — we have received your message.");
          return;
        }
        if (res.status === 422 && payload.fieldErrors) {
          var first = Object.keys(payload.fieldErrors)[0];
          errBox.textContent = payload.fieldErrors[first][0] || payload.message;
        } else {
          errBox.textContent = payload.message || "Something went wrong. Please try again.";
        }
      } catch (err) {
        errBox.textContent = "We could not reach the server. Please try again.";
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  fetch(origin + "/api/forms/" + formId + "/config?t=" + encodeURIComponent(token))
    .then(function (r) { return r.json(); })
    .then(function (payload) {
      if (!payload || !payload.ok) {
        style.textContent = css("#4f46e5");
        note("bad", (payload && payload.message) || "This form is not available.");
        return;
      }
      render(payload.data);
    })
    .catch(function () {
      style.textContent = css("#4f46e5");
      note("bad", "This form could not be loaded.");
    });
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Short in the browser, long at the edge — see the note in widget.js. A
      // loader embedded on sites we do not control is the one asset nobody can
      // bust for us, so a long browser TTL delays every fix.
      "Cache-Control":
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
