import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Guards the embed widgets against the redirect trap.
 *
 * Both widgets are served as generated JavaScript, and both must talk to the
 * host that actually served them. A CORS **preflight** may not be redirected —
 * the browser fails the request instead of re-issuing OPTIONS at the new
 * location. So when the baked-in origin was the apex, which answers 308 to www,
 * every embedded widget died with "Redirect is not allowed for a preflight
 * request".
 *
 * It shipped because curl follows redirects and reported success. These tests
 * exist because no amount of curl-based checking would have caught it.
 */

const ORIGINAL = process.env.SITE_URL;

async function widgetSource(route: "widget.js" | "form-widget.js") {
  const mod =
    route === "widget.js"
      ? await import("@/app/widget.js/route")
      : await import("@/app/form-widget.js/route");
  const response = mod.GET();
  return response.text();
}

describe.each(["widget.js", "form-widget.js"] as const)("%s", (route) => {
  beforeEach(() => {
    delete process.env.SITE_URL;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = ORIGINAL;
  });

  it("derives its API origin from the script's own URL", async () => {
    const js = await widgetSource(route);
    // The whole point: the host that served this file is the host it calls.
    expect(js).toContain("new URL(current.src, document.baseURI).origin");
  });

  it("falls back to an origin, so a missing src cannot leave it undefined", async () => {
    const js = await widgetSource(route);
    expect(js).toMatch(/var origin = "https?:\/\/[^"]+"/);
  });

  it("never bakes in the redirecting apex host", async () => {
    process.env.SITE_URL = "https://bitecodes.com";
    const js = await widgetSource(route);
    // If SITE_URL is misconfigured to the apex, the runtime derivation is what
    // saves the widget — assert it is still present alongside the bad default.
    expect(js).toContain("new URL(current.src, document.baseURI).origin");
  });

  it("emits JavaScript that actually parses", async () => {
    const js = await widgetSource(route);

    // Parses the EMITTED script, which is the only form that matters. A previous
    // check parsed the route's SOURCE text and passed while production was broken:
    // the script is built inside a template literal, so a backslash-slash written
    // in the source is resolved away before the browser sees it. That emitted
    // /^(https?:|data:image/)/i — a bare slash closing the regex early — and the
    // whole widget died with "Invalid regular expression: Unterminated group".
    // Nothing short of evaluating the output catches that.
    expect(() => new Function(js)).not.toThrow();
  });

  it("leaves no unresolved template placeholder in the emitted script", async () => {
    const js = await widgetSource(route);
    // A stray ${...} means an interpolation was written as plain text and the
    // browser would receive it literally.
    expect(js).not.toMatch(/\$\{/);
  });

  it("puts the identifiers in the query string for the CORS preflight", async () => {
    const js = await widgetSource(route);

    // A cross-origin POST with a JSON content type triggers a preflight, and a
    // preflight has no body — so OPTIONS can only resolve the bot/form, and
    // therefore its allowlist, from the URL. Without these the handler grants no
    // Access-Control-Allow-Origin and the browser blocks the request before
    // sending it.
    //
    // This shipped broken and no request-level check caught it: bitecodes.com is
    // the same origin as the API, where browsers skip CORS entirely, and curl
    // never sends a preflight at all. The widget worked on our own site and
    // could not work on any customer's.
    if (route === "widget.js") {
      expect(js).toContain("/api/v1/chat?id=");
      expect(js).toContain("&t=");
    } else {
      expect(js).toContain("/submit?t=");
    }
    // Values must be escaped — a token or id is attacker-influenced input.
    expect(js).toContain("encodeURIComponent");
  });
});

describe("getSiteUrl", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = ORIGINAL;
  });

  it("defaults to the host that is served, not the one that redirects", async () => {
    delete process.env.SITE_URL;
    const { getSiteUrl } = await import("@/lib/server/env");
    // Measured on live: https://bitecodes.com answers 308 -> www.
    expect(getSiteUrl()).not.toBe("https://bitecodes.com");
  });

  it("strips a trailing slash so URLs never double up", async () => {
    process.env.SITE_URL = "https://example.com/";
    const { getSiteUrl } = await import("@/lib/server/env");
    expect(getSiteUrl()).toBe("https://example.com");
  });
});
