"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  revalidateProduct,
  revalidateProductRecord,
} from "@/lib/server/revalidate-product";
import { assertCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import {
  createChatbot,
  deleteChatbot,
  rotatePublicToken,
  setChatbotStatus,
  updateChatbot,
} from "@/lib/server/chatbot/repository";
import { createApiKey, revokeApiKey } from "@/lib/server/chatbot/api-keys";
import {
  setDefaultModel,
  setModelEnabled,
  upsertModel,
} from "@/lib/server/chatbot/models";
import { deleteSource, ingestContent } from "@/lib/server/knowledge/repository";
import { getChatbot } from "@/lib/server/chatbot/repository";
import type { KnowledgeFormat } from "@/lib/chatbot/extract";

/**
 * Server Actions for chatbot management in the admin panel.
 *
 * Server Actions (not route handlers) so Next's Origin/Host check gives CSRF
 * protection for free. Every action re-authorises with `manage_chatbots`; the
 * owner scope is the acting admin's user id. A hidden button is presentation,
 * never protection.
 */

export type ChatbotActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  websiteName: z.string().trim().max(120).optional(),
  allowedDomains: z.array(z.string().trim().max(120)).max(50).optional(),
});

export async function createChatbotAction(input: {
  name: string;
  websiteName?: string;
  allowedDomains?: string[];
}): Promise<ChatbotActionResult<{ chatbotId: string; publicToken: string }>> {
  const session = await assertCapability("manage_chatbots");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return fail("Give the chatbot a name of at least 2 characters.");

  const created = await createChatbot({
    ownerId: session.userId,
    name: parsed.data.name,
    websiteName: parsed.data.websiteName ?? null,
    allowedDomains: parsed.data.allowedDomains ?? [],
  });

  await recordAudit({
    action: AUDIT_ACTIONS.chatbotCreated,
    actorId: session.userId,
    target: { type: "chatbot", id: created.chatbotId },
    detail: { name: parsed.data.name },
  });

  revalidateProduct("chatbots");
  return { ok: true, data: created };
}

/** Hex colour, three or six digits, as the widget's CSS requires. */
const hexColour = z
  .string()
  .trim()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    "Use a hex colour such as #4f46e5.",
  );

/**
 * A URL for an avatar or logo, or an empty string meaning "none".
 *
 * Restricted to http(s) and `data:image/…`. The widget puts this in a CSS
 * `background-image`, so an unrestricted value is a way to point a customer's
 * visitors at arbitrary content, and `javascript:` in a CSS url() is a historic
 * script vector. Empty is allowed because clearing the field must be possible.
 */
const imageUrl = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .max(2_000)
    .refine((value) => {
      try {
        const { protocol } = new URL(value);
        if (protocol === "http:" || protocol === "https:") return true;
        return protocol === "data:" && value.startsWith("data:image/");
      } catch {
        return false;
      }
    }, "Use an https:// image URL."),
]);

/**
 * Appearance is a PARTIAL: `updateChatbot` merges it onto the stored value, so an
 * editor can send only what changed without clobbering the rest.
 *
 * Its absence here was a silent data-loss bug. `z.object()` strips unknown keys,
 * so an appearance patch was removed before validation ever failed —
 * `updateChatbot` received an empty object, reported success, and the operator's
 * brand colour and welcome message were gone on the next page load with no error
 * anywhere. Fields must be declared to be saved.
 */
const appearanceSchema = z
  .object({
    theme: z.enum(["light", "dark", "auto"]),
    avatar: imageUrl.nullable(),
    logo: imageUrl.nullable(),
    primaryColor: hexColour,
    secondaryColor: hexColour,
    position: z.enum(["bottom-right", "bottom-left"]),
    size: z.enum(["compact", "regular", "large"]),
    displayMode: z.enum(["bubble", "popup", "fullscreen", "embedded"]),
    welcomeMessage: z.string().trim().max(300),
    placeholder: z.string().trim().max(120),
    typingAnimation: z.boolean(),
    branding: z.boolean(),
  })
  .partial();

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  websiteName: z.string().trim().max(120).nullable().optional(),
  allowedDomains: z.array(z.string().trim().max(120)).max(50).optional(),
  modelKey: z.string().trim().max(120).nullable().optional(),
  systemPrompt: z.string().trim().max(8000).optional(),
  appearance: appearanceSchema.optional(),
});

