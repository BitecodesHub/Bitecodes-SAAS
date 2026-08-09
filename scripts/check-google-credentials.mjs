#!/usr/bin/env node
/**
 * Proves a Google OAuth client id and secret are valid, without a browser.
 *
 * The trick is which error Google returns. Posting a deliberately bogus
 * authorization code to the token endpoint tells the two failures apart:
 *
 *   invalid_client  → the id/secret pair is wrong, disabled, or deleted
 *   invalid_grant   → the credentials were ACCEPTED and only the code was bad
 *
 * So `invalid_grant` is the pass condition. It is the cheapest way to answer
 * "is this the secret that is actually enabled in the console", which matters
 * because the console shows only the last four characters of each secret and an
 * account may have several.
 *
 * Reads from the environment. Nothing is printed but the verdict, and the
 * secret is never echoed.
 *
 *   node --env-file=.env.development.local scripts/check-google-credentials.mjs
 */

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set.");
  console.error(
    "Try: node --env-file=.env.development.local scripts/check-google-credentials.mjs",
  );
  process.exit(2);
}

const redirectUri =
  process.argv[2] ?? "http://localhost:3000/api/google/callback";

console.log(`client id     ${clientId.slice(0, 24)}…`);
console.log(`secret        ${clientSecret.slice(0, 7)}… (${clientSecret.length} chars)`);
console.log(`redirect uri  ${redirectUri}`);
console.log("");

const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code: "deliberately-invalid-code-for-a-credential-check",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }),
});

const body = await response.json().catch(() => ({}));
const error = body.error ?? "(none)";

if (error === "invalid_grant") {
  console.log("PASS — Google accepted the client id and secret.");
  console.log("       (It rejected only the fake code, which is the point.)");
  process.exit(0);
}

if (error === "invalid_client") {
  console.log("FAIL — Google rejected the client id/secret pair.");
  console.log("       The secret is wrong, disabled, or belongs to another client.");
  console.log("       Check Google Cloud Console → Clients → Client secrets:");
  console.log("       the last 4 characters shown there must match yours.");
  process.exit(1);
}

console.log(`UNCLEAR — HTTP ${response.status}, error "${error}".`);
console.log(`          ${body.error_description ?? "no description"}`);
process.exit(1);
