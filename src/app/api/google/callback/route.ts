import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import {
  GOOGLE_FLOW_COOKIE,
  decodeFlowCookie,
} from "@/lib/server/auth/google-flow-cookie";
import { exchangeCodeForIdentity } from "@/lib/server/auth/google-oauth";
import { signInWithGoogle } from "@/lib/server/auth/google-account";
import {
  SESSION_COOKIE,
  issueAdminSession,
  sessionCookieOptions,
} from "@/lib/server/auth/session";
import { safeNextPath } from "@/lib/server/auth/next-path";
import { safeCompare } from "@/lib/server/crypto";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { kickJobs } from "@/lib/server/jobs/worker";

export const dynamic = "force-dynamic";

/**
 * `GET /api/google/callback` — finishes Google sign-in.
 *
 * Order matters here, and it is: clear the cookie, check the state, spend the
 * code, resolve the account, issue the session. Each step refuses on its own
 * terms and every refusal ends the same way — back to `/login` with a code the
 * page turns into a sentence. Reasons are never put in the URL verbatim,
 * because they would then be attacker-chosen text rendered on our own sign-in
 * page.
 *
 * The flow cookie is deleted on **every** path out, success or failure. It
 * holds a PKCE verifier and a nonce for one attempt; leaving it behind after a
 * failure would let a second attempt reuse them, which is the whole point of
 * their being single-use.
 */

/** Where a failure goes, with a code the sign-in page can explain. */
function failure(request: NextRequest, code: string) {
  const response = NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(code)}`, request.url),
  );
  response.cookies.delete(GOOGLE_FLOW_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const flow = decodeFlowCookie(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value);
  if (!flow) return failure(request, "expired");

  const params = request.nextUrl.searchParams;

  // Google reports a refusal here rather than by failing the request. Somebody
  // pressing "cancel" is not an error and must not read like one.
  const googleError = params.get("error");
  if (googleError) {
    return failure(
      request,
      googleError === "access_denied" ? "cancelled" : "google-error",
    );
  }

  const returnedState = params.get("state") ?? "";
  // Length-independent comparison. The values are compared as hashes so that a
  // length difference cannot be observed through timing either.
  const stateMatches = safeCompare(
    createHash("sha256").update(returnedState).digest("hex"),
    createHash("sha256").update(flow.state).digest("hex"),
  );
  if (!stateMatches) return failure(request, "state-mismatch");

  const code = params.get("code");
  if (!code) return failure(request, "no-code");

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  // The same bucket the password path uses: this is a sign-in attempt, and the
  // fact that Google did the checking does not make it free to us.
  const throttle = await consumeNamedRateLimit(
    "adminLogin",
    createHash("sha256")
      .update(ip ?? "unknown")
      .digest("hex"),
  );
  if (!throttle.allowed) return failure(request, "rate-limited");

  const exchange = await exchangeCodeForIdentity(
    code,
    flow.codeVerifier,
    flow.nonce,
  );
  if (!exchange.ok) {
    // The reason is logged, never shown: it is diagnostic detail about our
    // relationship with Google, not something the visitor can act on.
    console.error("[google] exchange failed:", exchange.reason);
    return failure(request, "verification-failed");
  }

  const outcome = await signInWithGoogle(exchange.identity);
  if (!outcome.ok) {
    await recordAudit({
      action: AUDIT_ACTIONS.loginFailed,
      actorEmail: exchange.identity.email,
      detail: { via: "google", reason: outcome.reason },
    });
    return failure(request, outcome.reason);
  }

  const session = await issueAdminSession({
    userId: outcome.userId,
    role: outcome.role,
    sessionEpoch: outcome.sessionEpoch,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  await recordAudit({
    action: outcome.created
      ? AUDIT_ACTIONS.signupVerified
      : AUDIT_ACTIONS.loginSucceeded,
    actorId: outcome.userId,
    actorEmail: outcome.email,
    detail: { via: "google", created: outcome.created },
  });

  // A new account was just funded with welcome credits, and its ledger rows are
  // written by the same worker the rest of the app nudges.
  if (outcome.created) after(() => kickJobs(15_000));

  const response = NextResponse.redirect(
    new URL(safeNextPath(flow.next, "/app"), request.url),
  );
  response.cookies.set(
    SESSION_COOKIE,
    session.token,
    sessionCookieOptions(session.expiresAt),
  );
  response.cookies.delete(GOOGLE_FLOW_COOKIE);
  return response;
}