export async function updateChatbotAction(
  chatbotId: string,
  input: z.input<typeof updateSchema>,
): Promise<ChatbotActionResult> {
  const session = await assertCapability("manage_chatbots");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail("Check the values and try again.");

  const ok = await updateChatbot(session.userId, chatbotId, parsed.data);
  if (!ok) return fail("That chatbot no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.chatbotUpdated,
    actorId: session.userId,
    target: { type: "chatbot", id: chatbotId },
  });
  revalidateProduct("chatbots");
  revalidateProductRecord("chatbots", chatbotId);
  return { ok: true };
}

export async function setChatbotStatusAction(
  chatbotId: string,
  status: "active" | "paused",
): Promise<ChatbotActionResult> {
  const session = await assertCapability("manage_chatbots");
  const ok = await setChatbotStatus(session.userId, chatbotId, status);
  if (!ok) return fail("That chatbot no longer exists.");
  await recordAudit({
    action: AUDIT_ACTIONS.chatbotUpdated,
    actorId: session.userId,
    target: { type: "chatbot", id: chatbotId },
    detail: { status },
  });
  revalidateProduct("chatbots");
  return { ok: true };
}

export async function rotatePublicTokenAction(
  chatbotId: string,
): Promise<ChatbotActionResult<{ publicToken: string }>> {
  const session = await assertCapability("manage_chatbots");
  const token = await rotatePublicToken(session.userId, chatbotId);
  if (!token) return fail("That chatbot no longer exists.");
  revalidateProductRecord("chatbots", chatbotId);
  return { ok: true, data: { publicToken: token } };
}

export async function deleteChatbotAction(
  chatbotId: string,
): Promise<ChatbotActionResult> {
  const session = await assertCapability("manage_chatbots");
  const ok = await deleteChatbot(session.userId, chatbotId);
  if (!ok) return fail("That chatbot no longer exists.");
  await recordAudit({
    action: AUDIT_ACTIONS.chatbotDeleted,
    actorId: session.userId,
    target: { type: "chatbot", id: chatbotId },
  });
  revalidateProduct("chatbots");
  return { ok: true };
}

// --- API keys ---------------------------------------------------------------

export async function createApiKeyAction(
  name: string,
): Promise<ChatbotActionResult<{ secret: string; prefix: string }>> {
  const session = await assertCapability("manage_chatbots");
  const created = await createApiKey({
    ownerId: session.userId,
    name: (name ?? "").trim() || "API key",
  });
  await recordAudit({
    action: AUDIT_ACTIONS.chatbotApiKeyCreated,
    actorId: session.userId,
    detail: { prefix: created.prefix },
  });
  revalidateProduct("chatbots/api-keys");
  return { ok: true, data: { secret: created.secret, prefix: created.prefix } };
}

export async function revokeApiKeyAction(
  id: string,
): Promise<ChatbotActionResult> {
  const session = await assertCapability("manage_chatbots");
  const ok = await revokeApiKey(session.userId, id);
  if (!ok) return fail("That key no longer exists.");
  await recordAudit({
    action: AUDIT_ACTIONS.chatbotApiKeyRevoked,
    actorId: session.userId,
  });
  revalidateProduct("chatbots/api-keys");
  return { ok: true };
}

// --- Model catalogue (admin) ------------------------------------------------

const modelSchema = z.object({
  key: z.string().trim().min(2).max(120),
  label: z.string().trim().min(1).max(80),
  provider: z.string().trim().min(1).max(40),
  inCostPerMTok: z.number().min(0).max(1000),
  outCostPerMTok: z.number().min(0).max(1000),
  maxContext: z.number().int().min(1).max(5_000_000),
  maxOutput: z.number().int().min(1).max(200_000),
  tempMin: z.number().min(0).max(2),
  tempMax: z.number().min(0).max(2),
  enabled: z.boolean(),
  planIds: z.array(z.string()).max(50),
  isDefault: z.boolean(),
});

