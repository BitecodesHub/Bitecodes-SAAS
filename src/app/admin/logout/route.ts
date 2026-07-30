import { NextResponse, type NextRequest } from "next/server";
import { destroyCurrentSession } from "@/lib/server/auth/session";

/**
 * GET sign-out.
 *
 * There is a `logoutAction` Server Action for the button in the shell, but a
 * link cannot POST, and one case needs a link: a session revoked elsewhere (a
 * password reset, an account disabled) leaves the cookie in place but invalid.
 * The proxy sees that cookie and bounces `/admin/login` back to the dashboard,
 * which 401s — so the "Sign in" link on the 401 screen could never reach the
 * form. Clearing the cookie here first breaks that loop.
 *
 * Safe as a GET because it only ends the caller's own session: the worst a
 * forged link can do is sign you out.
 */
export async function GET(request: NextRequest) {
  await destroyCurrentSession();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
