import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy — what Next.js called Middleware before version 16.
 *
 * Its only job is an **optimistic** redirect: send visitors with no session
 * cookie to the sign-in page instead of rendering a signed-in shell for them.
 *
 * This is not a security boundary, and must not be treated as one. It checks
 * only that the cookie *exists* — never that it is valid — because proxy runs on
 * every request including prefetches, and a database lookup here would put a
 * query on the hot path of the entire site. The real check is
 * `requireAdminSession()` in `lib/server/auth/dal.ts`, which runs next to the
 * data it protects.
 *
 * Concretely: forging `bc_admin=anything` gets past this file and no further.
 *
 * Two signed-in areas share one cookie and one session table: `/admin` for staff
 * and `/app` for self-serve customers. They are told apart by capability, not by
 * this file — a customer holds no `view`, so every staff page refuses them on
 * its own terms.
 */

const SESSION_COOKIE = "bc_admin";

/** Reachable without a session: the sign-in page, password reset, and sign-out. */
const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/logout",
  "/admin/forgot-password",
  "/admin/reset",
];

/** The signed-in areas, each with the sign-in page it bounces to. */
const GUARDED_AREAS = [
  { prefix: "/admin", signIn: "/admin/login", publicPaths: PUBLIC_ADMIN_PATHS },
  // The customer sign-in, sign-up and recovery pages live at the site root and
  // are not under `/app`, so this area has no public paths inside it.
  { prefix: "/app", signIn: "/login", publicPaths: [] as string[] },
] as const;

/**
 * `/login` is matched only so this file is on record as leaving it alone; see
 * the note in `proxy` about why a present-but-invalid cookie must not redirect
 * away from a sign-in page.
 */

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const area = GUARDED_AREAS.find(
    (candidate) =>
      pathname === candidate.prefix ||
      pathname.startsWith(`${candidate.prefix}/`),
  );
  if (!area) return NextResponse.next();

  const isPublicPath = area.publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isPublicPath) {
    /*
     * A sign-in page is never redirected away from here, even when a session
     * cookie is present.
     *
     * The tempting shortcut — "already signed in, skip the form" — reads the
     * cookie's presence, and presence is not validity. An expired, revoked, or
     * epoch-busted cookie is still a cookie, so the bounce sent somebody with a
     * dead session to the dashboard, which refused them, whose 401 page offered
     * "Sign in", which bounced them again: a loop with no exit but clearing
     * cookies by hand. It is exactly the person whose session just expired who
     * hits it.
     *
     * The convenience is kept, but decided by the page, which can afford to
     * VALIDATE the session before deciding. See `redirectIfSignedIn`.
     */
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL(area.signIn, request.url);
    // Remember where they were headed, so sign-in returns them there. Only the
    // path and query are carried, never an absolute URL — accepting one would
    // make this an open redirect.
    if (pathname !== area.prefix) {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Scoped to the two signed-in areas, plus `/login` so an already-signed-in
   * visitor is not shown a form they do not need. The rest of the marketing site
   * is static and has no session concept, so running proxy across it would add
   * work to every request for no benefit.
   */
  matcher: ["/admin", "/admin/:path*", "/app", "/app/:path*", "/login"],
};
