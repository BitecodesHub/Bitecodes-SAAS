import { describe, expect, it } from "vitest";
import {
  emailDomain,
  isDeliverableEmail,
  isNeverContactAddress,
  isRoleAddress,
  matchesSuppression,
  normalizeEmail,
  normalizeSuppressionEntry,
} from "@/lib/email/address";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Someone@Example.COM \n")).toBe(
      "someone@example.com",
    );
  });

  it("preserves plus tags and dots", () => {
    // Stripping these is provider-specific; applying Gmail's rules to another
    // domain would suppress a different person's address.
    expect(normalizeEmail("A.B+tag@Example.com")).toBe("a.b+tag@example.com");
  });
});

describe("emailDomain", () => {
  it("returns the domain", () => {
    expect(emailDomain("Someone@Example.com")).toBe("example.com");
    expect(emailDomain("a@sub.example.co.uk")).toBe("sub.example.co.uk");
  });

  it("uses the last @ so quoted local parts do not confuse it", () => {
    expect(emailDomain('"weird@local"@example.com')).toBe("example.com");
  });

  it("returns null for malformed input", () => {
    for (const value of ["", "no-at-sign", "@example.com", "a@", "@"]) {
      expect(emailDomain(value), value).toBeNull();
    }
  });
});

describe("isDeliverableEmail", () => {
  it("accepts ordinary addresses", () => {
    for (const value of [
      "a@bc.com",
      "someone@example.com",
      "first.last+tag@sub.example.co.uk",
      "info@rossi-cafe.it",
      "x_y@example.museum",
    ]) {
      expect(isDeliverableEmail(value), value).toBe(true);
    }
  });

  it("rejects addresses no provider would deliver to", () => {
    for (const value of [
      "",
      "a",
      "a@",
      "@b.com",
      "a@b",
      "a@b.c",
      "a b@example.com",
      "a@exam ple.com",
      "a@@example.com",
      "a@-example.com",
      "a@example-.com",
      ".a@example.com",
      "a.@example.com",
      "a..b@example.com",
      `${"a".repeat(65)}@example.com`,
      `a@${"b".repeat(250)}.com`,
    ]) {
      expect(isDeliverableEmail(value), value).toBe(false);
    }
  });

  it("normalises before validating", () => {
    expect(isDeliverableEmail("  Someone@Example.COM  ")).toBe(true);
  });
});

describe("isRoleAddress", () => {
  it("recognises shared mailboxes", () => {
    for (const local of ["info", "contact", "hello", "sales", "bookings"]) {
      expect(isRoleAddress(`${local}@example.com`), local).toBe(true);
    }
  });

  it("does not flag a personal address", () => {
    expect(isRoleAddress("ismail@example.com")).toBe(false);
    expect(isRoleAddress("information@example.com")).toBe(false);
  });
});

describe("isNeverContactAddress", () => {
  it("blocks automated and abuse mailboxes", () => {
    for (const local of [
      "abuse",
      "postmaster",
      "noreply",
      "no-reply",
      "donotreply",
      "mailer-daemon",
      "bounces",
      "security",
      "dmarc",
    ]) {
      expect(isNeverContactAddress(`${local}@example.com`), local).toBe(true);
    }
  });

  it("blocks prefixed variants", () => {
    for (const local of [
      "noreply-orders",
      "no-reply.support",
      "do-not-reply_billing",
      "bounce-handler",
    ]) {
      expect(isNeverContactAddress(`${local}@example.com`), local).toBe(true);
    }
  });

  it("allows a legitimate business address", () => {
    for (const local of ["info", "hello", "ismail", "reply", "replies"]) {
      expect(isNeverContactAddress(`${local}@example.com`), local).toBe(false);
    }
  });
});

describe("matchesSuppression", () => {
  it("matches an exact address regardless of case", () => {
    expect(
      matchesSuppression("Someone@Example.com", ["someone@example.com"]),
    ).toBe(true);
    expect(
      matchesSuppression("someone@example.com", ["SOMEONE@EXAMPLE.COM"]),
    ).toBe(true);
  });

  it("does not match a different address at the same domain", () => {
    expect(
      matchesSuppression("other@example.com", ["someone@example.com"]),
    ).toBe(false);
  });

  it("matches a whole domain via an @domain entry", () => {
    // How "remove our company" from one person is honoured company-wide.
    expect(matchesSuppression("anyone@example.com", ["@example.com"])).toBe(
      true,
    );
    expect(matchesSuppression("other@example.com", ["@example.com"])).toBe(
      true,
    );
  });

  it("does not let a domain entry match a subdomain or superdomain", () => {
    expect(matchesSuppression("a@sub.example.com", ["@example.com"])).toBe(
      false,
    );
    expect(matchesSuppression("a@example.com", ["@sub.example.com"])).toBe(
      false,
    );
    expect(matchesSuppression("a@notexample.com", ["@example.com"])).toBe(
      false,
    );
  });

  it("handles an empty list and empty entries", () => {
    expect(matchesSuppression("a@example.com", [])).toBe(false);
    expect(matchesSuppression("a@example.com", ["", "   "])).toBe(false);
  });

  it("scans the whole list, not just the first entry", () => {
    expect(
      matchesSuppression("target@example.com", [
        "other@example.com",
        "@another.com",
        "target@example.com",
      ]),
    ).toBe(true);
  });
});

describe("normalizeSuppressionEntry", () => {
  it("normalises an address", () => {
    expect(normalizeSuppressionEntry("  Someone@Example.com ")).toBe(
      "someone@example.com",
    );
  });

  it("normalises a domain entry", () => {
    expect(normalizeSuppressionEntry(" @Example.COM ")).toBe("@example.com");
    expect(normalizeSuppressionEntry("@sub.example.co.uk")).toBe(
      "@sub.example.co.uk",
    );
  });

  it("accepts a bare domain, which is what the field asks for", () => {
    // The input's placeholder offers "someone@example.com or example.com", so
    // the bare form has to work or the field contradicts itself.
    expect(normalizeSuppressionEntry("Example.com")).toBe("@example.com");
    expect(normalizeSuppressionEntry(" sub.example.co.uk ")).toBe(
      "@sub.example.co.uk",
    );
  });

  it("rejects unusable entries so the list cannot be poisoned", () => {
    for (const value of ["", "  ", "@", "@nodot", "not-an-email", "a@b"]) {
      expect(normalizeSuppressionEntry(value), value).toBeNull();
    }
  });
});
