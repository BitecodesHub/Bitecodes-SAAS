import "server-only";

import { getAiProviderConfig } from "@/lib/server/ai-provider";
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
import { GROWTH_TOGGLE_KEYS, getGrowthToggle } from "@/lib/growth/toggles";

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

/** The worst status present, for a single summary indicator. */
export function overallHealth(checks: HealthCheck[]): HealthStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  if (checks.some((check) => check.status === "not-configured")) {
    return "not-configured";
  }
  return "ok";
}

/** Growth engine checks: switches, job health, and toggle states. */
async function checkGrowthEngine(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const settings = await getSettingsFresh();

  // Check each growth toggle
  for (const key of GROWTH_TOGGLE_KEYS) {
    const toggle = getGrowthToggle(key as (typeof GROWTH_TOGGLE_KEYS)[number]);
    const isOn = settings.growth[key];
    if (toggle.sendsExternalEmail && !isOn) {
      checks.push({
        name: `Growth: ${toggle.label}`,
        status: "warn",
        detail: "Switched off — no external emails will be sent.",
        remedy:
          "Enable the toggle if you want this automation to send emails, or leave off if manual control is preferred.",
      });
    } else if (!toggle.sendsExternalEmail && !isOn) {
      checks.push({
        name: `Growth: ${toggle.label}`,
        status: "ok",
        detail: "Switched off — no external emails will be sent.",
      });
    } else {
      checks.push({
        name: `Growth: ${toggle.label}`,
        status: "ok",
        detail: "Switched on.",
      });
    }
  }

  // Check weekly report specifically
  if (settings.growth.weeklyReport) {
    checks.push({
      name: "Growth: weekly report",
      status: "ok",
      detail: "Weekly report is enabled.",
    });
  } else {
    checks.push({
      name: "Growth: weekly report",
      status: "warn",
      detail: "Weekly report is disabled.",
      remedy:
        "Enable under Settings > Growth to receive a written summary every Monday.",
    });
  }

  // Check job runner
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    checks.push({
      name: "Growth: job runner",
      status: "fail",
      detail: "CRON_SECRET is missing or too short.",
      remedy:
        "Generate one with: openssl rand -hex 16. The job runner refuses to run without it.",
    });
  } else {
    checks.push({
      name: "Growth: job runner",
      status: "ok",
      detail: "CRON_SECRET is set.",
    });
  }

  return checks;
}

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const [database, smtp, aiProvider, overpass, growthEngine] =
    await Promise.all([
      checkDatabase(),
      checkSmtp(),
      checkAiProvider(),
      checkOverpass(),
      checkGrowthEngine(),
    ]);

  return [database, smtp, aiProvider, overpass, ...growthEngine];
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

async function checkAiProvider(): Promise<HealthCheck> {
  const config = getAiProviderConfig();
  if (!config) {
    return {
      name: "AI provider",
      status: "not-configured",
      detail: "No API key configured.",
      remedy:
        "Set AI_API_KEY (and AI_BASE_URL/AI_MODEL for a non-OpenRouter provider) to enable the AI consultant, the chatbot, and AI drafting.",
    };
  }

  const providerName = config.isOpenRouter
    ? "OpenRouter"
    : `AI provider (${new URL(config.baseUrl).hostname})`;
  const started = Date.now();

  try {
    if (config.isOpenRouter) {
      // The key endpoint reports quota and validity without spending a token.
      const response = await fetch("https://openrouter.ai/api/v1/key", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          name: providerName,
          status: "fail",
          detail: `Provider returned ${response.status}.`,
          latencyMs: Date.now() - started,
          remedy:
            response.status === 401
              ? "The API key was rejected. Rotate it and update the key."
              : "Check OpenRouter's status page.",
        };
      }

      const payload = (await response.json()) as {
        data?: { limit_remaining?: number | null; usage?: number };
      };
      const remaining = payload.data?.limit_remaining;

      return {
        name: providerName,
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
    }

    // Generic OpenAI-compatible provider: the models listing validates both
    // reachability and the key without spending a token.
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        name: providerName,
        status: "fail",
        detail: `Provider returned ${response.status}.`,
        latencyMs: Date.now() - started,
        remedy:
          response.status === 401 || response.status === 403
            ? "The API key was rejected. Rotate it and update AI_API_KEY."
            : "Check the provider's status page and AI_BASE_URL.",
      };
    }

    return {
      name: providerName,
      status: "ok",
      detail: `Key valid. Model: ${config.model}.`,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      name: providerName,
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
