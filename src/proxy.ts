import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy — what Next.js called Middleware before version 16.
 *
 * Its only job is an **optimistic** redirect: send visitors with no session
 * cookie to the sign-in page instead of rendering the admin shell for them.
 *
 * This is not a security boundary, and must not be treated as one. It checks
 * only that the cookie *exists* — never that it is valid — because proxy runs on
 * every request including prefetches, and a database lookup here would put a
 * query on the hot path of the entire site. The real check is
 * `requireAdminSession()` in `lib/server/auth/dal.ts`, which runs next to the
 * data it protects.
 *
 * Concretely: forging `bc_admin=anything` gets past this file and no further.
 */

const SESSION_COOKIE = "bc_admin";

/** Reachable without a session: the sign-in page, password reset, and sign-out. */
const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/logout",
  "/admin/forgot-password",
  "/admin/reset-password",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isPublicAdminPath) {
    // Already signed in: skip the sign-in form rather than showing a form that
    // immediately bounces to the dashboard.
    if (hasSessionCookie && pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL("/admin/login", request.url);
    // Remember where they were headed, so sign-in returns them there. Only the
    // path and query are carried, never an absolute URL — accepting one would
    // make this an open redirect.
    if (pathname !== "/admin") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Scoped to `/admin` only. The public marketing site is static and has no
   * session concept, so running proxy across it would add work to every request
   * for no benefit.
   */
  matcher: ["/admin", "/admin/:path*"],
};
