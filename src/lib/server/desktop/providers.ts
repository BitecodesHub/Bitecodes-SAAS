import "server-only";

import { desktopProviders } from "@/lib/server/db/collections";
import type {
  DesktopProviderEntryDoc,
  DesktopProviderId,
  DesktopRoutingDoc,
} from "@/lib/server/db/types";
import { decryptSecret, encryptSecret, secretHint } from "@/lib/server/crypto";

/**
 * Operator-global configuration for the desktop companion app's "Bitecodes
 * model".
 *
 * The operator sets up to four upstream providers (NVIDIA, OpenRouter, Groq,
 * AWS Bedrock) once in the admin panel, plus a default + fallback order. Every
 * desktop user who signs in routes through these — they never see or configure
 * a provider, and never learn which model answered. Provider API keys are
 * stored encrypted (reversibly, via crypto.encryptSecret) because they must be
 * presented to the upstream provider in the clear.
 */

export const ROUTING_ID = "__routing__" as const;

export const DESKTOP_PROVIDER_IDS: DesktopProviderId[] = [
  "nvidia",
  "openrouter",
  "groq",
  "bedrock",
];

export interface ProviderDefaults {
  label: string;
  baseUrl: string | null;
  region: string | null;
  model: string;
  visionModel: string;
}

/**
 * Sensible starting points, verified against the live catalogs on 2026-10-06.
 * These are only defaults the operator can override; stale ids are harmless
 * because the runtime gateway falls back and the operator sets real values.
 */
export const PROVIDER_DEFAULTS: Record<DesktopProviderId, ProviderDefaults> = {
  nvidia: {
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    region: null,
    // gpt-oss-20b answered fast and correctly where larger NIM models queued.
    model: "openai/gpt-oss-20b",
    visionModel: "meta/llama-3.2-90b-vision-instruct",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    region: null,
    // auto-router picks a capable model and fails over server-side.
    model: "openrouter/auto",
    visionModel: "openai/gpt-4o-mini",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    region: null,
    // Verified 2026-10-08: both answer in well under a second; qwen3.8 reads
    // screenshots (Groq has no other vision model in its catalog today).
    model: "openai/gpt-oss-120b",
    visionModel: "qwen/qwen3.8-27b",
  },
  bedrock: {
    label: "Amazon Bedrock",
    baseUrl: null,
    region: "ap-southeast-2",
    model: "amazon.nova-lite-v1:0",
    visionModel: "amazon.nova-lite-v1:0",
  },
};

export const DEFAULT_ROUTING: Pick<
  DesktopRoutingDoc,
  "defaultProvider" | "fallback" | "enabled"