export async function upsertModelAction(
  input: z.input<typeof modelSchema>,
): Promise<ChatbotActionResult> {
  const session = await assertCapability("manage_settings");
  const parsed = modelSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid model.");
  await upsertModel(parsed.data);
  await recordAudit({
    action: AUDIT_ACTIONS.chatbotModelUpdated,
    actorId: session.userId,
    detail: { key: parsed.data.key },
  });
  revalidatePath("/admin/chatbots/models");
  return { ok: true };
}

export async function setModelEnabledAction(
  key: string,
  enabled: boolean,
): Promise<ChatbotActionResult> {
  await assertCapability("manage_settings");
  const ok = await setModelEnabled(key, enabled);
  if (!ok) return fail("That model no longer exists.");
  revalidatePath("/admin/chatbots/models");
  return { ok: true };
}

export async function setDefaultModelAction(
  key: string,
): Promise<ChatbotActionResult> {
  await assertCapability("manage_settings");
  const ok = await setDefaultModel(key);
  if (!ok) return fail("That model no longer exists.");
  revalidatePath("/admin/chatbots/models");
  return { ok: true };
}

// --- Knowledge base ---------------------------------------------------------

const FORMATS = ["txt", "md", "html", "json", "csv"] as const;

const knowledgeSchema = z.object({
  chatbotId: z.string().min(1),
  type: z.enum(["file", "manual", "faq"]),
  format: z.enum(FORMATS),
  origin: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(500_000),
});

/**
 * Adds a knowledge source (pasted text, an uploaded text file's contents, or
 * FAQ markdown) and ingests it synchronously — extraction and chunking are
 * cheap. Ownership is re-verified against the chatbot before anything is
 * written. Binary formats and URL crawling are handled by later slices.
 */
export async function addKnowledgeSourceAction(input: {
  chatbotId: string;
  type: "file" | "manual" | "faq";
  format: KnowledgeFormat;
  origin: string;
  content: string;
}): Promise<ChatbotActionResult<{ sourceId: string; chunkCount: number }>> {
  const session = await assertCapability("manage_chatbots");
  const parsed = knowledgeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Add a name and some content (txt, md, html, json, or csv).");
  }

  // Re-verify the chatbot belongs to this owner before ingesting into it.
  const bot = await getChatbot(session.userId, parsed.data.chatbotId);
  if (!bot) return fail("That chatbot no longer exists.");

  const result = await ingestContent({
    ownerId: session.userId,
    chatbotId: parsed.data.chatbotId,
    type: parsed.data.type,
    format: parsed.data.format,
    origin: parsed.data.origin,
    content: parsed.data.content,
    title: parsed.data.origin,
  });

  revalidatePath(`/admin/chatbots/${parsed.data.chatbotId}`);

  if (!result.ok) {
    return fail(
      result.reason === "unsupported"
        ? "That format needs a parser we have not enabled yet."
        : "The content could not be indexed. Check it and try again.",
    );
  }
  await recordAudit({
    action: AUDIT_ACTIONS.chatbotUpdated,
    actorId: session.userId,
    target: { type: "chatbot", id: parsed.data.chatbotId },
    detail: { knowledge: "added", chunks: result.chunkCount },
  });
  return {
    ok: true,
    data: { sourceId: result.sourceId, chunkCount: result.chunkCount },
  };
}

export async function deleteKnowledgeSourceAction(
  chatbotId: string,
  sourceId: string,
): Promise<ChatbotActionResult> {
  const session = await assertCapability("manage_chatbots");
  const ok = await deleteSource(session.userId, chatbotId, sourceId);
  if (!ok) return fail("That source no longer exists.");
  revalidateProductRecord("chatbots", chatbotId);
  return { ok: true };
}
