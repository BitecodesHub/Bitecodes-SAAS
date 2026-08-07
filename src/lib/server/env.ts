import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().trim().min(1).default("bitecodes"),
  SMTP_HOST: z.string().trim().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().trim().min(3),
  CONTACT_NOTIFICATION_TO: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().email()).min(1)),

  // --- Added for the admin panel, automation, and outreach. ---
  // Every variable below is OPTIONAL with a working default so that adding
  // this code cannot break an existing deployment whose .env predates it.
  // Features that genuinely require a value check for it themselves and
  // degrade gracefully (see `isAutomationConfigured`).

  /** Signs sessions, unsubscribe links, report links, and portal tokens. */
  AUTH_SECRET: z.string().min(32).optional(),
  /** Bearer token required by the job-runner endpoint. */
  CRON_SECRET: z.string().min(16).optional(),
  /** Absolute site origin for links inside emails. Falls back to siteConfig. */
  SITE_URL: z.string().url().optional(),

  /** Sender identity for cold outreach, kept separate from transactional mail. */
  OUTREACH_FROM: z.string().trim().min(3).optional(),
  OUTREACH_REPLY_TO: z.string().trim().min(3).optional(),
  /** Postal address required in outreach footers by CAN-SPAM. */
  OUTREACH_POSTAL_ADDRESS: z.string().trim().min(5).optional(),

  /** Prospect discovery providers. Defaults are the public OSM endpoints. */
  OVERPASS_ENDPOINT: z
    .string()
    .url()
    .default("https://overpass-api.de/api/interpreter"),
  NOMINATIM_ENDPOINT: z
    .string()
    .url()
    .default("https://nominatim.openstreetmap.org"),
  /** Opt-in only. Google's Places TOS restricts storing results. */
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),

  /** Optional IMAP polling so sequences can stop automatically on a reply. */
  IMAP_HOST: z.string().trim().min(1).optional(),
  IMAP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  IMAP_USER: z.string().min(1).optional(),
  IMAP_PASSWORD: z.string().min(1).optional(),

  /** Key file served at /<key>.txt for IndexNow submissions. */
  INDEXNOW_KEY: z
    .string()
    .regex(/^[a-zA-Z0-9-]{8,128}$/)
    .optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let parsedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (parsedEnv) return parsedEnv;

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const variables = Object.keys(result.error.flatten().fieldErrors).join(
      ", ",
    );
    throw new Error(`Server configuration is missing or invalid: ${variables}`);
  }

  parsedEnv = result.data;
  return parsedEnv;
}

/**
 * Narrow readers below deliberately bypass `getServerEnv()`.
 *
 * `getServerEnv()` validates the whole schema and throws if *any* required
 * variable is missing, which couples unrelated features together: without
 * these, a missing SMTP password would break admin login. Each reader
 * validates only what its own caller needs.
 */

/**
 * Database connection details, read narrowly.
 *
 * The public site needs only MongoDB, not SMTP or contact configuration, so the
 * connection must not depend on the full-schema `getServerEnv()`. Without this,
 * a deployment missing an unrelated variable (say `CONTACT_NOTIFICATION_TO`)
 * would fail every database read — including the static-feeling public routes
 * that render the blog, sitemap, and feeds.
 */
export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI must be set to connect to the database.");
  }
  return uri;
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB_NAME?.trim() || "bitecodes";
}

/** The HMAC key for signed tokens and session signatures. */
export function getSigningSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to at least 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
  return secret;
}

export function hasSigningSecret(): boolean {
  return (process.env.AUTH_SECRET?.trim().length ?? 0) >= 32;
}

/**
 * Absolute origin used for links inside emails, signed report URLs, canonical
 * tags, and the embed snippets customers paste into their own sites.
 *
 * Must be the host that is actually *served*, not the one that redirects to it.
 * The apex answers 308 to `www`, and while a browser follows that happily for a
 * page, it refuses to follow it for a CORS **preflight** — so an embed snippet
 * pointing at the apex made every widget fail with "Redirect is not allowed for
 * a preflight request". curl follows redirects and reported success, which is
 * what let that ship unnoticed.
 */
export function getSiteUrl(): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return "https://www.bitecodes.com";
}

export function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

export function getOverpassEndpoint(): string {
  return (
    process.env.OVERPASS_ENDPOINT?.trim() ||
    "https://overpass-api.de/api/interpreter"
  );
}

export function getNominatimEndpoint(): string {
  return (
    process.env.NOMINATIM_ENDPOINT?.trim().replace(/\/+$/, "") ||
    "https://nominatim.openstreetmap.org"
  );
}

export function getGooglePlacesKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || null;
}

/**
 * Razorpay credentials. All three are required before live checkout is offered;
 * until then the billing module falls back to its manual provider, so the
 * product ships and sells without a gateway configured.
 */
export function getRazorpayConfig(): {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
} | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!keyId || !keySecret || !webhookSecret) return null;
  return { keyId, keySecret, webhookSecret };
}

export function getIndexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && /^[a-zA-Z0-9-]{8,128}$/.test(key) ? key : null;
}

export function getImapConfig() {
  const host = process.env.IMAP_HOST?.trim();
  const user = process.env.IMAP_USER?.trim();
  const password = process.env.IMAP_PASSWORD;
  if (!host || !user || !password) return null;
  return {
    host,
    user,
    password,
    port: Number(process.env.IMAP_PORT ?? 993),
  };
}
