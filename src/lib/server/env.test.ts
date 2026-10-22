import { afterEach, describe, expect, it } from "vitest";
import {
  getBingSiteVerification,
  getGoogleSiteVerification,
} from "@/lib/server/env";

const saved = {
  google: process.env.GOOGLE_SITE_VERIFICATION,
  bing: process.env.BING_SITE_VERIFICATION,
};

afterEach(() => {
  if (saved.google === undefined) delete process.env.GOOGLE_SITE_VERIFICATION;
  else process.env.GOOGLE_SITE_VERIFICATION = saved.google;
  if (saved.bing === undefined) delete process.env.BING_SITE_VERIFICATION;
  else process.env.BING_SITE_VERIFICATION = saved.bing;
});

describe("site verification tokens", () => {
  it("returns null when unset or blank", () => {
    delete process.env.GOOGLE_SITE_VERIFICATION;
    process.env.BING_SITE_VERIFICATION = "   ";
    expect(getGoogleSiteVerification()).toBeNull();
    expect(getBingSiteVerification()).toBeNull();
  });

  it("returns a trimmed token", () => {
    process.env.GOOGLE_SITE_VERIFICATION = " aBc_123-xyz_TOKEN ";
    process.env.BING_SITE_VERIFICATION = "0123456789ABCDEF0123456789ABCDEF";
    expect(getGoogleSiteVerification()).toBe("aBc_123-xyz_TOKEN");
    expect(getBingSiteVerification()).toBe("0123456789ABCDEF0123456789ABCDEF");
  });

  it("rejects a pasted tag or anything that is not a token", () => {
    process.env.GOOGLE_SITE_VERIFICATION =
      '<meta name="google-site-verification" content="abc12345" />';
    process.env.BING_SITE_VERIFICATION = "short";
    expect(getGoogleSiteVerification()).toBeNull();
    expect(getBingSiteVerification()).toBeNull();
  });
});
