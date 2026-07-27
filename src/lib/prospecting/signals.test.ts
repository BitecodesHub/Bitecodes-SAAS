import { describe, expect, it } from "vitest";
import {
  detectBlog,
  detectContactForm,
  detectCopyrightYear,
  detectPlatform,
  detectResponsive,
  extractSignals,
  unreachableSignals,
} from "@/lib/prospecting/signals";

describe("unreachableSignals", () => {
  it("reports nothing as present", () => {
    const signals = unreachableSignals();
    expect(signals.reachable).toBe(false);
    // Every boolean must be false so a failed fetch can never be read as a
    // feature the site actually has.
    for (const [key, value] of Object.entries(signals)) {
      if (typeof value === "boolean") {
        expect(value, `${key} should be false`).toBe(false);
      }
    }
    expect(signals.platform).toBeNull();
    expect(signals.copyrightYear).toBeNull();
  });
});

describe("detectResponsive", () => {
  it("accepts a standard viewport tag", () => {
    expect(
      detectResponsive(
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
      ),
    ).toBe(true);
  });

  it("accepts reordered attributes and single quotes", () => {
    expect(
      detectResponsive(
        "<meta content='initial-scale=1,width=device-width' name='viewport'/>",
      ),
    ).toBe(true);
  });

  it("accepts unquoted attribute values", () => {
    expect(
      detectResponsive("<meta name=viewport content='width=device-width'>"),
    ).toBe(true);
  });

  it("rejects a fixed-width viewport", () => {
    expect(
      detectResponsive('<meta name="viewport" content="width=1024">'),
    ).toBe(false);
  });

  it("does not credit another meta tag that merely mentions the phrase", () => {
    expect(
      detectResponsive(
        '<meta name="description" content="width=device-width is important">',
      ),
    ).toBe(false);
  });

  it("returns false when there are no meta tags at all", () => {
    expect(detectResponsive("<html><body>hi</body></html>")).toBe(false);
  });
});

describe("detectContactForm", () => {
  it("accepts a form with an email input", () => {
    expect(
      detectContactForm('<form><input type="email" name="e"></form>'),
    ).toBe(true);
  });

  it("accepts a form with a textarea", () => {
    expect(detectContactForm("<form><textarea></textarea></form>")).toBe(true);
  });

  it("accepts a form posting to a contact endpoint", () => {
    expect(
      detectContactForm('<form action="/contact-us"><input name="x"></form>'),
    ).toBe(true);
  });

  it("rejects a bare search form", () => {
    // A site search box is a form but not a way to reach the business.
    expect(
      detectContactForm('<form><input type="search" name="q"></form>'),
    ).toBe(false);
  });

  it("rejects a page with no form", () => {
    expect(detectContactForm('<a href="mailto:a@b.com">mail</a>')).toBe(false);
  });
});

describe("detectBlog", () => {
  it("accepts a blog link", () => {
    expect(detectBlog('<a href="/blog/">Blog</a>')).toBe(true);
    expect(detectBlog('<a href="https://x.com/news">News</a>')).toBe(true);
    expect(detectBlog('<a href="/insights?page=2">Insights</a>')).toBe(true);
  });

  it("rejects a word that merely starts with the same letters", () => {
    expect(detectBlog('<a href="/blogger-outreach">x</a>')).toBe(false);
  });

  it("rejects body copy mentioning a blog with no link", () => {
    expect(detectBlog("<p>Read our blog soon</p>")).toBe(false);
  });
});

describe("detectCopyrightYear", () => {
  it("reads a symbol-prefixed year", () => {
    expect(detectCopyrightYear("<p>© 2016 Rossi</p>")).toBe(2016);
    expect(detectCopyrightYear("<p>&copy; 2019 Rossi</p>")).toBe(2019);
    expect(detectCopyrightYear("<p>Copyright 2021 Rossi</p>")).toBe(2021);
  });

  it("takes the most recent of several", () => {
    expect(detectCopyrightYear("© 2011 ... © 2018")).toBe(2018);
  });

  it("reads the end of a year range, not the start", () => {
    // "© 2015-2026" is a maintained site. Reading 2015 would score it stale and
    // put a false claim into an outreach email.
    expect(detectCopyrightYear("© 2015-2020 Rossi")).toBe(2020);
    expect(detectCopyrightYear("© 2015 – 2020 Rossi")).toBe(2020);
    expect(detectCopyrightYear("&copy; 2015 &ndash; 2020")).toBe(2020);
    expect(detectCopyrightYear("© 2015 to 2020")).toBe(2020);
  });

  it("ignores a future range end but keeps the valid start", () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    expect(detectCopyrightYear(`© 2020-${nextYear} Rossi`)).toBe(2020);
  });

  it("ignores a future year, which is a template placeholder", () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    expect(detectCopyrightYear(`© ${nextYear} Rossi`)).toBeNull();
  });

  it("ignores an implausibly old year", () => {
    expect(detectCopyrightYear("© 1899 Rossi")).toBeNull();
  });

  it("ignores a four-digit number that is not a copyright year", () => {
    expect(detectCopyrightYear("<p>Call 2024 4455</p>")).toBeNull();
  });

  it("returns null when absent", () => {
    expect(detectCopyrightYear("<p>Rossi</p>")).toBeNull();
  });
});

