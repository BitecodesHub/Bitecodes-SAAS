import { getSiteUrl } from "@/lib/server/env";

/**
 * The embeddable booking loader, served at `/booking-widget.js`.
 *
 * A customer drops one <script> tag with `data-booking` and `data-token`. It
 * fetches the configuration's public availability, renders the next available
 * days and their slots inside a **Shadow DOM** (so the host page's CSS can
 * neither leak in nor be disturbed), collects a name and an email, and posts the
 * chosen slot to the booking endpoint.
 *
 * The script holds only the public token, which grants booking against this one
 * configuration from an allowed domain and nothing else. Every request is
 * re-authorised server-side against the configuration's allowlist.
 *
 * ---------------------------------------------------------------------------
 * THE CONTRACT THIS WIDGET SPEAKS
 * ---------------------------------------------------------------------------
 * GET  /api/bookings/<id>/availability?id=<id>&t=<token>
 *   200 { ok: true, data: {
 *           bookingId, name, description,
 *           appearance: { primaryColor, buttonText, theme },
 *           timezone, slotMinutes, confirmationMessage,
 *           slots: [{ startIso, endIso }]
 *       } }
 *   4xx { ok: false, code, message }
 *
 * POST /api/bookings/<id>/book?id=<id>&t=<token>
 *   body { bookingId, publicToken, startIso, name, email, phone, notes, timezone }
 *   200 { ok: true, message }
 *   409 { ok: false, code: "SLOT_TAKEN" }        — someone else won the race
 *   403 { ok: false, code: "ORIGIN_NOT_ALLOWED" }
 *   402 { ok: false, code: "OWNER_OUT_OF_CREDITS" }
 *   404 { ok: false, code: "NOT_AVAILABLE" }     — missing, wrong token, or paused
 *   429 { ok: false, code: "RATE_LIMITED" }
 *   422 { ok: false, code: "INVALID", message }
 *
 * Slots are always UTC instants on the wire. Which wall clock a visitor is
 * standing in is a rendering concern and is resolved here, never on the server.
 * ---------------------------------------------------------------------------
 *
 * TWO RULES ABOUT THE SOURCE BELOW, both learned in production:
 *
 * 1. It lives inside a TEMPLATE LITERAL, so every backslash escape is resolved
 *    by the TypeScript compiler before the browser ever sees the file. A `\s` in
 *    a regex arrives as a bare `s`; a `\/` arrives as a bare `/` and closes the
 *    regex early, which is exactly how a broken widget once shipped. There are
 *    therefore no backticks and no backslash escapes anywhere in this script —
 *    character classes such as `[.]` and `[/]` do the same job and survive.
 *
 * 2. Both fetch URLs carry `?id=` and `?t=`. See the long note on the booking
 *    POST for why omitting them takes every embed down at once.
 */
export const dynamic = "force-static";

