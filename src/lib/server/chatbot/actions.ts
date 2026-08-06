"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
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

  revalidatePath("/admin/chatbots");
  return { ok: true, data: created };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  websiteName: z.string().trim().max(120).nullable().optional(),
  allowedDomains: z.array(z.string().trim().max(120)).max(50).optional(),
  modelKey: z.string().trim().max(120).nullable().optional(),
  systemPrompt: z.string().trim().max(8000).optional(),
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
  revalidatePath("/admin/chatbots");
  revalidatePath(`/admin/chatbots/${chatbotId}`);
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
  revalidatePath("/admin/chatbots");
  return { ok: true };
}

export async function rotatePublicTokenAction(
  chatbotId: string,
): Promise<ChatbotActionResult<{ publicToken: string }>> {
  const session = await assertCapability("manage_chatbots");
  const token = await rotatePublicToken(session.userId, chatbotId);
  if (!token) return fail("That chatbot no longer exists.");
  revalidatePath(`/admin/chatbots/${chatbotId}`);
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
  revalidatePath("/admin/chatbots");
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
  revalidatePath("/admin/chatbots/api-keys");
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
  revalidatePath("/admin/chatbots/api-keys");
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