> = {
  enabled: false,
  defaultProvider: "openrouter",
  fallback: ["groq", "nvidia", "bedrock"],
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** A provider entry with its key redacted — safe for the admin UI. */
export interface ProviderView {
  id: DesktopProviderId;
  label: string;
  enabled: boolean;
  hasKey: boolean;
  apiKeyHint: string | null;
  baseUrl: string | null;
  region: string | null;
  model: string;
  visionModel: string;
}

function toView(
  id: DesktopProviderId,
  doc: DesktopProviderEntryDoc | null,
): ProviderView {
  const d = PROVIDER_DEFAULTS[id];
  return {
    id,
    label: d.label,
    enabled: doc?.enabled ?? false,
    hasKey: Boolean(doc?.apiKeyCipher),
    apiKeyHint: doc?.apiKeyHint ?? null,
    baseUrl: doc?.baseUrl ?? d.baseUrl,
    region: doc?.region ?? d.region,
    model: doc?.model ?? d.model,
    visionModel: doc?.visionModel ?? d.visionModel,
  };
}

async function readEntry(
  id: DesktopProviderId,
): Promise<DesktopProviderEntryDoc | null> {
  const col = await desktopProviders();
  const doc = await col.findOne({ _id: id });
  // findOne returns the DesktopProviderDoc union; narrow to the provider shape.
  return doc && doc.kind === "provider"
    ? (doc as DesktopProviderEntryDoc)
    : null;
}

/** Every provider (key-redacted) for the admin UI. */
export async function listProviderViews(): Promise<ProviderView[]> {
  const col = await desktopProviders();
  const docs = await col.find({ kind: "provider" }).toArray();
  const byId = new Map(docs.map((d) => [d._id, d as DesktopProviderEntryDoc]));
  return DESKTOP_PROVIDER_IDS.map((id) => toView(id, byId.get(id) ?? null));
}

export async function getRouting(): Promise<
  Pick<DesktopRoutingDoc, "enabled" | "defaultProvider" | "fallback">
> {
  const col = await desktopProviders();
  const doc = await col.findOne({ _id: ROUTING_ID });
  if (doc && doc.kind === "routing") {
    return {
      enabled: doc.enabled,
      defaultProvider: doc.defaultProvider,
      fallback: doc.fallback,
    };
  }
  return { ...DEFAULT_ROUTING };
}

// ---------------------------------------------------------------------------
// Writes (admin)
// ---------------------------------------------------------------------------

export interface ProviderUpdate {
  enabled?: boolean;
  /** New plaintext key. Omit to keep the stored key; null/"" to clear it. */
  apiKey?: string | null;
  baseUrl?: string | null;
  region?: string | null;
  model?: string;
  visionModel?: string;
}

export async function upsertProvider(
  id: DesktopProviderId,
  update: ProviderUpdate,
): Promise<void> {
  if (!DESKTOP_PROVIDER_IDS.includes(id)) {
    throw new Error(`Unknown desktop provider: ${id}`);
  }
  const col = await desktopProviders();
  const now = new Date();
  const existing = await readEntry(id);
  const d = PROVIDER_DEFAULTS[id];

  const set: Partial<DesktopProviderEntryDoc> = {
    kind: "provider",
    enabled: update.enabled ?? existing?.enabled ?? false,
    baseUrl:
      update.baseUrl !== undefined
        ? update.baseUrl
        : (existing?.baseUrl ?? d.baseUrl),
    region:
      update.region !== undefined
        ? update.region
        : (existing?.region ?? d.region),
    model: (update.model ?? existing?.model ?? d.model).trim() || d.model,
    visionModel:
      update.visionModel !== undefined
        ? update.visionModel.trim()
        : (existing?.visionModel ?? d.visionModel),
    updatedAt: now,
  };

  if (update.apiKey !== undefined) {
    const key = (update.apiKey ?? "").trim();
    set.apiKeyCipher = key ? encryptSecret(key) : null;
    set.apiKeyHint = key ? secretHint(key) : null;
  }

  await col.updateOne(
    { _id: id },
    { $set: set, $setOnInsert: { _id: id, createdAt: now } },
    { upsert: true },
  );
}

export async function setRouting(
  routing: Pick<DesktopRoutingDoc, "enabled" | "defaultProvider" | "fallback">,
): Promise<void> {
  if (!DESKTOP_PROVIDER_IDS.includes(routing.defaultProvider)) {
    throw new Error("default provider must be one of the known providers");
  }
  // Fallback: known ids only, de-duplicated, never including the default.
  const fallback = routing.fallback.filter(
    (p, i, a) =>
      DESKTOP_PROVIDER_IDS.includes(p) &&
      p !== routing.defaultProvider &&
      a.indexOf(p) === i,
  );
  const col = await desktopProviders();
  const now = new Date();
  await col.updateOne(
    { _id: ROUTING_ID },
    {
      $set: {
        kind: "routing",
        enabled: routing.enabled,
        defaultProvider: routing.defaultProvider,
        fallback,
        updatedAt: now,
      },
      $setOnInsert: { _id: ROUTING_ID, createdAt: now },
    },
    { upsert: true },
  );
}

// ---------------------------------------------------------------------------
// Runtime resolution (gateway)
// ---------------------------------------------------------------------------

/** A ready-to-call provider: decrypted key + everything the gateway needs. */
export interface ResolvedProvider {
  id: DesktopProviderId;
  apiKey: string;
  baseUrl: string | null;
  region: string | null;
  model: string;
  visionModel: string;
}

/**
 * The ordered list of usable providers for a request: default first, then the
 * configured fallbacks — each one enabled, with a decrypted key. A provider
 * that is disabled, keyless, or whose key fails to decrypt is dropped. Returns
 * [] when the integration is off or nothing is configured, which the caller
 * turns into a clean "not configured" response.
 */
export async function resolveDesktopChain(): Promise<ResolvedProvider[]> {
  const routing = await getRouting();
  if (!routing.enabled) return [];

  const order: DesktopProviderId[] = [
    routing.defaultProvider,
    ...routing.fallback,
  ].filter((p, i, a) => a.indexOf(p) === i);

  const chain: ResolvedProvider[] = [];
  for (const id of order) {
    const doc = await readEntry(id);
    if (!doc || !doc.enabled || !doc.apiKeyCipher) continue;
    const apiKey = decryptSecret(doc.apiKeyCipher);
    if (!apiKey) continue;
    const d = PROVIDER_DEFAULTS[id];
    chain.push({
      id,
      apiKey,
      baseUrl: doc.baseUrl ?? d.baseUrl,
      region: doc.region ?? d.region,
      model: doc.model || d.model,
      visionModel: doc.visionModel || d.visionModel,
    });
  }
  return chain;
}