export function GET() {
  const origin = getSiteUrl();

  const js = `(function () {
  "use strict";
  var current = document.currentScript;
  if (!current) return;
  var bookingId = current.getAttribute("data-booking");
  var token = current.getAttribute("data-token");
  // Derived from this script's own URL rather than baked in — see the note in
  // widget.js. A baked-in apex origin that 308s to www makes every embed fail
  // its CORS preflight, because a preflight may not be redirected.
  var origin = ${JSON.stringify(origin)};
  try {
    origin = new URL(current.src, document.baseURI).origin;
  } catch (e) {
    /* Keep the server-rendered default. */
  }

  if (!bookingId || !token) {
    console.error("[bitecodes-bookings] data-booking and data-token are required");
    return;
  }

  /**
   * Why a request failed, in words the person who installed the snippet can act
   * on.
   *
   * When the server refuses an origin it also withholds Access-Control-Allow-Origin,
   * so the browser hides the entire response from this script — all it can observe
   * is that fetch rejected. The precise refusal therefore has to be inferred from
   * what IS observable and written to the console, or every misconfiguration
   * surfaces to a visitor as an unexplained failure and nobody learns anything.
   */
  function explainFailure() {
    if (location.protocol === "file:") {
      return (
        "This page was opened directly from disk (file://), which sends no " +
        "Origin header, so the booking service cannot verify which site is " +
        "asking. Serve the page over http instead - for example: " +
        "python3 -m http.server 8080 - then open http://localhost:8080/. " +
        "Localhost is always allowed."
      );
    }
    return (
      "The request was blocked before a reply could be read, which almost " +
      "always means this site is not on the booking page's allowed domains. " +
      "Add " + location.hostname + " in the Bitecodes dashboard under this " +
      "booking page's settings. Loopback addresses such as localhost are " +
      "always allowed."
    );
  }

  // ---------------------------------------------------------------------
  // Time, as the VISITOR experiences it
  // ---------------------------------------------------------------------
  //
  // The owner authors availability in their own zone and the wire carries UTC,
  // but a visitor books the clock on their own wall. Rendering an owner's
  // "09:00" to somebody eight hours away is how a person books 3am without
  // noticing, so every instant below is formatted in the browser's zone and the
  // zone is stated on screen rather than left to be assumed.

  function localZoneName() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e) {
      return "";
    }
  }

  function localZoneAbbr(d) {
    try {
      var parts = new Intl.DateTimeFormat(undefined, {
        timeZoneName: "short"
      }).formatToParts(d);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "timeZoneName") return parts[i].value;
      }
    } catch (e) {
      /* fall through */
    }
    return "";
  }

  function timezoneLine() {
    var d = new Date();
    var zone = localZoneName();
    var abbr = localZoneAbbr(d);
    var detail = zone && abbr ? zone + ", " + abbr : zone || abbr;
    return detail
      ? "All times are shown in your local time zone (" + detail + ")."
      : "All times are shown in your local time zone.";
  }

  function fmtTime(d) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
      }).format(d);
    } catch (e) {
      return d.toTimeString().slice(0, 5);
    }
  }

  function fmtDayHeading(d) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long"
      }).format(d);
    } catch (e) {
      return d.toDateString();
    }
  }

  function fmtFull(d) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit"
      }).format(d);
    } catch (e) {
      return d.toString();
    }
  }

  // Local calendar day, not UTC day. Date methods without "UTC" already read the
  // browser's zone, which is precisely the grouping a visitor expects to see.
  function localDayKey(d) {
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  // ---------------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------------

  var host = document.createElement("div");
  host.setAttribute("data-bitecodes-booking", bookingId);
  // Replace the script tag in the flow, so the picker lands where it was embedded.
  current.parentNode.insertBefore(host, current.nextSibling);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  root.appendChild(style);
  var wrap = document.createElement("div");
  wrap.className = "bcb";
  root.appendChild(wrap);

  // Only a hex colour reaches the stylesheet. The server validates this too, but
  // this is the sink: an arbitrary string interpolated into CSS is an injection
  // point, and this widget runs on somebody else's page.
  function safeColor(c, fallback) {
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c || "")) ? c : fallback;
  }

  function css(rawAccent) {
    var accent = safeColor(rawAccent, "#4f46e5");
    return [
      ":host{all:initial;display:block}",
      "*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
      ".bcb{max-width:560px;color:#111;font-size:15px;line-height:1.5}",
      ".tz{font-size:13px;color:#5b5b66;margin-bottom:14px}",
      ".day{margin-bottom:16px}",
      ".dayhd{font-size:14px;font-weight:600;margin-bottom:8px}",
      ".slots{display:flex;flex-wrap:wrap;gap:8px}",
      ".slot{border:1px solid #d6d6de;background:#fff;color:#111;border-radius:10px;",
      "padding:8px 12px;font-size:14px;cursor:pointer;min-width:84px}",
      ".slot:hover{border-color:" + accent + "}",
      ".slot.on{background:" + accent + ";border-color:" + accent + ";color:#fff}",
      ".more{border:0;background:none;color:" + accent + ";font-size:14px;",
      "cursor:pointer;padding:4px 0;text-decoration:underline}",
      ".sel{border:1px solid #d6d6de;border-radius:12px;padding:12px 14px;",
      "margin-bottom:14px;font-size:14px}",
      ".sel b{display:block;font-size:15px;margin-top:2px}",
      ".row{margin-bottom:14px}",
      "label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}",
      ".req{color:" + accent + "}",
      "input{width:100%;padding:10px 12px;border:1px solid #d6d6de;border-radius:10px;",
      "font-size:16px;background:#fff;color:#111}",
      "input:focus{outline:2px solid " + accent + "40;border-color:" + accent + "}",
      "button.go{background:" + accent + ";color:#fff;border:0;border-radius:10px;",
      "padding:11px 20px;font-size:15px;font-weight:600;cursor:pointer}",
      "button.go[disabled]{opacity:.6;cursor:default}",
      "button.back{border:0;background:none;color:#5b5b66;font-size:14px;",
      "cursor:pointer;padding:11px 8px;text-decoration:underline}",
      ".actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
      ".err{color:#b42318;font-size:13px;margin-top:5px}",
      ".note{padding:14px 16px;border-radius:12px;font-size:15px;line-height:1.5}",
      ".ok{background:#ecfdf3;color:#05603a;border:1px solid #abefc6}",
      ".bad{background:#fef3f2;color:#b42318;border:1px solid #fecdca}",
      ".warn{background:#fffaeb;color:#93370d;border:1px solid #fedf89;",
      "font-size:14px;padding:10px 12px;border-radius:10px;margin-bottom:14px}",
      ".muted{color:#5b5b66;font-size:14px}",
      "@media(prefers-color-scheme:dark){.bcb{color:#eee}",
      ".tz,.muted,button.back{color:#a3a3ae}",
      ".slot{background:#15151b;border-color:#33333d;color:#eee}",
      ".sel{border-color:#33333d}",
      "input{background:#15151b;border-color:#33333d;color:#eee}",
      ".ok{background:#052e1f;color:#a6f4c5;border-color:#074d31}",
      ".bad{background:#2e0d0b;color:#fda29b;border-color:#5b1a15}",
      ".warn{background:#2e1c05;color:#fedf89;border-color:#5b3a0f}}"
    ].join("");
  }

  style.textContent = css("#4f46e5");

  function note(cls, text) {
    wrap.innerHTML = "";
    var el = document.createElement("div");
    el.className = "note " + cls;
    el.setAttribute("role", cls === "ok" ? "status" : "alert");
    el.textContent = text;
    wrap.appendChild(el);
  }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------

  var cfg = null;          // the availability payload
  var chosen = null;       // { startIso, endIso } once a visitor picks one
  var showAllDays = false; // "show more dates" toggle
  var DAYS_SHOWN = 5;
  var banner = "";         // a transient explanation above the picker

  function urlFor(path) {
    return (
      origin +
      "/api/bookings/" +
      encodeURIComponent(bookingId) +
      path +
      "?id=" +
      encodeURIComponent(bookingId) +
      "&t=" +
      encodeURIComponent(token)
    );
  }

  function groupByDay(slots) {
    var order = [];
    var byKey = {};
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      var d = new Date(s.startIso);
      if (isNaN(d.getTime())) continue;
      var key = localDayKey(d);
      if (!byKey[key]) {
        byKey[key] = { date: d, slots: [] };
        order.push(key);
      }
      byKey[key].slots.push({ slot: s, date: d });
    }
    return order.map(function (k) { return byKey[k]; });
  }

  // ---------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------

  function renderPicker() {
    wrap.innerHTML = "";

    if (banner) {
      var warn = document.createElement("div");
      warn.className = "warn";
      warn.setAttribute("role", "alert");
      warn.textContent = banner;
      wrap.appendChild(warn);
    }

    var tz = document.createElement("div");
    tz.className = "tz";
    tz.textContent = timezoneLine();
    wrap.appendChild(tz);

    var days = groupByDay(cfg.slots || []);
    if (!days.length) {
      var empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent =
        "There are no times available at the moment. Please check back later, " +
        "or get in touch to arrange a time directly.";
      wrap.appendChild(empty);
      return;
    }

    var visible = showAllDays ? days : days.slice(0, DAYS_SHOWN);
    visible.forEach(function (group) {
      var block = document.createElement("div");
      block.className = "day";

      var hd = document.createElement("div");
      hd.className = "dayhd";
      hd.textContent = fmtDayHeading(group.date);
      block.appendChild(hd);

      var list = document.createElement("div");
      list.className = "slots";
      group.slots.forEach(function (entry) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.textContent = fmtTime(entry.date);
        // The full local date and time for anyone using a screen reader, who
        // would otherwise hear a bare "10:30" with no day attached to it.
        b.setAttribute("aria-label", fmtFull(entry.date));
        b.addEventListener("click", function () {
          chosen = entry.slot;
          banner = "";
          renderForm();
        });
        list.appendChild(b);
      });
      block.appendChild(list);
      wrap.appendChild(block);
    });

    if (!showAllDays && days.length > DAYS_SHOWN) {
      var more = document.createElement("button");
      more.type = "button";
      more.className = "more";
      more.textContent = "Show more dates";
      more.addEventListener("click", function () {
        showAllDays = true;
        renderPicker();
      });
      wrap.appendChild(more);
    }
  }

  function renderForm() {
    wrap.innerHTML = "";
    var start = new Date(chosen.startIso);

    var sel = document.createElement("div");
    sel.className = "sel";
    var lead = document.createElement("span");
    lead.className = "muted";
    lead.textContent = "Your appointment";
    var when = document.createElement("b");
    when.textContent = fmtFull(start);
    var zone = document.createElement("span");
    zone.className = "muted";
    zone.textContent = timezoneLine();
    sel.appendChild(lead);
    sel.appendChild(when);
    sel.appendChild(zone);
    wrap.appendChild(sel);

    var form = document.createElement("form");
    form.setAttribute("novalidate", "novalidate");

    function textRow(id, labelText, type, autocomplete) {
      var row = document.createElement("div");
      row.className = "row";
      var label = document.createElement("label");
      label.setAttribute("for", id);
      label.textContent = labelText;
      var star = document.createElement("span");
      star.className = "req";
      star.textContent = " *";
      label.appendChild(star);
      var input = document.createElement("input");
      input.id = id;
      input.type = type;
      input.required = true;
      input.autocomplete = autocomplete;
      row.appendChild(label);
      row.appendChild(input);
      form.appendChild(row);
      return input;
    }

    var nameInput = textRow("bcb_name", "Your name", "text", "name");
    var emailInput = textRow("bcb_email", "Email address", "email", "email");

    var errBox = document.createElement("div");
    errBox.className = "err";
    errBox.setAttribute("role", "alert");
    form.appendChild(errBox);

    var actions = document.createElement("div");
    actions.className = "actions";
    var btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "go";
    btn.textContent =
      (cfg.appearance && cfg.appearance.buttonText) || "Confirm booking";
    var back = document.createElement("button");
    back.type = "button";
    back.className = "back";
    back.textContent = "Choose a different time";
    back.addEventListener("click", function () {
      chosen = null;
      renderPicker();
    });
    actions.appendChild(btn);
    actions.appendChild(back);
    form.appendChild(actions);
    wrap.appendChild(form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.textContent = "";
      var name = (nameInput.value || "").trim();
      var email = (emailInput.value || "").trim();
      if (!name) { errBox.textContent = "Please enter your name."; return; }
      // No backslash escapes: this file is a template literal and they would be
      // resolved away before the browser saw them. Character classes only.
      if (!/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(email)) {
        errBox.textContent = "Please enter a valid email address.";
        return;
      }
      submit(name, email, btn, errBox);
    });

    nameInput.focus();
  }

  function renderConfirmed(message) {
    var start = chosen ? new Date(chosen.startIso) : null;
    var text = message || (cfg && cfg.confirmationMessage) || "";
    var full = start
      ? "You are booked for " + fmtFull(start) + " (" +
        (localZoneName() || "your local time") + "). " + text
      : text || "Your booking is confirmed.";
    note("ok", full.trim());
  }

  // ---------------------------------------------------------------------
  // Network
  // ---------------------------------------------------------------------

  /**
   * A refusal a visitor can do something about.
   *
   * Every branch names the actual obstacle and, where the visitor has any move
   * available, states it. "Something went wrong" is never enough on a booking
   * page: the visitor's alternative is to give up, and the site owner never
   * finds out that they did.
   */
  function refusal(status, payload) {
    var code = (payload && payload.code) || "";
    if (status === 409 || code === "SLOT_TAKEN") {
      return "slot-taken";
    }
    if (status === 402 || code === "OWNER_OUT_OF_CREDITS") {
      return (
        "Online booking is temporarily unavailable for this business. Please " +
        "contact them directly to arrange a time."
      );
    }
    if (status === 403 || code === "ORIGIN_NOT_ALLOWED") {
      console.error("[bitecodes-bookings] " + explainFailure());
      return (
        "Online booking is not enabled on this website. Please contact the " +
        "business directly to arrange a time."
      );
    }
    if (status === 404 || code === "NOT_AVAILABLE") {
      return (
        "This booking page is not available. It may have been paused by its " +
        "owner, or the link may be incomplete. Please contact the business " +
        "directly to arrange a time."
      );
    }
    if (status === 429 || code === "RATE_LIMITED") {
      return "Too many attempts just now. Please wait a moment and try again.";
    }
    if (status === 422 && payload && payload.message) {
      return payload.message;
    }
    return (payload && payload.message) || "Something went wrong. Please try again.";
  }

  function load(onDone) {
    fetch(urlFor("/availability"))
      .then(function (r) {
        // The parse is guarded separately from the request: an upstream error
        // page is not JSON, and letting that reject would send the visitor down
        // the "your origin was refused" path, which would be a lie.
        return r.json()
          .catch(function () { return null; })
          .then(function (p) { return { status: r.status, ok: r.ok, payload: p }; });
      })
      .then(function (res) {
        if (!res.ok || !res.payload || !res.payload.ok) {
          var why = refusal(res.status, res.payload);
          note("bad", why === "slot-taken"
            ? "That time has just been taken. Please choose another."
            : why);
          return;
        }
        cfg = res.payload.data;
        style.textContent = css(cfg.appearance && cfg.appearance.primaryColor);
        if (onDone) { onDone(); return; }
        renderPicker();
      })
      .catch(function () {
        // fetch rejected with no readable response — which is what a refused
        // origin looks like from inside the page, because the server withholds
        // the CORS header along with its explanation.
        console.error("[bitecodes-bookings] " + explainFailure());
        note(
          "bad",
          location.protocol === "file:"
            ? "This demo page needs to be served over http, not opened from a file. See the console."
            : "Booking is unavailable on this page right now. Please contact the business directly to arrange a time."
        );
      });
  }

  function submit(name, email, btn, errBox) {
    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = "Booking…";

    // The id and token go in the QUERY STRING as well as the body, and this is
    // load-bearing rather than redundant.
    //
    // A cross-origin POST with a JSON content type triggers a CORS preflight, and
    // a preflight carries no body — so OPTIONS cannot know which booking page is
    // being addressed unless the URL tells it. Without these parameters the
    // handler resolves no configuration, grants no Access-Control-Allow-Origin,
    // and the browser blocks the real request before it is ever sent. Every embed
    // then fails with an opaque CORS error that says nothing about the cause.
    //
    // It hides on our own site, because bitecodes.com is the SAME ORIGIN as the
    // API and browsers skip CORS entirely there. The widget works in the demo and
    // cannot work on a single customer's site — which is the entire product. It
    // has happened once already; hence this comment and the same parameters on
    // the availability fetch above.
    var payload = {
      bookingId: bookingId,
      publicToken: token,
      startIso: chosen.startIso,
      name: name,
      email: email,
      phone: null,
      notes: null,
      timezone: localZoneName() || null
    };

    fetch(urlFor("/book"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return r.json()
          .catch(function () { return {}; })
          .then(function (p) { return { status: r.status, ok: r.ok, payload: p }; });
      })
      .then(function (res) {
        if (res.ok && res.payload && res.payload.ok !== false) {
          renderConfirmed(res.payload.message);
          return;
        }
        var why = refusal(res.status, res.payload);
        if (why === "slot-taken") {
          // Somebody else won the race for this instant. Sending the visitor back
          // to a stale list would let them lose it a second time, so the list is
          // refetched before they choose again.
          chosen = null;
          banner =
            "Sorry — that time was booked by someone else a moment ago. " +
            "Here are the times that are still free. Please choose another.";
          load(function () { renderPicker(); });
          return;
        }
        btn.disabled = false;
        btn.textContent = original;
        errBox.textContent = why;
      })
      .catch(function () {
        console.error("[bitecodes-bookings] " + explainFailure());
        btn.disabled = false;
        btn.textContent = original;
        errBox.textContent =
          location.protocol === "file:"
            ? "This demo page needs to be served over http, not opened from a file. See the console."
            : "We could not reach the booking service. Please try again.";
      });
  }

  var loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Loading available times…";
  wrap.appendChild(loading);
  load(null);
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Short in the browser, long at the edge — see the note in widget.js. A
      // loader embedded on sites we do not control is the one asset nobody can
      // bust for us, so a long browser TTL delays every fix by exactly that long.
      "Cache-Control":
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
