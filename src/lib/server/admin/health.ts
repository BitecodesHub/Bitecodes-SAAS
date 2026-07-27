import "server-only";

import { pingDatabase } from "@/lib/server/db/collections";
import { verifyTransport } from "@/lib/server/email/transport";
import {
  getCronSecret,
  getOverpassEndpoint,
  hasSigningSecret,
} from "@/lib/server/env";
import {
  getSettingsFresh,
  hasPlaceholderContactDetails,
} from "@/lib/server/settings";

/**
 * Live system health.
 *
 * Every check performs a real round trip. Reporting "SMTP configured" because an
 * environment variable is set is worthless — the failure modes that matter are a
 * wrong password, a blocked port, and an IP that is not on the database
 * allowlist, none of which are visible from configuration alone.
 */

export type HealthStatus = "ok" | "warn" | "fail" | "not-configured";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  detail: string;
  latencyMs?: number;
  /** What to do about it, when there is something to do. */
  remedy?: string;
}

const PROBE_TIMEOUT_MS = 6_000;

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const [database, smtp, openRouter, overpass, configuration] =
    await Promise.all([
      checkDatabase(),
      checkSmtp(),
      checkOpenRouter(),
      checkOverpass(),
      checkConfiguration(),
    ]);

  return [database, smtp, openRouter, overpass, ...configuration];
}

async function checkDatabase(): Promise<HealthCheck> {
  const result = await pingDatabase();
  if (result.ok) {
    return {
      name: "MongoDB",
      status: "ok",
      detail: "Connected.",
      latencyMs: result.latencyMs,
    };
  }

  const looksLikeAllowlist = /tlsv1 alert|ssl3_read_bytes|handshake/i.test(
    result.error ?? "",
  );

  return {
    name: "MongoDB",
    status: "fail",
    detail: result.error ?? "Unreachable.",
    // This specific TLS error is what Atlas returns for an unlisted source IP,
    // and it reads like a certificate problem, which sends people the wrong way
    // for hours.
    remedy: looksLikeAllowlist
      ? "This TLS error is what Atlas returns when the connecting IP is not on the cluster's IP access list. Add this deployment's egress IPs there."
      : "Check MONGODB_URI and that the database is reachable from this deployment.",
  };
}

async function checkSmtp(): Promise<HealthCheck> {
  if (!process.env.SMTP_HOST) {
    return {
      name: "SMTP",
      status: "not-configured",
      detail: "No SMTP host configured.",
      remedy: "Set SMTP_* in the environment. Email will not send without it.",
    };
  }

  const result = await verifyTransport();
  return result.ok
    ? {
        name: "SMTP",
        status: "ok",
        detail: "Connected and authenticated.",
        latencyMs: result.latencyMs,
      }
    : {
        name: "SMTP",
        status: "fail",
        detail: result.error ?? "Verification failed.",
        remedy:
          "Check the credentials and that the port is not blocked. No email can be sent until this passes.",
      };
}

async function checkOpenRouter(): Promise<HealthCheck> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return {
      name: "OpenRouter",
      status: "not-configured",
      detail: "No API key configured.",
      remedy:
        "Set OPENROUTER_API_KEY to enable the AI consultant, the chatbot, and AI drafting.",
    };
  }

  const started = Date.now();
  try {
    // The key endpoint reports quota and validity without spending a token.
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        name: "OpenRouter",
        status: "fail",
        detail: `Provider returned ${response.status}.`,
        latencyMs: Date.now() - started,
        remedy:
          response.status === 401
            ? "The API key was rejected. Rotate it and update OPENROUTER_API_KEY."
            : "Check OpenRouter's status page.",
      };
    }

    const payload = (await response.json()) as {
      data?: { limit_remaining?: number | null; usage?: number };
    };
    const remaining = payload.data?.limit_remaining;

    return {
      name: "OpenRouter",
      status:
        remaining !== null && remaining !== undefined && remaining <= 0
          ? "warn"
          : "ok",
      detail:
        remaining === null || remaining === undefined
          ? "Key valid. No spend limit set."
          : `Key valid. ${remaining.toFixed(2)} credit remaining.`,
      latencyMs: Date.now() - started,
      remedy:
        remaining !== null && remaining !== undefined && remaining <= 0
          ? "Credit is exhausted, so AI features will fail. Top up the account."
          : undefined,
    };
  } catch (error) {
    return {
      name: "OpenRouter",
      status: "fail",
      detail: error instanceof Error ? error.message : "Unreachable.",
      latencyMs: Date.now() - started,
    };
  }
}

