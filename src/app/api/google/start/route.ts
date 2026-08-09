import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_FLOW_COOKIE,
  encodeFlowCookie,
  flowCookieOptions,
} from "@/lib/server/auth/google-flow-cookie";
import {
  buildAuthorizationUrl,
  createFlowSecrets,
  isGoogleSignInConfigured,
} from "@/lib/server/auth/google-oauth";
import { safeNextPath } from "@/lib/server/auth/next-path";

export const dynamic = "force-dynamic";

/**
 * `GET /api/google/start` — begins Google sign-in.
 *
 * A GET because it is reached by following a link, and it changes nothing on
 * the server: the only state it creates is a short-lived cookie in the caller's
 * own browser. Nothing here is authenticated, and nothing here needs to be —
 * anyone may begin a sign-in.
 *
 * The three secrets are minted here and remembered ONLY in that cookie:
 *
 *  - `state` is echoed back by Google and compared, which is what stops a third
 *    party from feeding us an authorization code of their own and signing the
 *    victim into the attacker's account.
 *  - `nonce` goes into the ID token and is compared, which stops a token
 *    captured elsewhere being replayed here.
 *  - `code_verifier` is the PKCE secret; a code intercepted in transit is
 *    useless without it.
 *
 * The cookie is `sameSite: "lax"`, deliberately. `strict` would not be sent on
 * the top-level navigation Google uses to return, so every sign-in would fail
 * the state check. `lax` still blocks the cross-site POSTs that rule exists for.
 */
export async function GET(request: NextRequest) {
  if (!isGoogleSignInConfigured()) {
    // Configuration is missing rather than the caller being wrong, so this is
    // reported as a service state, not as a bad request.
    return NextResponse.redirect(
      new URL("/login?error=google-unavailable", request.url),
    );
  }

  const secrets = createFlowSecrets();
  // Sanitised here rather than on the way back, so a hostile value never even
  // reaches the cookie. `/app` is the destination for everyone this flow can
  // sign in, because Google signs in customers only.
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/app");

  const response = NextResponse.redirect(buildAuthorizationUrl(secrets));
  response.cookies.set(
    GOOGLE_FLOW_COOKIE,
    encodeFlowCookie({ ...secrets, next }),
    flowCookieOptions(),
  );
  return response;
}
