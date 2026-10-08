"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import {
  DESKTOP_PROVIDER_IDS,
  resolveDesktopChain,
  setRouting,
  upsertProvider,
} from "@/lib/server/desktop/providers";
import {
  runDesktopCompletion,
  GatewayError,
} from "@/lib/server/desktop/gateway";
import { decryptSecret } from "@/lib/server/crypto";
import { desktopProviders } from "@/lib/server/db/collections";
import { adminRevokeDevice } from "@/lib/server/desktop/devices";
import {
  PROVIDER_DEFAULTS,
  type ResolvedProvider,
} from "@/lib/server/desktop/providers";
import type {
  DesktopProviderEntryDoc,
  DesktopProviderId,
} from "@/lib/server/db/types";

/**
 * Admin actions for the desktop app's provider routing. All gated by
 * `manage_settings` (the capability that already governs AI configuration),
 * and audited — the audit entry records WHAT changed, never the key itself.
 */

export type AdminResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const providerId = z.enum(["nvidia", "openrouter", "groq", "bedrock"]);

const providerSchema = z.object({
  id: providerId,
  enabled: z.boolean(),
  /** undefined = keep stored key; "" = clear it. */
  apiKey: z.string().max(4000).optional(),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  region: z.string().trim().max(40).nullable().optional(),
  model: z.string().trim().min(1, "Model is required").max(200),
  visionModel: z.string().trim().max(200),
});

function validBaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

export async function saveDesktopProviderAction(
  input: z.input<typeof providerSchema>,
): Promise<AdminResult> {
  const session = await requireCapability("manage_settings");
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  const v = parsed.data;

  if (v.id !== "bedrock") {
    if (!v.baseUrl || !validBaseUrl(v.baseUrl))
      return { ok: false, error: "Base URL must be an https:// URL." };
  } else if (!v.region || !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(v.region)) {
    return { ok: false, error: "Choose a valid AWS region." };
  }

  await upsertProvider(v.id, {
    enabled: v.enabled,
    ...(v.apiKey !== undefined ? { apiKey: v.apiKey } : {}),
    baseUrl: v.id === "bedrock" ? null : (v.baseUrl ?? null),
    region: v.id === "bedrock" ? (v.region ?? null) : null,
    model: v.model,
    visionModel: v.visionModel,
  });
  await recordAudit({
    actorId: session.userId,
    action: AUDIT_ACTIONS.desktopProvidersChanged,
    target: { type: "desktop_provider", id: v.id },
    detail: {
      enabled: v.enabled,
      model: v.model,
      visionModel: v.visionModel,
      keyChanged: v.apiKey !== undefined,
    },
  });
  revalidatePath("/admin/desktop");
  return { ok: true, message: "Saved." };
}

const routingSchema = z.object({
  enabled: z.boolean(),
  defaultProvider: providerId,
  fallback: z.array(providerId).max(3),
});

export async function saveDesktopRoutingAction(
  input: z.input<typeof routingSchema>,
): Promise<AdminResult> {
  const session = await requireCapability("manage_settings");
  const parsed = routingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid routing." };
  await setRouting(parsed.data);
  if (parsed.data.enabled && (await resolveDesktopChain()).length === 0) {
    // Saved, but warn: switched on with nothing usable behind it.
    await recordAudit({
      actorId: session.userId,
      action: AUDIT_ACTIONS.desktopProvidersChanged,
      target: { type: "desktop_routing", id: "routing" },
      detail: parsed.data,
    });
    revalidatePath("/admin/desktop");
    return {
      ok: true,
      message:
        "Saved — but no enabled provider has an API key yet, so desktop users will see “not available”.",
    };
  }
  await recordAudit({
    actorId: session.userId,
    action: AUDIT_ACTIONS.desktopProvidersChanged,
    target: { type: "desktop_routing", id: "routing" },
    detail: parsed.data,
  });
  revalidatePath("/admin/desktop");
  return { ok: true, message: "Routing saved." };
}

/**
 * Sends one tiny prompt through ONE provider (its text model, then its vision
 * model if set) regardless of routing, so the operator can verify a key and
 * model ids before switching users onto them.
 */
export async function testDesktopProviderAction(
  id: DesktopProviderId,
): Promise<AdminResult> {
  await requireCapability("manage_settings");
  if (!DESKTOP_PROVIDER_IDS.includes(id))
    return { ok: false, error: "Unknown provider." };
  const doc = (await (
    await desktopProviders()
  ).findOne({ _id: id })) as DesktopProviderEntryDoc | null;
  const apiKey = decryptSecret(doc?.apiKeyCipher);
  if (!doc || !apiKey) return { ok: false, error: "Save an API key first." };
  const d = PROVIDER_DEFAULTS[id];
  const provider: ResolvedProvider = {
    id,
    apiKey,
    baseUrl: doc.baseUrl ?? d.baseUrl,
    region: doc.region ?? d.region,
    model: doc.model || d.model,
    visionModel: "",
  };
  const started = Date.now();
  try {
    const out = await runDesktopCompletion([provider], {
      prompt: "Reply with exactly the word: pong",
      maxTokens: 512,
      signal: AbortSignal.timeout(60_000),
    });
    return {
      ok: true,
      message: `Text model OK in ${((Date.now() - started) / 1000).toFixed(1)}s — replied “${out.text.trim().slice(0, 40)}”.`,
    };
  } catch (error) {
    const detail =
      error instanceof GatewayError
        ? error.attempted.map((a) => a.outcome).join("; ")
        : String(error);
    return { ok: false, error: `Failed: ${detail.slice(0, 300)}` };
  }
}

/** Disconnect any user's desktop device. The app signs out on its next request. */
export async function adminRevokeDeviceAction(
  id: string,
): Promise<AdminResult> {
  const session = await requireCapability("manage_settings");
  const ok = await adminRevokeDevice(String(id ?? ""), session.userId);
  if (!ok) return { ok: false, error: "That device is already disconnected." };
  await recordAudit({
    actorId: session.userId,
    action: AUDIT_ACTIONS.desktopDeviceRevoked,
    target: { type: "desktop_device", id: String(id) },
  });
  revalidatePath("/admin/desktop/activity");
  return { ok: true, message: "Device disconnected" };
}
