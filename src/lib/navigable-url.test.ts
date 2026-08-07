import { describe, expect, it } from "vitest";
import { isNavigableHttpUrl } from "@/lib/navigable-url";

/**
 * These are a security boundary, not a formatting preference.
 *
 * A form's `redirectUrl` is assigned to `location.href`, and on the hosted page
 * at `/form/[formId]` that happens on our own origin — the same one as `/admin`.
 * `zod`'s `.url()` accepts every scheme in the rejected list below, which is why
 * this check exists separately from validation.
 */
describe("isNavigableHttpUrl", () => {
  it("accepts absolute http and https URLs", () => {
    for (const url of [
      "https://example.com",
      "http://example.com/thanks",
      "https://example.com/thanks?ref=form#top",
      "https://sub.example.co.uk:8443/a/b",
    ]) {
      expect(isNavigableHttpUrl(url)).toBe(true);
    }
  });

  it("rejects every script-executing scheme", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox(1)",
      "blob:https://example.com/uuid",
    ]) {
      expect(isNavigableHttpUrl(url), url).toBe(false);
    }
  });

  it("rejects other non-web schemes that would not navigate a page", () => {
    for (const url of [
      "file:///etc/passwd",
      "mailto:a@b.com",
      "tel:+911234567890",
      "ftp://example.com/x",
      "chrome://settings",
    ]) {
      expect(isNavigableHttpUrl(url), url).toBe(false);
    }
  });

  it("rejects relative and malformed values", () => {
    // A relative target would resolve against whichever site embedded the form,
    // so it is ambiguous by construction rather than merely unusual.
    for (const url of [
      "/thanks",
      "thanks",
      "//example.com",
      "",
      "   ",
      "not a url",
      "http://",
    ]) {
      expect(isNavigableHttpUrl(url), JSON.stringify(url)).toBe(false);
    }
  });
});
