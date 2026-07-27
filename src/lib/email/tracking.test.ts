import { describe, expect, it } from "vitest";
import {
  appendOpenPixel,
  describeTrackedLinks,
  rewriteLinksForTracking,
} from "@/lib/email/tracking";

const makeClickUrl = (destination: string) =>
  `https://bitecodes.com/e/c?t=${encodeURIComponent(destination)}`;

describe("rewriteLinksForTracking", () => {
  it("rewrites an http link", () => {
    const { html, rewritten } = rewriteLinksForTracking(
      '<a href="https://example.com/page">x</a>',
      { makeClickUrl },
    );
    expect(rewritten).toBe(1);
    expect(html).toContain("bitecodes.com/e/c?t=");
    expect(html).not.toContain('href="https://example.com/page"');
  });

  it("handles single-quoted attributes", () => {
    const { rewritten } = rewriteLinksForTracking(
      "<a href='https://example.com/'>x</a>",
      { makeClickUrl },
    );
    expect(rewritten).toBe(1);
  });

  it("preserves the original quote style", () => {
    const { html } = rewriteLinksForTracking(
      "<a href='https://example.com/'>x</a>",
      { makeClickUrl },
    );
    expect(html).toContain("href='https://bitecodes.com/e/c");
  });

  it("rewrites every link, not just the first", () => {
    const { rewritten } = rewriteLinksForTracking(
      '<a href="https://a.com/">a</a><a href="https://b.com/">b</a>',
      { makeClickUrl },
    );
    expect(rewritten).toBe(2);
  });

  it("never rewrites the unsubscribe link", () => {
    // A tracked unsubscribe reads as a dark pattern, and some clients
    // pre-fetch links — which would unsubscribe people who never clicked.
    const html =
      '<a href="https://bitecodes.com/unsubscribe?t=abc">Unsubscribe</a>';
    const result = rewriteLinksForTracking(html, { makeClickUrl });
    expect(result.rewritten).toBe(0);
    expect(result.html).toBe(html);
  });

  it("never rewrites mailto links", () => {
    const html = '<a href="mailto:hello@bitecodes.com">mail us</a>';
    expect(rewriteLinksForTracking(html, { makeClickUrl }).rewritten).toBe(0);
  });

  it("never rewrites dangerous URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "vbscript:x",
    ]) {
      const html = `<a href="${url}">x</a>`;
      const result = rewriteLinksForTracking(html, { makeClickUrl });
      expect(result.rewritten, url).toBe(0);
      // And the dangerous URL is left exactly as-is for the caller's own
      // sanitiser to deal with; tracking is not a sanitiser.
      expect(result.html).toBe(html);
    }
  });

  it("skips fragments and relative URLs", () => {
    for (const url of ["#top", "/relative/path", ""]) {
      const html = `<a href="${url}">x</a>`;
      expect(
        rewriteLinksForTracking(html, { makeClickUrl }).rewritten,
        url,
      ).toBe(0);
    }
  });

  it("honours skipHosts", () => {
    const html = '<a href="https://skip.example.com/x">x</a>';
    expect(
      rewriteLinksForTracking(html, {
        makeClickUrl,
        skipHosts: ["skip.example.com"],
      }).rewritten,
    ).toBe(0);
  });

  it("leaves the link alone when the builder declines", () => {
    const html = '<a href="https://example.com/">x</a>';
    const result = rewriteLinksForTracking(html, { makeClickUrl: () => null });
    expect(result.rewritten).toBe(0);
    expect(result.html).toBe(html);
  });

  it("does not touch non-href attributes", () => {
    const html = '<img src="https://example.com/a.png" alt="x">';
    expect(rewriteLinksForTracking(html, { makeClickUrl }).html).toBe(html);
  });
});

describe("appendOpenPixel", () => {
  const pixel = "https://bitecodes.com/e/o/abc.gif";

  it("inserts the pixel just before </body>", () => {
    const html = "<html><body><p>hi</p></body></html>";
    const result = appendOpenPixel(html, pixel);
    expect(result.indexOf(pixel)).toBeLessThan(result.indexOf("</body>"));
    expect(result).toContain("</body></html>");
  });

  it("appends when there is no body tag", () => {
    const result = appendOpenPixel("<p>hi</p>", pixel);
    expect(result.startsWith("<p>hi</p>")).toBe(true);
    expect(result).toContain(pixel);
  });

  it("uses the last </body> if markup is malformed", () => {
    const html = "<body>a</body><body>b</body>";
    const result = appendOpenPixel(html, pixel);
    expect(result.lastIndexOf(pixel)).toBeLessThan(
      result.lastIndexOf("</body>"),
    );
    expect(result.indexOf("<body>b")).toBeLessThan(result.indexOf(pixel));
  });

  it("marks the pixel as decorative for assistive technology", () => {
    const result = appendOpenPixel("<body></body>", pixel);
    expect(result).toContain('alt=""');
    expect(result).toContain('aria-hidden="true"');
    expect(result).toContain('width="1"');
    expect(result).toContain('height="1"');
  });

  it("refuses an unsafe pixel URL", () => {
    const html = "<body></body>";
    expect(appendOpenPixel(html, "javascript:alert(1)")).toBe(html);
    expect(appendOpenPixel(html, "not a url")).toBe(html);
  });
});

describe("describeTrackedLinks", () => {
  it("lists the safe links in a message", () => {
    expect(
      describeTrackedLinks(
        '<a href="https://a.com/">a</a><a href="mailto:x@y.com">m</a><a href="javascript:1">j</a>',
      ),
    ).toEqual(["https://a.com/", "mailto:x@y.com"]);
  });

  it("returns an empty list when there are none", () => {
    expect(describeTrackedLinks("<p>no links</p>")).toEqual([]);
  });
});
