import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/server/auth/next-path";

describe("safeNextPath", () => {
  it("keeps a legitimate admin path", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/admin/customers")).toBe("/admin/customers");
    expect(safeNextPath("/admin/leads?status=new&page=2")).toBe(
      "/admin/leads?status=new&page=2",
    );
    expect(safeNextPath("/admin?tab=queue")).toBe("/admin?tab=queue");
  });

  it("defaults to the dashboard when absent", () => {
    expect(safeNextPath(undefined)).toBe("/admin");
    expect(safeNextPath(null)).toBe("/admin");
    expect(safeNextPath("")).toBe("/admin");
  });

  it("rejects absolute URLs", () => {
    for (const value of [
      "https://evil.example/admin",
      "http://evil.example",
      "javascript:alert(1)",
      "data:text/html,x",
      "mailto:a@b.com",
    ]) {
      expect(safeNextPath(value), value).toBe("/admin");
    }
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNextPath("//evil.example")).toBe("/admin");
    expect(safeNextPath("//evil.example/admin")).toBe("/admin");
  });

  it("rejects backslash variants that some agents normalise", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/admin");
    expect(safeNextPath("/admin\\..\\..\\evil")).toBe("/admin");
    expect(safeNextPath("/admin/\\/evil.example")).toBe("/admin");
  });

  it("rejects paths outside the admin area", () => {
    for (const value of ["/", "/contact", "/api/cron/run", "/blog"]) {
      expect(safeNextPath(value), value).toBe("/admin");
    }
  });

  it("anchors the prefix on a segment boundary", () => {
    // A bare `startsWith("/admin")` would let these through.
    expect(safeNextPath("/adminx/evil")).toBe("/admin");
    expect(safeNextPath("/administrator")).toBe("/admin");
    expect(safeNextPath("/admin-panel/x")).toBe("/admin");
  });

  it("never returns anything but a relative admin path", () => {
    const inputs = [
      undefined,
      "",
      "/",
      "/admin",
      "/admin/x",
      "//evil",
      "https://evil",
      "/adminx",
      "\\/evil",
      "/admin\\x",
      "javascript:1",
    ];
    for (const input of inputs) {
      const result = safeNextPath(input);
      expect(result.startsWith("/admin"), JSON.stringify(input)).toBe(true);
      expect(result.startsWith("//"), JSON.stringify(input)).toBe(false);
      expect(result.includes("\\"), JSON.stringify(input)).toBe(false);
    }
  });
});

describe("safeNextPath in the customer area", () => {
  it("keeps a legitimate customer path", () => {
    expect(safeNextPath("/app", "/app")).toBe("/app");
    expect(safeNextPath("/app/chatbots", "/app")).toBe("/app/chatbots");
    expect(safeNextPath("/app/billing?pack=x", "/app")).toBe(
      "/app/billing?pack=x",
    );
  });

  it("defaults to the customer dashboard when absent", () => {
    expect(safeNextPath(undefined, "/app")).toBe("/app");
    expect(safeNextPath("", "/app")).toBe("/app");
  });

  it("anchors the prefix so /apple is not /app", () => {
    // The customer area is the one prefix with a plausible English word after
    // it, so this is the case a bare startsWith would actually get wrong.
    expect(safeNextPath("/apple/evil", "/app")).toBe("/app");
    expect(safeNextPath("/application", "/app")).toBe("/app");
    expect(safeNextPath("/app-store/x", "/app")).toBe("/app");
  });

  it("refuses to send a customer into the admin panel", () => {
    // A customer holds no `view` capability, so /admin would refuse them
    // anyway; keeping the redirect in-area means they see their dashboard
    // rather than a 403 immediately after a successful sign-in.
    expect(safeNextPath("/admin", "/app")).toBe("/app");
    expect(safeNextPath("/admin/users", "/app")).toBe("/app");
  });

  it("refuses to send a staff member into the customer area", () => {
    expect(safeNextPath("/app", "/admin")).toBe("/admin");
    expect(safeNextPath("/app/billing", "/admin")).toBe("/admin");
  });

  it("rejects every off-site shape in the customer area too", () => {
    for (const value of [
      "https://evil.example/app",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/",
      "/contact",
    ]) {
      expect(safeNextPath(value, "/app"), value).toBe("/app");
    }
  });
});
