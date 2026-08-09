#!/usr/bin/env node
/**
 * Reports what a Google sign-in actually did, straight from the database.
 *
 * Run after clicking through the flow on the dev server, to check that the
 * account looks the way the policy says it should rather than merely that a
 * page loaded.
 *
 *   node --env-file=.env.development.local scripts/inspect-google-account.mjs
 *
 * Refuses to run against anything but the development database.
 */

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

if (!uri) throw new Error("MONGODB_URI is not set.");
if (dbName !== "bitecodes_dev") {
  throw new Error(
    `Refusing to run: MONGODB_DB_NAME is "${dbName}", not "bitecodes_dev".`,
  );
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const accounts = await db
  .collection("admin_users")
  .find(
    { googleSub: { $type: "string" } },
    {
      projection: {
        email: 1,
        name: 1,
        role: 1,
        status: 1,
        googleSub: 1,
        emailVerifiedAt: 1,
        sessionEpoch: 1,
        lastLoginAt: 1,
        createdAt: 1,
      },
    },
  )
  .sort({ createdAt: -1 })
  .toArray();

if (accounts.length === 0) {
  console.log("No Google-linked account found yet.");
  await client.close();
  process.exit(0);
}

for (const account of accounts) {
  const id = account._id.toHexString();
  const [sessions, balances, ledger] = await Promise.all([
    db
      .collection("admin_sessions")
      .countDocuments({ userId: id, revokedAt: null }),
    db.collection("wallet_balances").find({ ownerId: id }).toArray(),
    db
      .collection("wallet_ledger")
      .countDocuments({ ownerId: id, kind: "bonus" }),
  ]);

  console.log("─".repeat(64));
  console.log(`email          ${account.email}`);
  console.log(`name           ${account.name}`);
  console.log(`role           ${account.role}   ${account.role === "customer" ? "OK" : "WRONG — must be customer"}`);
  console.log(`status         ${account.status}  ${account.status === "active" ? "OK" : "WRONG — must be active"}`);
  console.log(`googleSub      ${account.googleSub.slice(0, 8)}… (linked)`);
  console.log(`emailVerified  ${account.emailVerifiedAt ? account.emailVerifiedAt.toISOString() : "MISSING — should be set"}`);
  console.log(`sessionEpoch   ${account.sessionEpoch}`);
  console.log(`live sessions  ${sessions}  ${sessions > 0 ? "OK — signed in" : "none"}`);
  console.log(
    `credits        ${balances.map((b) => `${b.product}=${b.balance}`).join("  ") || "none"}`,
  );
  console.log(`bonus rows     ${ledger}  ${ledger === 4 ? "OK — granted once per product" : ledger === 0 ? "none" : "check for duplicates"}`);
}
console.log("─".repeat(64));

await client.close();
