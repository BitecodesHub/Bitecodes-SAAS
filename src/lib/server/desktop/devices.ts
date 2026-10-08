import "server-only";

import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { adminUsers, desktopTokens } from "@/lib/server/db/collections";
import type { DesktopTokenDoc } from "@/lib/server/db/types";
import { randomToken, sha256Hex } from "@/lib/server/crypto";
import {
  recordDesktopEvent,
  type EventContext,
} from "@/lib/server/desktop/events";

/**
 * Desktop-app sign-in: a device-authorization flow (the same shape as OAuth's
 * device grant, which is what TVs and CLIs use).
 *
 * The desktop app never sees a password, a session cookie, or a Google
 * credential. It holds a secret device code, opens the browser on a short user
 * code, and waits. The user signs in to Bitecodes however they normally do —
 * password, magic link, Google, 2FA — confirms the code shown in the app
 * matches, and approves. Only then can the app's poll redeem a device token.
 *
 * The visible user code is what stops a phishing link: a pairing someone else
 * started shows a code that does not match the one on the user's own screen.
 */

const PAIRING_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const TOKEN_PREFIX = "bcd_";
const DEVICE_CODE_PREFIX = "dvc_";
/** No 0/O, 1/I/L: users read and compare these by eye. */
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newUserCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++)
    out += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Accepts "abcd-efgh", "ABCDEFGH", " abcd efgh " → "ABCD-EFGH". */
