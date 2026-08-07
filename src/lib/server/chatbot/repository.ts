import "server-only";

import { randomUUID } from "node:crypto";
import { chatbots } from "@/lib/server/db/collections";
import type {
  ChatbotAppearance,
  ChatbotDoc,
  ChatbotStatus,
} from "@/lib/server/db/types";
import { randomToken, sha256Hex } from "@/lib/server/crypto";
import { normalizeDomainPattern } from "@/lib/chatbot/domains";

/**
 * Tenant-scoped data access for chatbots.
 *
 * Every read and write is filtered by `ownerId`. This is the multi-tenancy
 * boundary: a customer can only ever see or change their own bots, enforced in
 * the query rather than trusted from the caller. The widget path is the one
 * exception and looks a bot up by its public-token hash, never by owner.
 */

export const DEFAULT_APPEARANCE: ChatbotAppearance = {
  theme: "auto",
  avatar: null,
  logo: null,
  primaryColor: "#4f46e5",
  secondaryColor: "#0ea5e9",
  position: "bottom-right",
  size: "regular",
  displayMode: "bubble",
  welcomeMessage: "Hi! How can I help you today?",
  placeholder: "Ask a question…",
  typingAnimation: true,
  branding: true,
  language: "en",
  timezone: "UTC",
  suggestedQuestions: [],
  starterPrompts: [],
};

export interface CreateChatbotInput {
  ownerId: string;
  name: string;
  description?: string | null;
  websiteName?: string | null;
  allowedDomains?: string[];
  appearance?: Partial<ChatbotAppearance>;
  modelKey?: string | null;
  systemPrompt?: string;
}

export interface ChatbotCreated {
  chatbotId: string;
  /** The plaintext public token — shown ONCE for the embed snippet. */
  publicToken: string;
}

function cleanDomains(domains: readonly string[] | undefined): string[] {
  if (!domains) return [];
  return [
    ...new Set(domains.map((d) => normalizeDomainPattern(d)).filter(Boolean)),
  ].slice(0, 50);
}

/**
 * Creates a chatbot and mints its public widget token. The token is returned
 * once and stored only as a hash — like the API-key and session tokens
 * elsewhere in the app.
 */
export async function createChatbot(
  input: CreateChatbotInput,
): Promise<ChatbotCreated> {
  const collection = await chatbots();
  const now = new Date();
  const chatbotId = randomUUID();
  const publicToken = `cb_pub_${randomToken(24)}`;

  const doc: Omit<ChatbotDoc, "_id"> = {
    chatbotId,
    ownerId: input.ownerId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    websiteName: input.websiteName?.trim() || null,
    status: "active",
    allowedDomains: cleanDomains(input.allowedDomains),
    appearance: { ...DEFAULT_APPEARANCE, ...input.appearance },
    modelKey: input.modelKey ?? null,
    systemPrompt:
      input.systemPrompt?.trim() ||
      "You are a helpful assistant for this website. Answer only from the provided knowledge; if you do not know, say so and offer to connect the visitor with a human.",
    publicTokenHash: sha256Hex(publicToken),
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(doc as ChatbotDoc);
  return { chatbotId, publicToken };
}

export async function listChatbots(ownerId: string): Promise<ChatbotDoc[]> {
  const collection = await chatbots();
  return collection
    .find({ ownerId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
}

export async function getChatbot(
  ownerId: string,
  chatbotId: string,
): Promise<ChatbotDoc | null> {
  const collection = await chatbots();
  return collection.findOne({ ownerId, chatbotId });
}

/**
 * Resolves a bot for the PUBLIC widget path: by id + public-token hash, and
 * only when active. Never scoped by owner (the visitor is anonymous), and
 * never returns a paused bot.
 */
export async function getChatbotForWidget(
  chatbotId: string,
  publicToken: string,
): Promise<ChatbotDoc | null> {
  const collection = await chatbots();
  return collection.findOne({
    chatbotId,
    publicTokenHash: sha256Hex(publicToken),
    status: "active",
  });
}

export type UpdatableChatbotFields = Partial<
  Pick<
    ChatbotDoc,
    | "name"
    | "description"
    | "websiteName"
    | "allowedDomains"
    | "modelKey"
    | "systemPrompt"
  >
> & {
  /** A partial appearance is merged onto the stored value. */
  appearance?: Partial<ChatbotAppearance>;
};

export async function updateChatbot(
  ownerId: string,
  chatbotId: string,
  patch: UpdatableChatbotFields,
): Promise<boolean> {
  const collection = await chatbots();
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.description !== undefined)
    set.description = patch.description?.trim() || null;
  if (patch.websiteName !== undefined)
    set.websiteName = patch.websiteName?.trim() || null;
  if (patch.allowedDomains !== undefined)
    set.allowedDomains = cleanDomains(patch.allowedDomains);
  if (patch.modelKey !== undefined) set.modelKey = patch.modelKey;
  if (patch.systemPrompt !== undefined)
    set.systemPrompt = patch.systemPrompt.trim();
  if (patch.appearance !== undefined) {
    // Merge onto existing appearance so a partial update never drops fields.
    const existing = await collection.findOne(
      { ownerId, chatbotId },
      { projection: { appearance: 1 } },
    );
    if (!existing) return false;
    set.appearance = { ...existing.appearance, ...patch.appearance };
  }

  const result = await collection.updateOne(
    { ownerId, chatbotId },
    { $set: set },
  );
  return result.matchedCount === 1;
}

export async function setChatbotStatus(
  ownerId: string,
  chatbotId: string,
  status: ChatbotStatus,
): Promise<boolean> {
  const collection = await chatbots();
  const result = await collection.updateOne(
    { ownerId, chatbotId },
    { $set: { status, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

/** Rotates the public token, invalidating any embed that used the old one. */
export async function rotatePublicToken(
  ownerId: string,
  chatbotId: string,
): Promise<string | null> {
  const collection = await chatbots();
  const publicToken = `cb_pub_${randomToken(24)}`;
  const result = await collection.updateOne(
    { ownerId, chatbotId },
    {
      $set: { publicTokenHash: sha256Hex(publicToken), updatedAt: new Date() },
    },
  );
  return result.matchedCount === 1 ? publicToken : null;
}

export async function deleteChatbot(
  ownerId: string,
  chatbotId: string,
): Promise<boolean> {
  const collection = await chatbots();
  const result = await collection.deleteOne({ ownerId, chatbotId });
  return result.deletedCount === 1;
}