async function checkOverpass(): Promise<HealthCheck> {
  const endpoint = getOverpassEndpoint();
  const started = Date.now();

  try {
    // The status endpoint reports rate-limit slots without running a query, so
    // the health check itself does not consume the shared quota.
    const statusUrl = endpoint.replace(/\/interpreter\/?$/, "/status");
    const response = await fetch(statusUrl, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
      headers: {
        "User-Agent": "Bitecodes-Admin-Health/1.0 (+https://bitecodes.com)",
      },
    });

    if (!response.ok) {
      return {
        name: "Overpass (OpenStreetMap)",
        status: "warn",
        detail: `Status endpoint returned ${response.status}.`,
        latencyMs: Date.now() - started,
        remedy: "Discovery may be slow or unavailable. Try again later.",
      };
    }

    const body = await response.text();
    const slots = /(\d+) slots available now/.exec(body);

    return {
      name: "Overpass (OpenStreetMap)",
      status: slots && Number(slots[1]) === 0 ? "warn" : "ok",
      detail: slots ? `${slots[1]} query slot(s) available.` : "Reachable.",
      latencyMs: Date.now() - started,
      remedy:
        slots && Number(slots[1]) === 0
          ? "No slots free right now — this is a shared community service. Discovery will queue."
          : undefined,
    };
  } catch (error) {
    return {
      name: "Overpass (OpenStreetMap)",
      status: "warn",
      detail: error instanceof Error ? error.message : "Unreachable.",
      latencyMs: Date.now() - started,
      remedy: "Map discovery will not run until this is reachable.",
    };
  }
}

/**
 * Configuration checks: things that are wrong on paper rather than at runtime,
 * and would otherwise only surface when a feature silently refuses to work.
 */
async function checkConfiguration(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  checks.push(
    hasSigningSecret()
      ? { name: "Signing secret", status: "ok", detail: "AUTH_SECRET is set." }
      : {
          name: "Signing secret",
          status: "fail",
          detail: "AUTH_SECRET is missing or shorter than 32 characters.",
          remedy:
            "Unsubscribe links, report links, and portal links cannot be issued. Generate one with: openssl rand -base64 32",
        },
  );

  checks.push(
    getCronSecret()
      ? { name: "Job runner", status: "ok", detail: "CRON_SECRET is set." }
      : {
          name: "Job runner",
          status: "fail",
          detail: "CRON_SECRET is missing.",
          remedy:
            "The job runner refuses to run without it, so no automation will execute. Generate one with: openssl rand -hex 16",
        },
  );

  try {
    const settings = await getSettingsFresh();

    checks.push(
      settings.contact.address.postal
        ? {
            name: "Postal address",
            status: "ok",
            detail: "Set, so outreach can include the required footer.",
          }
        : {
            name: "Postal address",
            status: "warn",
            detail: "No postal address configured.",
            remedy:
              "Commercial email legally requires one, and the send pipeline blocks outreach without it. Add it under Settings.",
          },
    );

    if (hasPlaceholderContactDetails(settings)) {
      checks.push({
        name: "Contact details",
        status: "warn",
        detail: "Placeholder contact details are still in use.",
        remedy:
          "These are published in Organization structured data, llms.txt, and every outbound email. Replace them under Settings.",
      });
    }

    if (!settings.automation.requireApproval) {
      checks.push({
        name: "Outreach approval",
        status: "warn",
        detail: "Outreach sends without human approval.",
        remedy:
          "Fully automated cold email is deliberately off by default. Confirm this is intended.",
      });
    }
  } catch {
    checks.push({
      name: "Settings",
      status: "fail",
      detail: "Could not read settings from the database.",
    });
  }

  return checks;
}

/** The worst status present, for a single summary indicator. */
export function overallHealth(checks: HealthCheck[]): HealthStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  if (checks.some((check) => check.status === "not-configured")) {
    return "not-configured";
  }
  return "ok";
}
