import "server-only";

import { getAiProviderConfig } from "@/lib/server/ai-provider";
import { pingDatabase } from "@/lib/server/db/collections";
import { latestPublishedAt } from "@/lib/server/blog/repository";
import { verifyTransport } from "@/lib/server/email/transport";
import { getOverpassEndpoint } from "@/lib/server/env";
import { getSettingsFresh } from "@/lib/server/settings";
import { GROWTH_TOGGLE_KEYS, getGrowthToggle } from "@/lib/growth/toggles";
import { autonomySnapshot } from "@/lib/server/bootstrap";
import {
  HEARTBEAT_DEAD_MS,
  HEARTBEAT_WARN_MS,
} from "@/lib/server/jobs/heartbeat";
import { smtpConfigured } from "@/lib/server/capabilities";

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

/**
 * First-boot and self-healing checks.
 *
 * These answer questions the provider probes cannot: has this database ever
 * been reconciled, is the code-defined schedule still matched by handlers, does
 * the pipeline have a standing search, and what is holding commercial email.
 * Every finding names the exact remediation, because "degraded" without a next
 * step is just noise.
 */
async function checkAutonomy(): Promise<HealthCheck[]> {
  const snapshot = await autonomySnapshot();
  if (!snapshot) {
    return [
      {
        name: "Bootstrap",
        status: "fail",
        detail: "Autonomy state could not be read from the database.",
        remedy:
          "Check the MongoDB connection. Once it is reachable, POST /api/health/bootstrap with CRON_SECRET or restart the server.",
      },
    ];
  }

  const checks: HealthCheck[] = [];

  if (!snapshot.settingsPresent || snapshot.bootstrap.version === null) {
    checks.push({
      name: "Bootstrap",
      status: "fail",
      detail: "The settings document has never been created by the bootstrap.",
      remedy:
        "POST /api/health/bootstrap with CRON_SECRET (dryRun:false), or restart the server so instrumentation runs.",
    });
  } else if (snapshot.bootstrap.stale) {
    checks.push({
      name: "Bootstrap",
      status: "warn",
      detail: `Last reconciled ${snapshot.bootstrap.lastReconciledAt ?? "never"} (version ${snapshot.bootstrap.version}).`,
      remedy:
        "The heartbeat reconciles at most daily. Check that /api/cron/run is being called with CRON_SECRET.",
    });
  } else {
    checks.push({
      name: "Bootstrap",
      status: "ok",
      detail: `Version ${snapshot.bootstrap.version}, reconciled ${snapshot.bootstrap.lastReconciledAt}.`,
    });
  }

  checks.push(
    snapshot.schedules.ok
      ? {
          name: "Automation schedule",
          status: "ok",
          detail: `${snapshot.schedules.total} recurring automation(s), all with registered handlers.`,
        }
      : {
          name: "Automation schedule",
          status: "fail",
          detail: `Missing handlers: ${snapshot.schedules.missingHandlers.join(", ") || "none"}; duplicate ids: ${snapshot.schedules.duplicateIds.join(", ") || "none"}.`,
          remedy:
            "Register a handler in src/lib/server/jobs/handlers.ts or remove the schedule entry. Unhandled jobs are dead-lettered on first run.",
        },
  );

  /*
    Scheduler liveness. Configuration alone proves nothing: a deployment with a
    valid CRON_SECRET and a scheduler that stopped calling looks identical to a
    quiet healthy one until a report fails to arrive. GitHub also disables
    scheduled workflows after 60 days of repository inactivity, which is exactly
    the failure this check exists to surface.
  */
  const heartbeat = snapshot.heartbeat;
  if (!heartbeat) {
    checks.push({
      name: "Scheduler heartbeat",
      status: "warn",
      detail:
        "No authenticated cron tick has been recorded. Automation has never run on this database.",
      remedy:
        "Check that CRON_SECRET is set in the deployment and in the scheduler's secret store, then run the Heartbeat workflow once from the Actions tab. A new deployment records its first tick within five minutes.",
    });
  } else {
    const ageMs = heartbeat.ageMs ?? 0;
    const age = formatAge(ageMs);
    if (ageMs >= HEARTBEAT_DEAD_MS) {
      checks.push({
        name: "Scheduler heartbeat",
        status: "fail",
        detail: `The scheduler has been silent for ${age}. No automation is advancing.`,
        remedy:
          "Fix the scheduler now: run the Heartbeat workflow manually, check CRON_SECRET, and re-enable scheduled workflows if GitHub disabled them for inactivity.",
      });
    } else if (ageMs >= HEARTBEAT_WARN_MS) {
      checks.push({
        name: "Scheduler heartbeat",
        status: "warn",
        detail: `Last tick ${age} ago (expected every five minutes).`,
        remedy:
          "GitHub Actions can delay a run, but not by this much. Check the Heartbeat workflow's recent runs before assuming the next tick will arrive.",
      });
    } else if (heartbeat.lastTickOk === false) {
      checks.push({
        name: "Scheduler heartbeat",
        status: "warn",
        detail: `The last tick ${age} ago reported a failed drain.`,
        remedy:
          "Open /admin/jobs to see the error. The queue retries automatically with backoff; a repeated failure across ticks needs a fix.",
      });
    } else {
      checks.push({
        name: "Scheduler heartbeat",
        status: "ok",
        detail: `Last tick ${age} ago; ${heartbeat.ticks} tick(s) recorded.`,
      });
    }
  }

  if (snapshot.presets.total === 0) {
    checks.push({
      name: "Discovery presets",
      status: "fail",
      detail: "No standing searches exist, so nothing will be discovered.",
      remedy:
        "Restart the server or POST /api/health/bootstrap to restore the defaults, or save a search from /admin/customers/discover.",
    });
  } else if (snapshot.presets.enabled === 0) {
    checks.push({
      name: "Discovery presets",
      status: "warn",
      detail: `${snapshot.presets.total} standing search(es) exist but all are paused.`,
      remedy: "Resume at least one under /admin/customers/discover.",
    });
  } else {
    checks.push({
      name: "Discovery presets",
      status: "ok",
      detail: `${snapshot.presets.enabled}/${snapshot.presets.total} enabled; ${snapshot.presets.due} due now.`,
    });
  }

  const gate = snapshot.outboundGate;
  if (gate.state === "open") {
    checks.push({
      name: "Outbound gate",
      status: "warn",
      detail:
        "Open: commercial email can send without human approval where a toggle is on and the recipient passes compliance.",
      remedy:
        "Turn on automation.requireApproval under Settings → Automation if you want every message reviewed.",
    });
  } else if (gate.state === "manual") {
    checks.push({
      name: "Outbound gate",
      status: "ok",
      detail:
        "Manual: infrastructure and footer requirements are satisfied; every commercial message waits for approval.",
    });
  } else {
    checks.push({
      name: "Outbound gate",
      status: smtpConfigured() ? "warn" : "not-configured",
      detail: `Closed: ${gate.reasons.join(" ")}`,
      remedy: gate.remedies.join(" "),
    });
  }

  if (snapshot.queue.failed > 0) {
    checks.push({
      name: "Job queue",
      status: "warn",
      detail: `${snapshot.queue.failed} failed job(s) are dead-lettered.`,
      remedy:
        "Inspect /admin/jobs and retry or discard them; a failed job does not stop later runs.",
    });
  }

  if (snapshot.lastAutopilotRun?.status === "failed") {
    checks.push({
      name: "Autopilot last run",
      status: "warn",
      detail: `The most recent autopilot tick failed${snapshot.lastAutopilotRun.finishedAt ? ` at ${snapshot.lastAutopilotRun.finishedAt}` : ""}.`,
      remedy:
        "Open /admin/jobs, read the error, and retry once the cause is fixed. Other automations continue independently.",
    });
  }

  return checks;
}

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const [
    database,
    smtp,
    aiProvider,
    overpass,
    growthEngine,
    autonomy,
    content,
  ] = await Promise.all([
    checkDatabase(),
    checkSmtp(),
    checkAiProvider(),
    checkOverpass(),
    checkGrowthEngine(),
    checkAutonomy(),
    checkContentFreshness(),
  ]);

  return [
    database,
    smtp,
    aiProvider,
    overpass,
    ...growthEngine,
    ...autonomy,
    content,
  ];
}

