import "server-only";

import { ObjectId, type Filter } from "mongodb";
import { adminUsers, desktopPromptLog } from "@/lib/server/db/collections";
import type {
  DesktopPromptLogDoc,
  DesktopProviderId,
  DesktopRequestKind,
} from "@/lib/server/db/types";
import type { Attempt } from "@/lib/server/desktop/gateway";

/**
 * The operator's record of every desktop request: who, when, the full prompt,
 * the full answer, which provider/model actually answered (the end user never
 * sees this), every provider tried on the way, tokens and latency.
 *
 * Screenshot bytes are NOT stored — only `hadImage`. A screenshot can hold
 * anything on the user's screen (other windows, messages, credentials), and
 * keeping megabytes of those per request indefinitely is a liability the
 * operator did not ask for. Rows expire after the retention window via TTL.
 */

export const LOG_RETENTION_DAYS = 180;
const MAX_STORED_CHARS = 50_000;

export interface LogInput {
  userId: string;
  tokenId: string | null;
  provider: DesktopProviderId | null;
  model: string | null;
  attempted: Attempt[];
  hadImage: boolean;
  imageCount?: number;
  kind?: DesktopRequestKind | null;
  client?: string | null;
  ipHash?: string | null;
  ttftMs?: number | null;
  prompt: string;
  response: string;
  status: "ok" | "error" | "cancelled";
  error: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  now?: Date;
}

const clip = (s: string) =>
  s.length > MAX_STORED_CHARS
    ? `${s.slice(0, MAX_STORED_CHARS)}…[truncated]`
    : s;

/** Best effort: a logging failure must never fail the user's request. */
export async function logDesktopRequest(input: LogInput): Promise<void> {
  try {
    const now = input.now ?? new Date();
    const doc: Omit<DesktopPromptLogDoc, "_id"> = {
      userId: input.userId,
      tokenId: input.tokenId,
      provider: input.provider,
      model: input.model,
      attempted: input.attempted.slice(0, 20),
      hadImage: input.hadImage,
      imageCount: input.imageCount ?? (input.hadImage ? 1 : 0),
      kind: input.kind ?? null,
      client: input.client ?? null,
      ipHash: input.ipHash ?? null,
      ttftMs:
        input.ttftMs == null ? null : Math.max(0, Math.round(input.ttftMs)),
      promptChars: input.prompt.length,
      prompt: clip(input.prompt),
      response: clip(input.response),
      status: input.status,
      error: input.error ? input.error.slice(0, 1000) : null,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      latencyMs: Math.max(0, Math.round(input.latencyMs)),
      createdAt: now,
      expiresAt: new Date(
        now.getTime() + LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      ),
    };
    await (await desktopPromptLog()).insertOne(doc as DesktopPromptLogDoc);
  } catch (error) {
    console.error(
      "[desktop] prompt log write failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export interface LogQuery {
  userId?: string;
  status?: "ok" | "error" | "cancelled";
  kind?: DesktopRequestKind;
  provider?: DesktopProviderId;
  search?: string;
  before?: string;
  limit?: number;
}

export interface LogRow {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  provider: DesktopProviderId | null;
  model: string | null;
  attempted: Attempt[];
  hadImage: boolean;
  imageCount: number;
  kind: DesktopRequestKind | null;
  client: string | null;
  ttftMs: number | null;
  prompt: string;
  response: string;
  status: "ok" | "error" | "cancelled";
  error: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  createdAt: Date;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Newest-first page of logs for the admin viewer, keyset-paginated by _id. */
export async function listDesktopLogs(
  query: LogQuery = {},
): Promise<{ rows: LogRow[]; nextBefore: string | null }> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const filter: Filter<DesktopPromptLogDoc> = {};
  if (query.userId) filter.userId = query.userId;
  if (query.status) filter.status = query.status;
  if (query.provider) filter.provider = query.provider;
  if (query.kind) filter.kind = query.kind;
  if (query.search?.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim().slice(0, 200)), "i");
    filter.$or = [{ prompt: rx }, { response: rx }];
  }
  if (query.before && ObjectId.isValid(query.before))
    filter._id = { $lt: new ObjectId(query.before) };

  const docs = await (
    await desktopPromptLog()
  )
    .find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  const page = docs.slice(0, limit);

  const ids = [...new Set(page.map((d) => d.userId))].filter((id) =>
    ObjectId.isValid(id),
  );
  const users = ids.length
    ? await (await adminUsers())
        .find(
          { _id: { $in: ids.map((id) => new ObjectId(id)) } },
          { projection: { email: 1, name: 1 } },
        )
        .toArray()
    : [];
  const byId = new Map(users.map((u) => [u._id!.toHexString(), u]));

  return {
    rows: page.map((d) => ({
      id: d._id!.toHexString(),
      userId: d.userId,
      userEmail: byId.get(d.userId)?.email ?? null,
      userName: byId.get(d.userId)?.name ?? null,
      provider: d.provider,
      model: d.model,
      attempted: d.attempted,
      hadImage: d.hadImage,
      imageCount: d.imageCount ?? (d.hadImage ? 1 : 0),
      kind: d.kind ?? null,
      client: d.client ?? null,
      ttftMs: d.ttftMs ?? null,
      prompt: d.prompt,
      response: d.response,
      status: d.status,
      error: d.error,
      promptTokens: d.promptTokens,
      completionTokens: d.completionTokens,
      latencyMs: d.latencyMs,
      createdAt: d.createdAt,
    })),
    nextBefore:
      docs.length > limit ? page[page.length - 1]._id!.toHexString() : null,
  };
}

export interface LogStats {
  total24h: number;
  errors24h: number;
  users24h: number;
  avgLatencyMs24h: number | null;
  byProvider24h: { provider: string; count: number }[];
}

export async function desktopLogStats(now = new Date()): Promise<LogStats> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const col = await desktopPromptLog();
  const [agg] = await col
    .aggregate<{
      total: number;
      errors: number;
      users: string[];
      avgLatency: number | null;
    }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          errors: { $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] } },
          users: { $addToSet: "$userId" },
          avgLatency: { $avg: "$latencyMs" },
        },
      },
    ])
    .toArray();
  const byProvider = await col
    .aggregate<{
      _id: string | null;
      count: number;
    }>([
      { $match: { createdAt: { $gte: since }, status: "ok" } },
      { $group: { _id: "$provider", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  return {
    total24h: agg?.total ?? 0,
    errors24h: agg?.errors ?? 0,
    users24h: agg?.users.length ?? 0,
    avgLatencyMs24h:
      agg?.avgLatency != null ? Math.round(agg.avgLatency) : null,
    byProvider24h: byProvider.map((b) => ({
      provider: b._id ?? "none",
      count: b.count,
    })),
  };
}
