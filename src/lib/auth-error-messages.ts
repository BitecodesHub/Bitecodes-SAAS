/**
 * Turns a sign-in failure code into a sentence.
 *
 * A lookup rather than rendering the code, because the code arrives in the URL
 * where anyone can put anything: showing it verbatim would let a link put
 * chosen text — "Your account was suspended, call this number" — on our own
 * sign-in page. Only these strings are ever displayed, and anything unrecognised
 * falls back to a generic one.
 *
 * Pure and client-safe, so the sign-in pages can render it without a round trip.
 */
const MESSAGES: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Nothing has changed.",
  expired: "That took too long. Please try signing in again.",
  "state-mismatch":
    "That sign-in could not be verified. Please start again from this page.",
  "no-code": "Google did not send us a sign-in code. Please try again.",
  "rate-limited": "Too many attempts from this connection. Try again shortly.",
  "verification-failed":
    "We could not verify that Google account. Please try again.",
  "google-error": "Google could not complete the sign-in. Please try again.",
  "google-unavailable":
    "Google sign-in is not available right now. Use your email and password.",
  "unverified-email":
    "That Google account's email address is not confirmed with Google, so we cannot use it to sign you in.",
  "staff-account":
    "That address belongs to a Bitecodes staff account. Staff sign in with a password at /admin/login.",
  disabled: "That account has been disabled. Contact us if that is unexpected.",
  "already-linked":
    "That email address is already linked to a different Google account. Sign in with your password instead.",
};

const FALLBACK = "That sign-in did not work. Please try again.";

export function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? FALLBACK;
}
