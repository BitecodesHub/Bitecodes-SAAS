import { describe, expect, it } from "vitest";
import {
  harvestEmail,
  isExcludedEmail,
} from "@/lib/server/jobs/handlers/prospect-enrich";

const SITE = "https://rossi.example.com/";

describe("harvestEmail", () => {
  it("reads an address from a mailto link", () => {
    expect(
      harvestEmail(
        '<a href="mailto:info@rossi.example.com">Email us</a>',
        SITE,
      ),
    ).toBe("info@rossi.example.com");
  });

  it("ignores an address that only appears as page text", () => {
    // Scraping anything address-shaped off a page yields image filenames,
    // tracking pixels, and other people's addresses.
    expect(
      harvestEmail("<p>Write to info@rossi.example.com</p>", SITE),
    ).toBeNull();
  });

  it("strips a mailto query string", () => {
    expect(
      harvestEmail(
        '<a href="mailto:info@rossi.example.com?subject=Hello%20there">Mail</a>',
        SITE,
      ),
    ).toBe("info@rossi.example.com");
  });

  it("decodes a percent-encoded address", () => {
    expect(
      harvestEmail('<a href="mailto:info%40rossi.example.com">Mail</a>', SITE),
    ).toBe("info@rossi.example.com");
  });

  it("prefers an address on the site's own domain", () => {
    // Emailing the web agency credited in the footer instead of the business is
    // worse than sending nothing.
    const html = `
      <a href="mailto:studio@webagency.example">Site by Web Agency</a>
      <a href="mailto:hello@rossi.example.com">Contact us</a>`;
    expect(harvestEmail(html, SITE)).toBe("hello@rossi.example.com");
  });

  it("ignores www when matching the site domain", () => {
    expect(
      harvestEmail(
        '<a href="mailto:info@rossi.example.com">Mail</a>',
        "https://www.rossi.example.com/contact",
      ),
    ).toBe("info@rossi.example.com");
  });

  it("prefers a role address over a personal one", () => {
    const html = `
      <a href="mailto:giovanni@rossi.example.com">Giovanni</a>
      <a href="mailto:info@rossi.example.com">General</a>`;
    expect(harvestEmail(html, SITE)).toBe("info@rossi.example.com");
  });

  it("follows the documented role priority order", () => {
    const html = `
      <a href="mailto:admin@rossi.example.com">a</a>
      <a href="mailto:hello@rossi.example.com">b</a>`;
    expect(harvestEmail(html, SITE)).toBe("hello@rossi.example.com");
  });

  it("falls back to an off-domain address when there is no better option", () => {
    expect(
      harvestEmail('<a href="mailto:rossi.cafe@gmail.com">Mail</a>', SITE),
    ).toBe("rossi.cafe@gmail.com");
  });

  it("skips platform and no-reply boilerplate", () => {
    const html = `
      <a href="mailto:noreply@rossi.example.com">x</a>
      <a href="mailto:webmaster@rossi.example.com">y</a>
      <a href="mailto:hello@rossi.example.com">z</a>`;
    expect(harvestEmail(html, SITE)).toBe("hello@rossi.example.com");
  });

  it("returns null when every candidate is excluded", () => {
    expect(
      harvestEmail('<a href="mailto:no-reply@wix.com">x</a>', SITE),
    ).toBeNull();
  });

  it("returns null for a page with no mailto links", () => {
    expect(harvestEmail("<html><body>Rossi</body></html>", SITE)).toBeNull();
  });

  it("rejects a malformed address rather than storing it", () => {
    expect(
      harvestEmail('<a href="mailto:not-an-email">x</a>', SITE),
    ).toBeNull();
    expect(
      harvestEmail('<a href="mailto:@example.com">x</a>', SITE),
    ).toBeNull();
  });

  it("de-duplicates the same address repeated across the page", () => {
    const html = Array.from(
      { length: 50 },
      () => '<a href="mailto:info@rossi.example.com">Mail</a>',
    ).join("");
    expect(harvestEmail(html, SITE)).toBe("info@rossi.example.com");
  });

  it("tolerates a malformed final url", () => {
    expect(
      harvestEmail(
        '<a href="mailto:info@rossi.example.com">x</a>',
        "not a url",
      ),
    ).toBe("info@rossi.example.com");
  });

  it("only scans a bounded prefix of a very large page", () => {
    // The address sits past the scan window, so it must not be found — this is
    // the bound working, not a bug.
    const filler = "<p>x</p>".repeat(60_000);
    const html = `${filler}<a href="mailto:late@rossi.example.com">Mail</a>`;
    expect(html.length).toBeGreaterThan(300_000);
    expect(harvestEmail(html, SITE)).toBeNull();
  });

  it("finds an address inside the scan window of a large page", () => {
    const html = `<a href="mailto:early@rossi.example.com">Mail</a>${"<p>x</p>".repeat(60_000)}`;
    expect(harvestEmail(html, SITE)).toBe("early@rossi.example.com");
  });
});

describe("isExcludedEmail", () => {
  it("excludes no-reply and platform senders", () => {
    for (const email of [
      "noreply@rossi.example.com",
      "no-reply@rossi.example.com",
      "donotreply@rossi.example.com",
      "postmaster@rossi.example.com",
      "abuse@rossi.example.com",
      "webmaster@rossi.example.com",
      "a@example.com",
      "support@wix.com",
      "help@shopify.com",
    ]) {
      expect(isExcludedEmail(email), email).toBe(true);
    }
  });

  it("allows ordinary business addresses", () => {
    for (const email of [
      "info@rossi.example.com",
      "hello@rossi.example.com",
      "giovanni@rossi.example.com",
      "rossi.cafe@gmail.com",
    ]) {
      expect(isExcludedEmail(email), email).toBe(false);
    }
  });
});