describe("detectPlatform", () => {
  it("identifies builders and CMSes", () => {
    const cases: Array<[string, string]> = [
      ["<script src='//cdn.shopify.com/s/x.js'>", "Shopify"],
      ["<link href='https://static.parastorage.com/a.css'>", "Wix"],
      ["<img src='https://static1.squarespace.com/a.png'>", "Squarespace"],
      ["<script src='/js/webflow.js'>", "Webflow"],
      ["<img src='https://img1.wsimg.com/a.png'>", "GoDaddy Website Builder"],
      ["<link href='/wp-content/themes/x/style.css'>", "WordPress"],
      ["<div id='__next_data__'>", "Next.js"],
    ];
    for (const [html, expected] of cases) {
      expect(detectPlatform(html.toLowerCase())).toBe(expected);
    }
  });

  it("prefers the more specific fingerprint", () => {
    // A WooCommerce store is also WordPress; the commerce fact is the useful one.
    expect(
      detectPlatform("<link href='/wp-content/plugins/woocommerce/x'>"),
    ).toBe("WooCommerce");
  });

  it("returns null for an unrecognised page", () => {
    expect(detectPlatform("<html><body>plain</body></html>")).toBeNull();
  });
});

describe("extractSignals", () => {
  const richHtml = `
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="icon" href="/favicon.ico">
        <meta property="og:title" content="Rossi">
        <script type="application/ld+json">{"@type":"Restaurant"}</script>
        <script src="https://www.googletagmanager.com/gtag/js"></script>
        <script src="https://embed.tawk.to/x/default"></script>
      </head>
      <body>
        <a href="/blog/">Blog</a>
        <a href="https://www.instagram.com/rossi">Instagram</a>
        <a href="https://calendly.com/rossi">Book a table</a>
        <form action="/contact"><input type="email" name="email"><textarea></textarea></form>
        <button>Add to cart</button>
        <footer>© 2017 Rossi</footer>
      </body>
    </html>`;

  it("detects every signal on a fully featured page", () => {
    const signals = extractSignals({
      html: richHtml,
      finalUrl: "https://rossi.example.com/",
      responseTimeMs: 320,
      htmlBytes: 8_000,
    });

    expect(signals).toEqual({
      reachable: true,
      https: true,
      responsive: true,
      responseTimeMs: 320,
      htmlBytes: 8_000,
      hasStructuredData: true,
      hasFavicon: true,
      hasOpenGraph: true,
      hasAnalytics: true,
      hasBooking: true,
      hasEcommerce: true,
      hasChat: true,
      hasBlog: true,
      hasContactForm: true,
      hasSocialLinks: true,
      platform: null,
      copyrightYear: 2017,
    });
  });

  it("reports an empty page as reachable but featureless", () => {
    const signals = extractSignals({
      html: "<html><body>Rossi</body></html>",
      finalUrl: "http://rossi.example.com/",
      responseTimeMs: 4_000,
      htmlBytes: 900,
    });

    expect(signals.reachable).toBe(true);
    expect(signals.https).toBe(false);
    expect(signals.responsive).toBe(false);
    expect(signals.hasBooking).toBe(false);
    expect(signals.hasEcommerce).toBe(false);
    expect(signals.hasContactForm).toBe(false);
    expect(signals.hasAnalytics).toBe(false);
    expect(signals.copyrightYear).toBeNull();
  });

  it("marks http as not https", () => {
    expect(
      extractSignals({ html: "", finalUrl: "http://x.example.com/" }).https,
    ).toBe(false);
  });

  it("treats a missing final url as not https rather than guessing", () => {
    expect(extractSignals({ html: "" }).https).toBe(false);
  });

  it("trusts the passed byte count over the truncated string length", () => {
    // The auditor caps its buffer at 1 MB; measuring the string here would make
    // a 5 MB page look like a 1 MB one.
    expect(
      extractSignals({ html: "<p>x</p>", htmlBytes: 5_000_000 }).htmlBytes,
    ).toBe(5_000_000);
  });

  it("reads the platform from a generator header when the HTML is silent", () => {
    expect(
      extractSignals({
        html: "<html></html>",
        headers: { "x-generator": "Drupal 10" },
      }).platform,
    ).toBe("Drupal");
  });

  it("keeps an unrecognised generator string as intelligence", () => {
    expect(
      extractSignals({
        html: "<html></html>",
        headers: { generator: "SomeCustomCMS 4" },
      }).platform,
    ).toBe("somecustomcms 4");
  });

  it("detects a whatsapp click-to-chat link as chat", () => {
    expect(
      extractSignals({ html: '<a href="https://wa.me/919428767709">Chat</a>' })
        .hasChat,
    ).toBe(true);
  });

  it("completes quickly on a large hostile document", () => {
    // Guards against catastrophic backtracking: a pathological page must not
    // hang the enrichment worker.
    const hostile = `${"<meta ".repeat(20_000)}<div ${"a".repeat(50_000)}>`;
    const started = Date.now();
    extractSignals({ html: hostile });
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
