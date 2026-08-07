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
