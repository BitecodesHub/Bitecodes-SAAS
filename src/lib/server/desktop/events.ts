import "server-only";

import { ObjectId, type Filter } from "mongodb";
import {
  adminUsers,
  desktopEvents,
  desktopPromptLog,
  desktopTokens,
} from "@/lib/server/db/collections";
import type { DesktopEventDoc, DesktopEventType } from "@/lib/server/db/types";

/**
 * The desktop app's account/device activity timeline: every sign-in attempt,
 * approval, denial, sign-out, revocation (by the user or an admin) and every
 * request made with a dead token. Prompts live in the prompt log; this is the
 * "who connected what, when, from which build" record. IPs are stored hashed.
 */

export const EVENT_RETENTION_DAYS = 180;

export interface EventContext {
  client?: string | null;
  ipHash?: string | null;
}

export interface EventInput extends EventContext {
  type: DesktopEventType;
  userId?: string | null;
  tokenId?: string | null;
  label?: string | null;
  actorId?: string | null;
  now?: Date;
}

/** Best effort: tracking must never break sign-in or a request. */
export async function recordDesktopEvent(input: EventInput): Promise<void> {
  try {
    const now = input.now ?? new Date();
    await (
      await desktopEvents()
    ).insertOne({
      type: input.type,
      userId: input.userId ?? "",
      tokenId: input.tokenId ?? null,
      label: input.label ?? null,
      client: input.client ?? null,
      ipHash: input.ipHash ?? null,
      actorId: input.actorId ?? null,
      createdAt: now,
      expiresAt: new Date(
        now.getTime() + EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      ),
    });
  } catch (error) {
    console.error(
      "[desktop] event write failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function userDirectory(
  ids: string[],
): Promise<Map<string, { email: string | null; name: string | null }>> {
  const valid = [...new Set(ids)].filter((id) => id && ObjectId.isValid(id));
  if (!valid.length) return new Map();
  const users = await (await adminUsers())
    .find(
      { _id: { $in: valid.map((id) => new ObjectId(id)) } },
      { projection: { email: 1, name: 1 } },
    )
    .toArray();
  return new Map(
    users.map((u) => [
      u._id!.toHexString(),
      { email: u.email ?? null, name: u.name ?? null },
    ]),
  );
}

export interface EventRow {
  id: string;
  type: DesktopEventType;
  userId: string;
  userEmail: string | null;
  label: string | null;
  client: string | null;
  ipHash: string | null;
  actorEmail: string | null;
  createdAt: Date;
}

export async function listDesktopEvents(
  query: {
    userId?: string;
    type?: DesktopEventType;
    before?: string;
    limit?: number;
  } = {},
): Promise<{ rows: EventRow[]; nextBefore: string | null }> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const filter: Filter<DesktopEventDoc> = {};
  if (query.userId) filter.userId = query.userId;
  if (query.type) filter.type = query.type;
  if (query.before && ObjectId.isValid(query.before))
    filter._id = { $lt: new ObjectId(query.before) };
  const docs = await (
    await desktopEvents()
  )
    .find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  const page = docs.slice(0, limit);
  const users = await userDirectory(
    page.flatMap((d) => [d.userId, d.actorId ?? ""]),
  );
  return {
    rows: page.map((d) => ({
      id: d._id!.toHexString(),
      type: d.type,
      userId: d.userId,
      userEmail: users.get(d.userId)?.email ?? null,
      label: d.label,
      client: d.client,
      ipHash: d.ipHash,
      actorEmail: d.actorId ? (users.get(d.actorId)?.email ?? null) : null,
      createdAt: d.createdAt,
    })),
    nextBefore:
      docs.length > limit ? page[page.length - 1]._id!.toHexString() : null,
  };
}

export interface UserUsageRow {
  userId: string;
  email: string | null;
  name: string | null;
  requests: number;
  errors: number;
  screenshots: number;
  promptTokens: number;
  completionTokens: number;
  avgLatencyMs: number;
  lastActiveAt: Date | null;
  activeDevices: number;
}

/** Per-user usage over the last `days` days, busiest first. */
export async function desktopUsageByUser(
  days = 30,
  now = new Date(),
): Promise<UserUsageRow[]> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const agg = await (
    await desktopPromptLog()
  )
    .aggregate<{
      _id: string;
      requests: number;
      errors: number;
      screenshots: number;
      promptTokens: number;
      completionTokens: number;
      avgLatencyMs: number;
      lastActiveAt: Date;
    }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$userId",
          requests: { $sum: 1 },
          errors: { $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] } },
          screenshots: { $sum: { $cond: ["$hadImage", 1, 0] } },
          promptTokens: { $sum: { $ifNull: ["$promptTokens", 0] } },
          completionTokens: { $sum: { $ifNull: ["$completionTokens", 0] } },
          avgLatencyMs: { $avg: "$latencyMs" },
          lastActiveAt: { $max: "$createdAt" },
        },
      },
      { $sort: { requests: -1 } },
      { $limit: 500 },
    ])
    .toArray();
  const devices = await (
    await desktopTokens()
  )
    .aggregate<{
      _id: string;
      n: number;
    }>([
      { $match: { status: "active", expiresAt: { $gt: now } } },
      { $group: { _id: "$userId", n: { $sum: 1 } } },
    ])
    .toArray();
  const deviceCount = new Map(devices.map((d) => [d._id, d.n]));
  // Users with a connected device but no requests yet still appear.
  const ids = [...new Set([...agg.map((a) => a._id), ...deviceCount.keys()])];
  const users = await userDirectory(ids);
  const byId = new Map(agg.map((a) => [a._id, a]));
  return ids.map((id) => {
    const a = byId.get(id);
    return {
      userId: id,
      email: users.get(id)?.email ?? null,
      name: users.get(id)?.name ?? null,
      requests: a?.requests ?? 0,
      errors: a?.errors ?? 0,
      screenshots: a?.screenshots ?? 0,
      promptTokens: a?.promptTokens ?? 0,
      completionTokens: a?.completionTokens ?? 0,
      avgLatencyMs: Math.round(a?.avgLatencyMs ?? 0),
      lastActiveAt: a?.lastActiveAt ?? null,
      activeDevices: deviceCount.get(id) ?? 0,
    };
  });
}

export interface AdminDeviceRow {
  id: string;
  userId: string;
  userEmail: string | null;
  label: string;
  lastClient: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
}

/** Every connected device across all users, most recently used first. */
export async function listAllDevices(
  now = new Date(),
): Promise<AdminDeviceRow[]> {
  const docs = await (
    await desktopTokens()
  )
    .find(
      { status: "active", expiresAt: { $gt: now } },
      { projection: { tokenHash: 0, deviceCodeHash: 0, pairingCodeHash: 0 } },
    )
    .sort({ lastUsedAt: -1, createdAt: -1 })
    .limit(500)
    .toArray();
  const users = await userDirectory(docs.map((d) => d.userId));
  return docs.map((d) => ({
    id: d._id!.toHexString(),
    userId: d.userId,
    userEmail: users.get(d.userId)?.email ?? null,
    label: d.label,
    lastClient: d.lastClient ?? null,
    createdAt: d.createdAt,
    lastUsedAt: d.lastUsedAt,
    expiresAt: d.expiresAt,
  }));
}