/**
 * Organic acquisition depends on new material. The generator deliberately
 * skips instead of failing when no AI provider is configured, so without this
 * check a blog silently stops for months while everything else looks healthy.
 */
async function checkContentFreshness(): Promise<HealthCheck> {
  try {
    const latest = await latestPublishedAt();
    if (!latest) {
      return {
        name: "Content freshness",
        status: "warn",
        detail: "No automatically generated article has been published yet.",
        remedy:
          "Configure an AI provider under /admin/desktop, then run the blog.generate job from /admin/jobs. The weekly schedule drafts on Tuesdays and Fridays.",
      };
    }
    const ageDays = Math.floor((Date.now() - latest.getTime()) / 86_400_000);
    return ageDays > 30
      ? {
          name: "Content freshness",
          status: "warn",
          detail: `The newest generated article is ${ageDays} days old.`,
          remedy:
            "Check that the blog.generate job is enabled and that AI drafting is configured; organic visibility decays when publishing stops.",
        }
      : {
          name: "Content freshness",
          status: "ok",
          detail: `Newest generated article is ${ageDays} day${ageDays === 1 ? "" : "s"} old.`,
        };
  } catch (error) {
    return {
      name: "Content freshness",
      status: "warn",
      detail: "Could not read published articles.",
      remedy:
        error instanceof Error ? error.message : "Check the blog collection.",
    };
  }
}

/** Human-readable age for the scheduler check, e.g. "4 minutes", "2 hours". */
function formatAge(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
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
