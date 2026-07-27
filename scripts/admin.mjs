/**
 * Admin account management from the command line.
 *
 *   pnpm admin create  <email> [name] [role]
 *   pnpm admin reset   <email>
 *   pnpm admin list
 *   pnpm admin disable <email>
 *   pnpm admin enable  <email>
 *   pnpm admin unlock  <email>
 *
 * A CLI rather than a web signup page: the admin panel has no public
 * registration by design, so the first account has to be created out of band.
 * A bootstrap route guarded by a token would be a permanent unauthenticated
 * write endpoint sitting in production forever.
 *
 * Run through the package script, which supplies `--env-file`. Plain
 * `node scripts/admin.mjs` will not see the environment.
 *
 * Passwords are generated here and printed once, never chosen on the command
 * line: a password passed as an argument lands in shell history and in `ps`.
 */

import { MongoClient } from "mongodb";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";

const scrypt = promisify(scryptCallback);

// Must stay in step with src/lib/server/crypto.ts — the hash format is the
// contract between this script and the application.
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const ROLES = ["owner", "admin", "editor", "viewer"];

function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(
    password.normalize("NFKC"),
    salt,
    SCRYPT_KEYLEN,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
  );
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * A 24-byte random password. Long and random beats memorable: it is shown once
 * and meant to go straight into a password manager.
 */
function generatePassword() {
  return base64Url(randomBytes(24));
}

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

function usage() {
  console.log(`
  Bitecodes admin accounts

    pnpm admin create  <email> [name] [role]   Create an account (role: ${ROLES.join(" | ")})
    pnpm admin reset   <email>                 Issue a new password
    pnpm admin list                            List accounts
    pnpm admin disable <email>                 Block sign-in
    pnpm admin enable  <email>                 Restore sign-in
    pnpm admin unlock  <email>                 Clear a failed-attempt lockout
`);
}

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    fail(
      "MONGODB_URI is not set. Run via `pnpm admin …` so the env file is loaded.",
    );
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  return {
    client,
    users: client.db(process.env.MONGODB_DB_NAME || "bitecodes").collection("admin_users"),
    sessions: client
      .db(process.env.MONGODB_DB_NAME || "bitecodes")
      .collection("admin_sessions"),
  };
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

async function confirm(question) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await readline.question(`${question} (y/N) `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    readline.close();
  }
}

async function create([rawEmail, name, role = "owner"]) {
  const email = normalizeEmail(rawEmail);
  if (!email.includes("@")) fail("Provide a valid email address.");
  if (!ROLES.includes(role)) {
    fail(`Unknown role "${role}". Use one of: ${ROLES.join(", ")}`);
  }

  const { client, users } = await connect();
  try {
    const existing = await users.findOne({ email });
    if (existing) fail(`${email} already exists. Use \`pnpm admin reset\`.`);

    const password = generatePassword();
    const now = new Date();

    await users.insertOne({
      email,
      name: name?.trim() || email.split("@")[0],
      role,
      passwordHash: await hashPassword(password),
      status: "active",
      totpSecret: null,
      totpEnabledAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      // Bumped on every password change; invalidates existing sessions.
      sessionEpoch: 1,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`
  ✓ Created ${email} (${role})

    Password: ${password}

    Shown once and not stored in recoverable form. Save it to a password
    manager now, then sign in at /admin/login.
`);
  } finally {
    await client.close();
  }
}

async function reset([rawEmail]) {
  const email = normalizeEmail(rawEmail);
  const { client, users, sessions } = await connect();
  try {
    const user = await users.findOne({ email });
    if (!user) fail(`${email} not found.`);

    const password = generatePassword();
    await users.updateOne(
      { email },
      {
        $set: {
          passwordHash: await hashPassword(password),
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
        // Every existing session for this account stops validating.
        $inc: { sessionEpoch: 1 },
      },
    );

    const revoked = await sessions.updateMany(
      { userId: user._id.toHexString(), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    console.log(`
  ✓ Reset ${email}

    Password: ${password}

    ${revoked.modifiedCount} active session(s) revoked.
`);
  } finally {
    await client.close();
  }
}

async function list() {
  const { client, users } = await connect();
  try {
    const all = await users
      .find({}, { projection: { passwordHash: 0, totpSecret: 0 } })
      .sort({ createdAt: 1 })
      .toArray();

    if (all.length === 0) {
      console.log(
        "\n  No admin accounts yet. Create one with `pnpm admin create <email>`.\n",
      );
      return;
    }

    console.log();
    for (const user of all) {
      const locked =
        user.lockedUntil && user.lockedUntil > new Date()
          ? ` LOCKED until ${user.lockedUntil.toISOString()}`
          : "";
      const lastLogin = user.lastLoginAt
        ? user.lastLoginAt.toISOString().slice(0, 16).replace("T", " ")
        : "never";
      console.log(
        `  ${user.email.padEnd(34)} ${String(user.role).padEnd(7)} ${String(user.status).padEnd(9)} 2FA:${user.totpEnabledAt ? "on " : "off"}  last login ${lastLogin}${locked}`,
      );
    }
    console.log();
  } finally {
    await client.close();
  }
}

async function setStatus([rawEmail], status) {
  const email = normalizeEmail(rawEmail);
  const { client, users, sessions } = await connect();
  try {
    const user = await users.findOne({ email });
    if (!user) fail(`${email} not found.`);

    if (status === "disabled" && user.role === "owner") {
      const owners = await users.countDocuments({
        role: "owner",
        status: "active",
      });
      // Locking every owner out would leave no way back in except this script.
      if (owners <= 1 && !(await confirm(`${email} is the only active owner. Disable anyway?`))) {
        console.log("\n  Cancelled.\n");
        return;
      }
    }

    await users.updateOne(
      { email },
      { $set: { status, updatedAt: new Date() } },
    );

    if (status === "disabled") {
      await sessions.updateMany(
        { userId: user._id.toHexString(), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
    }

    console.log(`\n  ✓ ${email} is now ${status}.\n`);
  } finally {
    await client.close();
  }
}

async function unlock([rawEmail]) {
  const email = normalizeEmail(rawEmail);
  const { client, users } = await connect();
  try {
    const result = await users.updateOne(
      { email },
      {
        $set: { failedAttempts: 0, lockedUntil: null, updatedAt: new Date() },
      },
    );
    if (result.matchedCount === 0) fail(`${email} not found.`);
    console.log(`\n  ✓ ${email} unlocked.\n`);
  } finally {
    await client.close();
  }
}

const [command, ...args] = process.argv.slice(2);

const commands = {
  create,
  reset,
  list,
  disable: (a) => setStatus(a, "disabled"),
  enable: (a) => setStatus(a, "active"),
  unlock,
};

if (!command || !commands[command]) {
  usage();
  process.exit(command ? 1 : 0);
}

try {
  await commands[command](args);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
