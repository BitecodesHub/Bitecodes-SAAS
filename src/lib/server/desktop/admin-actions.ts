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
import { setLimits } from "@/lib/server/desktop/quota";
import { setRelease } from "@/lib/server/desktop/release";
import { validBaseUrl } from "@/lib/server/desktop/providers";
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

function hostOf(url: string | null | undefined): string | null {
  try {
    return url ? new URL(url).host.toLowerCase() : null;
  } catch {
    return null;
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
      return {
        ok: false,
        error:
          "Base URL must be a public https:// address (no localhost or private networks).",
      };
  } else if (!v.region || !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(v.region)) {
    return { ok: false, error: "Choose a valid AWS region." };
  }

  // Moving a provider to a different host without supplying a key drops the
  // stored key: otherwise the next request would hand it to the new host.
  const before = await (await desktopProviders()).findOne({ _id: v.id });
  const oldHost =
    before && before.kind === "provider"
      ? hostOf((before as DesktopProviderEntryDoc).baseUrl)
      : null;
  const newHost = v.id === "bedrock" ? null : hostOf(v.baseUrl);
  const hostChanged =
    v.id !== "bedrock" && oldHost !== null && newHost !== oldHost;
  const keyUpdate =
    v.apiKey !== undefined
      ? { apiKey: v.apiKey }
      : hostChanged
        ? { apiKey: "" }
        : {};

  await upsertProvider(v.id, {
    enabled: v.enabled,
    ...keyUpdate,
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
      keyChanged: v.apiKey !== undefined || hostChanged,
      ...(hostChanged ? { hostChanged: { from: oldHost, to: newHost } } : {}),
    },
  });
  revalidatePath("/admin/desktop");
  return {
    ok: true,
    message:
      hostChanged && v.apiKey === undefined
        ? "Saved. The base URL moved to a new host, so the stored key was removed — paste the key for the new host."
        : "Saved.",
  };
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

const limitsSchema = z.object({
  userDailyRequests: z.number().int().min(0).max(1_000_000_000),
  userDailyTokens: z.number().int().min(0).max(1_000_000_000),
  globalDailyTokens: z.number().int().min(0).max(1_000_000_000),
  access: z.enum(["everyone", "staff"]),
});

/** Daily caps for the Bitecodes model (0 = unlimited). */
export async function saveDesktopLimitsAction(
  input: z.input<typeof limitsSchema>,
): Promise<AdminResult> {
  const session = await requireCapability("manage_settings");
  const parsed = limitsSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Limits must be whole numbers (0 = unlimited).",
    };
  const saved = await setLimits(parsed.data);
  await recordAudit({
    actorId: session.userId,
    action: AUDIT_ACTIONS.desktopProvidersChanged,
    target: { type: "desktop_limits", id: "limits" },
    detail: { ...saved },
  });
  revalidatePath("/admin/desktop");
  return { ok: true, message: "Limits saved." };
}

const versionField = z.union([
  z.literal(""),
  z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/, "Versions look like 1.8.0"),
]);
const urlField = z.union([
  z.literal(""),
  z.string().url().startsWith("https://", "Download links must be https://"),
]);
const releaseSchema = z.object({
  latestVersion: versionField,
  minimumVersion: versionField,
  notes: z.string().max(2000),
  downloads: z.object({
    macArm64: urlField,
    macX64: urlField,
    winX64: urlField,
    winArm64: urlField,
  }),
});

/** Publish the desktop app's update feed (latest/minimum version, download links). */
export async function saveDesktopReleaseAction(
  input: z.input<typeof releaseSchema>,
): Promise<AdminResult> {
  const session = await requireCapability("manage_settings");
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid release.",
    };
  const saved = await setRelease(parsed.data);
  await recordAudit({
    actorId: session.userId,
    action: AUDIT_ACTIONS.desktopProvidersChanged,
    target: { type: "desktop_release", id: "release" },
    detail: {
      latestVersion: saved.latestVersion,
      minimumVersion: saved.minimumVersion,
    },
  });
  revalidatePath("/admin/desktop");
  return { ok: true, message: "Release published." };
}
