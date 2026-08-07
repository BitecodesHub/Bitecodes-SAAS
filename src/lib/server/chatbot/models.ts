import "server-only";

import { chatbotModels } from "@/lib/server/db/collections";
import type { ChatbotModelDoc } from "@/lib/server/db/types";

/**
 * The admin-managed catalogue of AI models customers may pick from.
 *
 * The admin controls which models are visible, their per-token costs (used by
 * the token ledger to price a request), context/output limits, and which is
 * the default. Customers only ever see enabled models.
 */

/**
 * Seeded on first use so the catalogue is never empty. Costs are per 1M tokens.
 *
 * These are NVIDIA NIM model ids, and the shortlist is **measured, not
 * assumed**: on `integrate.api.nvidia.com` many models sit behind a long queue
 * on the free tier. Time-to-first-byte, sampled repeatedly:
 *
 *   meta/llama-3.1-8b-instruct        ~0.7s   ← default: best instruction
 *                                              following, which is what keeps
 *                                              answers inside the knowledge base
 *   nvidia/nemotron-mini-4b-instruct  ~0.6s   fastest, lighter quality
 *   nvidia/nvidia-nemotron-nano-9b-v2 ~0.5s   reasoning model; emits
 *                                              reasoning_content, so it is off
 *                                              by default for a chat widget
 *   openai/gpt-oss-120b               ~60s    unusable interactively — do not
 *                                              re-add without re-measuring
 *
 * Costs are nominal: NVIDIA's hosted tier is free at this volume, so these
 * values exist to meter customer usage, not to reflect a supplier invoice.
 */
export const DEFAULT_MODELS: Omit<
  ChatbotModelDoc,
  "_id" | "createdAt" | "updatedAt"
>[] = [
  {
    key: "meta/llama-3.1-8b-instruct",
    label: "Llama 3.1 8B",
    provider: "nvidia",
    inCostPerMTok: 0.2,
    outCostPerMTok: 0.6,
    maxContext: 128000,
    maxOutput: 900,
    tempMin: 0,
    tempMax: 1.5,
    enabled: true,
    planIds: [],
    isDefault: true,
  },
  {
    key: "nvidia/nemotron-mini-4b-instruct",
    label: "Nemotron Mini 4B",
    provider: "nvidia",
    inCostPerMTok: 0.1,
    outCostPerMTok: 0.3,
    maxContext: 4096,
    maxOutput: 900,
    tempMin: 0,
    tempMax: 1.5,
    enabled: true,
    planIds: [],
    isDefault: false,
  },
  {
    key: "nvidia/nvidia-nemotron-nano-9b-v2",
    label: "Nemotron Nano 9B (reasoning)",
    provider: "nvidia",
    inCostPerMTok: 0.2,
    outCostPerMTok: 0.6,
    maxContext: 128000,
    maxOutput: 900,
    tempMin: 0,
    tempMax: 1,
    // Off by default: it streams a reasoning channel a visitor should not see.
    enabled: false,
    planIds: [],
    isDefault: false,
  },
];

/**
 * Placeholder model ids shipped in an earlier revision of this catalogue.
 *
 * They are OpenRouter-style names and do not exist on the configured NVIDIA
 * endpoint, so a chatbot defaulting to one of them fails with a provider 404.
 * They are removed on seed rather than left disabled: leaving a broken id in the
 * picker invites an operator to select it. Safe to delete — they were never
 * reachable on this deployment, so no customer can be relying on one.
 */
const LEGACY_MODEL_KEYS = [
  "openai/gpt-5-mini",
  "anthropic/claude-haiku",
  "google/gemini-2.5-flash",
];

let seeded = false;

/**
 * Reconciles the catalogue with the shipped defaults. Idempotent, and safe to
 * call on every read.
 *
 * Deliberately not "insert only when empty": that left an already-seeded
 * deployment stuck with whichever defaults existed the first time it ran, which
 * is how the unreachable placeholder ids survived. Instead each default is
 * upserted with `$setOnInsert`, so a new model is added while an operator's own
 * edits to cost, limits, or the enabled flag are never overwritten.
 */
export async function ensureSeededModels(): Promise<void> {
  if (seeded) return;
  const collection = await chatbotModels();
  const now = new Date();

  await collection.deleteMany({ key: { $in: LEGACY_MODEL_KEYS } });

  for (const model of DEFAULT_MODELS) {
    await collection.updateOne(
      { key: model.key },
      { $setOnInsert: { ...model, createdAt: now, updatedAt: now } },
      { upsert: true },
    );
  }

  // If removing the legacy entries took the default with them, restore one so
  // the chat gateway always has a model to call.
  const hasDefault = await collection.findOne({
    isDefault: true,
    enabled: true,
  });
  if (!hasDefault) {
    const fallback =
      DEFAULT_MODELS.find((m) => m.isDefault) ?? DEFAULT_MODELS[0];
    await collection.updateOne(
      { key: fallback.key },
      { $set: { isDefault: true, enabled: true, updatedAt: now } },
    );
  }

  seeded = true;
}

export async function listModels(): Promise<ChatbotModelDoc[]> {
  await ensureSeededModels();
  const collection = await chatbotModels();
  return collection.find({}).sort({ label: 1 }).toArray();
}

/** Only the models a customer may select — enabled ones. */
export async function listEnabledModels(): Promise<ChatbotModelDoc[]> {
  await ensureSeededModels();
  const collection = await chatbotModels();
  return collection.find({ enabled: true }).sort({ label: 1 }).toArray();
}

export async function getModel(key: string): Promise<ChatbotModelDoc | null> {
  const collection = await chatbotModels();
  return collection.findOne({ key });
}

/**
 * The platform default, for callers that have no per-bot choice to honour.
 * Falls back to any enabled model so a mis-set `isDefault` cannot leave the
 * chat gateway with nothing to call.
 */
export async function getDefaultModel(): Promise<ChatbotModelDoc | null> {
  await ensureSeededModels();
  const collection = await chatbotModels();
  return (
    (await collection.findOne({ isDefault: true, enabled: true })) ??
    (await collection.findOne({ enabled: true }))
  );
}

export async function upsertModel(
  input: Omit<ChatbotModelDoc, "_id" | "createdAt" | "updatedAt">,
): Promise<void> {
  const collection = await chatbotModels();
  const now = new Date();
  await collection.updateOne(
    { key: input.key },
    { $set: { ...input, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
}

export async function setModelEnabled(
  key: string,
  enabled: boolean,
): Promise<boolean> {
  const collection = await chatbotModels();
  const result = await collection.updateOne(
    { key },
    { $set: { enabled, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

/** Resets which model is the platform default (exactly one). */
export async function setDefaultModel(key: string): Promise<boolean> {
  const collection = await chatbotModels();
  const target = await collection.findOne({ key });
  if (!target) return false;
  await collection.updateMany({}, { $set: { isDefault: false } });
  await collection.updateOne(
    { key },
    { $set: { isDefault: true, enabled: true, updatedAt: new Date() } },
  );
  return true;
}

/** Test seam — forget the in-process seeded flag. */
export function resetSeededModelsFlag() {
  seeded = false;
}