export function normalizeUserCode(input: string): string | null {
  const raw = String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 8) return null;
  for (const ch of raw) if (!USER_CODE_ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** "Notes on macOS" etc. from the build the app reports; never free text. */
function deviceLabel(client: string | null, fallback: unknown): string {
  const os = /\(darwin/.test(client ?? "")
    ? "macOS"
    : /\(win32/.test(client ?? "")
      ? "Windows"
      : /\(linux/.test(client ?? "")
        ? "Linux"
        : null;
  if (os) return `Notes on ${os}`;
  // Older builds send no client header; accept only their known labels.
  const legacy = cleanLabel(fallback);
  return /^Notes on (macOS|Windows|Linux)$/.test(legacy)
    ? legacy
    : "Notes desktop app";
}

function cleanLabel(label: unknown): string {
  const text =
    typeof label === "string"
      ? label.replace(/[\u0000-\u001f]/g, "").trim()
      : "";
  return text.slice(0, 80) || "Desktop app";
}

async function currentEpoch(userId: string): Promise<number | undefined> {
  if (!ObjectId.isValid(userId)) return undefined;
  const user = await (
    await adminUsers()
  ).findOne({ _id: new ObjectId(userId) }, { projection: { sessionEpoch: 1 } });
  return typeof user?.sessionEpoch === "number" ? user.sessionEpoch : undefined;
}

/** The token's account if it may still use the desktop app, else null. */
async function accountStillValid(
  userId: string,
  tokenEpoch: number | undefined,
): Promise<{ role: string } | null> {
  if (!ObjectId.isValid(userId)) return null;
  const user = await (
    await adminUsers()
  ).findOne(
    { _id: new ObjectId(userId) },
    { projection: { status: 1, sessionEpoch: 1, role: 1 } },
  );
  if (!user || user.status !== "active") return null;
  // Tokens minted before epochs were recorded carry none; status still applies.
  if (typeof tokenEpoch === "number" && user.sessionEpoch !== tokenEpoch)
    return null;
  return { role: String(user.role ?? "") };
}

/** Signs a user out of every desktop device (password reset, disable, "sign out everywhere"). */
export async function revokeAllDesktopTokens(userId: string): Promise<number> {
  const result = await (
    await desktopTokens()
  ).updateMany(
    { userId, status: "active" },
    { $set: { status: "revoked", updatedAt: new Date() } },
  );
  return result.modifiedCount;
}

// ---------------------------------------------------------------------------
// 1. Start (desktop app, unauthenticated)
// ---------------------------------------------------------------------------

export interface PairingStarted {
  deviceCode: string;
  userCode: string;
  expiresAt: Date;
  intervalSeconds: number;
}

export async function startPairing(input: {
  label?: unknown;
  now?: Date;
  ctx?: EventContext;
  /** Approximate origin of the request ("Sydney, NSW, AU"), shown on approval. */
  requestedFrom?: string | null;
}): Promise<PairingStarted> {
  const now = input.now ?? new Date();
  const deviceCode = `${DEVICE_CODE_PREFIX}${randomToken(32)}`;
  const userCode = newUserCode();
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
  const doc: Omit<DesktopTokenDoc, "_id"> = {
    userId: "",
    // Server-chosen from the reported platform: a pairing link sent by an
    // attacker cannot pose as "Your work laptop".
    label: deviceLabel(input.ctx?.client ?? null, input.label),
    requestedFrom: input.requestedFrom ?? null,
    deviceCodeHash: sha256Hex(deviceCode),
    pairingCodeHash: sha256Hex(userCode),
    tokenHash: null,
    tokenPrefix: null,
    status: "pending",
    lastUsedAt: null,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  const inserted = await (
    await desktopTokens()
  ).insertOne(doc as DesktopTokenDoc);
  await recordDesktopEvent({
    type: "pair_started",
    tokenId: inserted.insertedId.toHexString(),
    label: doc.label,
    ...input.ctx,
    now,
  });
  return { deviceCode, userCode, expiresAt, intervalSeconds: 2 };
}

// ---------------------------------------------------------------------------
// 2. Approve / deny (browser, signed in)
// ---------------------------------------------------------------------------

export interface PendingPairing {
  id: string;
  label: string;
  userCode: string;
  expiresAt: Date;
  createdAt: Date;
  requestedFrom: string | null;
}

/** The pending pairing behind a user code, for the approval page. */
export async function findPendingPairing(
  userCode: string,
  now = new Date(),
): Promise<PendingPairing | null> {
  const code = normalizeUserCode(userCode);
  if (!code) return null;
  const doc = await (
    await desktopTokens()
  ).findOne({
    pairingCodeHash: sha256Hex(code),
    status: "pending",
    expiresAt: { $gt: now },
  });
  if (!doc?._id) return null;
  return {
    id: doc._id.toHexString(),
    label: doc.label,
    userCode: code,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    requestedFrom: doc.requestedFrom ?? null,
  };
}

/** Binds a pending pairing to the signed-in user. Single-use and atomic. */
export async function decidePairing(input: {
  userCode: string;
  userId: string;
  approve: boolean;
  now?: Date;
}): Promise<"approved" | "denied" | "not-found"> {
  const code = normalizeUserCode(input.userCode);
  if (!code || !input.userId) return "not-found";
  const now = input.now ?? new Date();
  const userEpoch = input.approve
    ? await currentEpoch(input.userId)
    : undefined;
  const doc = await (
    await desktopTokens()
  ).findOneAndUpdate(
    {
      pairingCodeHash: sha256Hex(code),
      status: "pending",
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: input.approve ? "approved" : "denied",
        userId: input.approve ? input.userId : "",
        ...(userEpoch !== undefined ? { userEpoch } : {}),
        // The user code has done its job; it can never be approved twice.
        pairingCodeHash: null,
        updatedAt: now,
      },
    },
  );
  if (!doc?._id) return "not-found";
  await recordDesktopEvent({
    type: input.approve ? "pair_approved" : "pair_denied",
    userId: input.userId,
    tokenId: doc._id.toHexString(),
    label: doc.label,
    now,
  });
  return input.approve ? "approved" : "denied";
}

// ---------------------------------------------------------------------------
// 3. Poll (desktop app, holds the device code)
// ---------------------------------------------------------------------------

export type PollResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "approved"; token: string; tokenId: string; expiresAt: Date };

/**
 * Redeems an approved pairing for a device token. The token is generated here
 * and returned exactly once — the same atomic update that stores its hash also
 * burns the device code, so a replayed poll cannot mint a second token.
 */
export async function pollPairing(
  deviceCode: string,
  now = new Date(),
  ctx?: EventContext,
): Promise<PollResult> {
  if (
    typeof deviceCode !== "string" ||
    !deviceCode.startsWith(DEVICE_CODE_PREFIX) ||
    deviceCode.length > 200
  ) {
    return { status: "expired" };
  }
  const col = await desktopTokens();
  const deviceCodeHash = sha256Hex(deviceCode);
  const doc = await col.findOne({ deviceCodeHash });
  if (!doc?._id) return { status: "expired" };
  if (doc.status === "denied") {
    await col.updateOne(
      { _id: doc._id },
      { $set: { deviceCodeHash: null, updatedAt: now } },
    );
    return { status: "denied" };
  }
  if (doc.status !== "approved") {
    return doc.status === "pending" && doc.expiresAt > now
      ? { status: "pending" }
      : { status: "expired" };
  }

  const token = `${TOKEN_PREFIX}${randomToken(32)}`;
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
  const result = await col.updateOne(
    { _id: doc._id, deviceCodeHash, status: "approved" },
    {
      $set: {
        status: "active",
        tokenHash: sha256Hex(token),
        tokenPrefix: token.slice(0, 10),
        deviceCodeHash: null,
        expiresAt,
        updatedAt: now,
        lastClient: ctx?.client ?? null,
        lastIpHash: ctx?.ipHash ?? null,
      },
    },
  );
  if (result.modifiedCount !== 1) return { status: "expired" };
  await recordDesktopEvent({
    type: "signed_in",
    userId: doc.userId,
    tokenId: doc._id.toHexString(),
    label: doc.label,
    ...ctx,
    now,
  });
  return {
    status: "approved",
    token,
    tokenId: doc._id.toHexString(),
    expiresAt,
  };
}

// ---------------------------------------------------------------------------
// 4. Use + manage
// ---------------------------------------------------------------------------

export interface VerifiedDevice {
  tokenId: string;
  userId: string;
  label: string;
  /** The account's role, for access policy (e.g. staff-only). */
  role: string;
}

/** Verifies a presented device token. Touches lastUsedAt (best effort). */
export async function verifyDesktopToken(
  token: string | null | undefined,
  now = new Date(),
  ctx?: EventContext,
): Promise<VerifiedDevice | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX) || token.length > 200)
    return null;
  const col = await desktopTokens();
  const doc = await col.findOne({ tokenHash: sha256Hex(token) });
  if (!doc?._id || doc.status !== "active" || !doc.userId) return null;
  if (doc.expiresAt <= now) return null;
  // The account is authoritative: a disabled user or a password reset (epoch
  // bump) kills desktop tokens just as it kills browser sessions.
  const account = await accountStillValid(doc.userId, doc.userEpoch);
  if (!account) return null;
  const touch: Partial<DesktopTokenDoc> = { lastUsedAt: now };
  if (ctx?.client) touch.lastClient = ctx.client;
  if (ctx?.ipHash) touch.lastIpHash = ctx.ipHash;
  void col.updateOne({ _id: doc._id }, { $set: touch }).catch(() => {});
  return {
    tokenId: doc._id.toHexString(),
    userId: doc.userId,
    label: doc.label,
    role: account.role,
  };
}

