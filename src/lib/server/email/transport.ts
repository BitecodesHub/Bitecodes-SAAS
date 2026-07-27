import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { getServerEnv } from "@/lib/server/env";

/**
 * The shared SMTP transport.
 *
 * Pooled and cached on `global` so a dev-server hot reload reuses the same
 * connections instead of leaking a new pool on every edit, and so a burst of
 * queued outreach reuses one TCP/TLS handshake rather than renegotiating per
 * message.
 */

declare global {
  var __bitecodesMailTransporter: Transporter | undefined;
}

export function getTransporter(): Transporter {
  if (global.__bitecodesMailTransporter)
    return global.__bitecodesMailTransporter;

  const env = getServerEnv();
  global.__bitecodesMailTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  return global.__bitecodesMailTransporter;
}

/**
 * Opens a connection and authenticates without sending anything.
 *
 * Used by the admin health panel and before any bulk run: discovering bad SMTP
 * credentials from a failed campaign is far more expensive than discovering
 * them from a button.
 */
export async function verifyTransport(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    await getTransporter().verify();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** Drops the pooled transport, so a settings change takes effect. */
export function resetTransporter() {
  global.__bitecodesMailTransporter?.close();
  global.__bitecodesMailTransporter = undefined;
}
