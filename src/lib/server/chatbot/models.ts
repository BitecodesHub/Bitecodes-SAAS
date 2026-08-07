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

/** Seeded on first use so the catalogue is never empty. Costs are per 1M tokens. */
export const DEFAULT_MODELS: Omit<
  ChatbotModelDoc,
  "_id" | "createdAt" | "updatedAt"
>[] = [
  {
    key: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    provider: "openai",
    inCostPerMTok: 0.25,
    outCostPerMTok: 2,
    maxContext: 128000,
    maxOutput: 4096,
    tempMin: 0,
    tempMax: 1.5,
    enabled: true,
    planIds: [],
    isDefault: true,
  },
  {
    key: "anthropic/claude-haiku",
    label: "Claude Haiku",
    provider: "anthropic",
    inCostPerMTok: 0.8,
    outCostPerMTok: 4,
    maxContext: 200000,
    maxOutput: 4096,
    tempMin: 0,
    tempMax: 1,
    enabled: true,
    planIds: [],
    isDefault: false,
  },
  {
    key: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    inCostPerMTok: 0.3,
    outCostPerMTok: 2.5,
    maxContext: 1000000,
    maxOutput: 8192,
    tempMin: 0,
    tempMax: 2,
    enabled: true,
    planIds: [],
    isDefault: false,
  },
];

let seeded = false;

/** Inserts the default catalogue once if the collection is empty. */
export async function ensureSeededModels(): Promise<void> {
  if (seeded) return;
  const collection = await chatbotModels();
  const count = await collection.countDocuments({}, { limit: 1 });
  if (count === 0) {
    const now = new Date();
    await collection.insertMany(
      DEFAULT_MODELS.map((m) => ({ ...m, createdAt: now, updatedAt: now })),
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