export interface DeviceRow {
  id: string;
  label: string;
  tokenPrefix: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
}

export async function listDevices(userId: string): Promise<DeviceRow[]> {
  const docs = await (
    await desktopTokens()
  )
    .find(
      { userId, status: "active" },
      { projection: { tokenHash: 0, deviceCodeHash: 0, pairingCodeHash: 0 } },
    )
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => ({
    id: d._id!.toHexString(),
    label: d.label,
    tokenPrefix: d.tokenPrefix,
    createdAt: d.createdAt,
    lastUsedAt: d.lastUsedAt,
    expiresAt: d.expiresAt,
  }));
}

/** Revokes one of the user's devices. Scoped by userId so it cannot touch another account. */
export async function revokeDevice(
  userId: string,
  id: string,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const doc = await (
    await desktopTokens()
  ).findOneAndUpdate(
    { _id: new ObjectId(id), userId, status: "active" },
    { $set: { status: "revoked", updatedAt: new Date() } },
  );
  if (!doc?._id) return false;
  await recordDesktopEvent({
    type: "revoked_by_user",
    userId,
    tokenId: id,
    label: doc.label,
  });
  return true;
}

/** Admin: disconnect any user's device. Recorded with the acting admin. */
export async function adminRevokeDevice(
  id: string,
  actorId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const doc = await (
    await desktopTokens()
  ).findOneAndUpdate(
    { _id: new ObjectId(id), status: "active" },
    { $set: { status: "revoked", updatedAt: new Date() } },
  );
  if (!doc?._id) return false;
  await recordDesktopEvent({
    type: "revoked_by_admin",
    userId: doc.userId,
    tokenId: id,
    label: doc.label,
    actorId,
  });
  return true;
}

/** Sign-out from the app itself: revokes the token it presents. */
export async function revokeDesktopToken(
  token: string,
  ctx?: EventContext,
): Promise<boolean> {
  if (!token?.startsWith(TOKEN_PREFIX)) return false;
  const doc = await (
    await desktopTokens()
  ).findOneAndUpdate(
    { tokenHash: sha256Hex(token), status: "active" },
    { $set: { status: "revoked", updatedAt: new Date() } },
  );
  if (!doc?._id) return false;
  await recordDesktopEvent({
    type: "signed_out",
    userId: doc.userId,
    tokenId: doc._id.toHexString(),
    label: doc.label,
    ...ctx,
  });
  return true;
}

/**
 * A request arrived with a token that is not (or no longer) valid. Recorded so
 * the operator can see a revoked or leaked token still being tried. The token
 * itself is never stored; only its prefix-matched device, if any.
 */
export async function recordRejectedToken(
  token: string | null,
  ctx?: EventContext,
): Promise<void> {
  if (!token?.startsWith(TOKEN_PREFIX) || token.length > 200) return;
  const doc = await (await desktopTokens())
    .findOne(
      { tokenHash: sha256Hex(token) },
      { projection: { userId: 1, label: 1 } },
    )
    .catch(() => null);
  // Only tokens we actually issued (now revoked/expired) are worth a row.
  // Random "bcd_…" strings are dropped, so the endpoint cannot be used to
  // flood the activity log.
  if (!doc?._id) return;
  await recordDesktopEvent({
    type: "token_rejected",
    userId: doc.userId,
    tokenId: doc._id.toHexString(),
    label: doc.label,
    ...ctx,
  });
}
