import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * Proxy is an optimistic redirect, not a security boundary — the real check is
 * `requireAdminSession()` next to the data. What is pinned here is the routing
 * behaviour, and above all the rule that a sign-in page is never redirected
 * away from.
 *
 * That rule exists because of a real trap. Proxy can only see whether the
 * session cookie EXISTS; it cannot see whether it is still valid. While it
 * bounced "already signed in" visitors off the sign-in page, somebody whose
 * session had expired was sent to a dashboard that refused them, whose 401 page
 * offered "Sign in", which bounced them again — a loop escapable only by
 * clearing cookies by hand, and hit by exactly the person whose session just
 * expired.
 */

function request(path: string, options: { cookie?: boolean } = {}) {
  const url = `https://www.bitecodes.com${path}`;
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", "bc_admin=whatever-was-in-there");
  return new NextRequest(new Request(url, { headers }));
}

/** The Location header, or null when the request was allowed through. */
function redirectedTo(path: string, options: { cookie?: boolean } = {}) {
  const response = proxy(request(path, options));
  const location = response.headers.get("location");
  return location
    ? new URL(location).pathname + new URL(location).search
    : null;
}

describe("signed-out visitors", () => {
  it("sends them to the sign-in page for the area they asked for", () => {
    expect(redirectedTo("/admin")).toBe("/admin/login");
    expect(redirectedTo("/app")).toBe("/login");
  });

  it("remembers where they were going", () => {
    expect(redirectedTo("/app/billing")).toBe("/login?next=%2Fapp%2Fbilling");
    expect(redirectedTo("/admin/leads")).toBe(
      "/admin/login?next=%2Fadmin%2Fleads",
    );
  });

  it("carries only a path, never an absolute URL", () => {
    // `safeNextPath` is the real guard, but nothing should reach it that this
    // file could have turned into an open redirect on its own.
    const next = redirectedTo("/app/forms?a=1");
    expect(next?.startsWith("/login?next=%2Fapp")).toBe(true);
  });
});

describe("a present but possibly dead session cookie", () => {
  it("never redirects away from a sign-in page", () => {
    // The regression. Each of these once bounced to a dashboard that then
    // refused the request, with no way back to the form.
    expect(redirectedTo("/login", { cookie: true })).toBeNull();
    expect(redirectedTo("/admin/login", { cookie: true })).toBeNull();
  });

  it("still leaves the other public recovery paths alone", () => {
    for (const path of [
      "/admin/logout",
      "/admin/forgot-password",
      "/admin/reset/some-token",
    ]) {
      expect(redirectedTo(path, { cookie: true }), path).toBeNull();
      expect(redirectedTo(path), path).toBeNull();
    }
  });

  it("lets the request into the guarded areas, for the real check to make", () => {
    expect(redirectedTo("/app", { cookie: true })).toBeNull();
    expect(redirectedTo("/admin/users", { cookie: true })).toBeNull();
  });
});

describe("paths outside the guarded areas", () => {
  it("passes them straight through", () => {
    for (const path of ["/", "/pricing", "/signup", "/forms", "/blog/post"]) {
      expect(redirectedTo(path), path).toBeNull();
      expect(redirectedTo(path, { cookie: true }), path).toBeNull();
    }
  });

  it("does not treat a lookalike prefix as a guarded area", () => {
    // `/apple` must not be read as `/app`, and `/administrator` not as `/admin`.
    for (const path of ["/apple", "/application", "/administrator"]) {
      expect(redirectedTo(path), path).toBeNull();
    }
  });
});
