import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  ADMIN_NAV_ITEMS,
  findActiveNavItem,
} from "@/lib/admin/navigation";
import { CAPABILITIES } from "@/lib/server/auth/roles";

describe("ADMIN_NAV", () => {
  it("has unique hrefs", () => {
    const hrefs = ADMIN_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("keeps every route inside /admin", () => {
    for (const item of ADMIN_NAV_ITEMS) {
      expect(item.href, item.label).toMatch(/^\/admin(\/|$)/);
    }
  });

  it("references only declared capabilities", () => {
    for (const item of ADMIN_NAV_ITEMS) {
      expect(CAPABILITIES, item.label).toContain(item.capability);
    }
  });

  it("labels and describes every entry", () => {
    for (const item of ADMIN_NAV_ITEMS) {
      expect(item.label.length, item.href).toBeGreaterThan(0);
      expect(item.description.length, item.href).toBeGreaterThan(0);
      expect(item.icon.length, item.href).toBeGreaterThan(0);
    }
  });

  it("has no empty sections", () => {
    for (const section of ADMIN_NAV) {
      expect(section.items.length, section.title).toBeGreaterThan(0);
    }
  });

  it("does not mark the dashboard as a prefix match", () => {
    // `/admin` as a prefix would claim every admin route and highlight the
    // dashboard on every page.
    const dashboard = ADMIN_NAV_ITEMS.find((item) => item.href === "/admin");
    expect(dashboard?.matchPrefix).toBeUndefined();
  });
});

describe("findActiveNavItem", () => {
  it("matches an exact path", () => {
    expect(findActiveNavItem("/admin")?.href).toBe("/admin");
    expect(findActiveNavItem("/admin/leads")?.href).toBe("/admin/leads");
  });

  it("matches a child route to its prefix entry", () => {
    expect(findActiveNavItem("/admin/leads/abc123")?.href).toBe("/admin/leads");
    expect(findActiveNavItem("/admin/blog/new")?.href).toBe("/admin/blog");
  });

  it("prefers the longest match", () => {
    // `/admin/customers/discover` is its own entry and must not resolve to the
    // shorter `/admin/customers`.
    expect(findActiveNavItem("/admin/customers/discover")?.href).toBe(
      "/admin/customers/discover",
    );
    expect(findActiveNavItem("/admin/customers/xyz")?.href).toBe(
      "/admin/customers",
    );
  });

  it("does not let the dashboard claim nested routes", () => {
    expect(findActiveNavItem("/admin/seo")?.href).toBe("/admin/seo");
  });

  it("returns null for an unknown path", () => {
    expect(findActiveNavItem("/admin/nonexistent")).toBeNull();
    expect(findActiveNavItem("/")).toBeNull();
    expect(findActiveNavItem("")).toBeNull();
  });

  it("does not match on a partial segment", () => {
    // `/admin/leadsx` must not resolve to `/admin/leads`.
    expect(findActiveNavItem("/admin/leadsx")).toBeNull();
  });
});
