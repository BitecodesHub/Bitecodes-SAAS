import "server-only";

import { chatbotApiKeys } from "@/lib/server/db/collections";
import type { ChatbotApiKeyDoc } from "@/lib/server/db/types";
import { randomToken, sha256Hex } from "@/lib/server/crypto";

/**
 * Server-to-server API keys for the chatbot REST API.
 *
 * The secret is shown to the customer exactly once at creation and stored only
 * as a SHA-256 hash — identical to how sessions and public widget tokens are
 * handled. A short prefix is kept in the clear so the UI can show which key is
 * which without ever revealing the secret.
 */

const PREFIX_VISIBLE = 12;

export interface ApiKeyCreated {
  id: string;
  /** Plaintext secret — surface once, never retrievable again. */
  secret: string;
  prefix: string;
}

export async function createApiKey(input: {
  ownerId: string;
  name: string;
  scopes?: string[];
  allowedDomains?: string[];
  expiresAt?: Date | null;
}): Promise<ApiKeyCreated> {
  const collection = await chatbotApiKeys();
  const now = new Date();
  const secret = `sk_live_${randomToken(24)}`;
  const prefix = secret.slice(0, PREFIX_VISIBLE);

  const doc: Omit<ChatbotApiKeyDoc, "_id"> = {
    ownerId: input.ownerId,
    name: input.name.trim() || "API key",
    keyHash: sha256Hex(secret),
    prefix,
    scopes: input.scopes ?? ["chat", "read"],
    allowedDomains: input.allowedDomains ?? [],
    lastUsedAt: null,
    expiresAt: input.expiresAt ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as ChatbotApiKeyDoc);
  return { id: result.insertedId.toHexString(), secret, prefix };
}

/** Keys for the owner's dashboard. The hash is never projected out. */
export async function listApiKeys(
  ownerId: string,
): Promise<Omit<ChatbotApiKeyDoc, "keyHash">[]> {
  const collection = await chatbotApiKeys();
  return collection
    .find({ ownerId }, { projection: { keyHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

export interface VerifiedKey {
  ownerId: string;
  scopes: string[];
  allowedDomains: string[];
}

/**
 * Verifies a presented secret. Returns the owner + scopes when the key is
 * active and unexpired, else null. Touches `lastUsedAt` on success (best
 * effort — a failed touch never denies a valid key).
 */
export async function verifyApiKey(
  secret: string | null | undefined,
): Promise<VerifiedKey | null> {
  if (!secret || !secret.startsWith("sk_live_") || secret.length > 200) {
    return null;
  }
  const collection = await chatbotApiKeys();
  const doc = await collection.findOne({ keyHash: sha256Hex(secret) });
  if (!doc || doc.status !== "active") return null;
  if (doc.expiresAt && doc.expiresAt.getTime() <= Date.now()) return null;

  void collection
    .updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    ownerId: doc.ownerId,
    scopes: doc.scopes,
    allowedDomains: doc.allowedDomains,
  };
}

export async function revokeApiKey(
  ownerId: string,
  id: string,
): Promise<boolean> {
  const { ObjectId } = await import("mongodb");
  if (!ObjectId.isValid(id)) return false;
  const collection = await chatbotApiKeys();
  const result = await collection.updateOne(
    { _id: new ObjectId(id), ownerId },
    { $set: { status: "revoked", updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}
