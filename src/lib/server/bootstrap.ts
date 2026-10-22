import "server-only";

import {
  autopilotPresets,
  jobs,
  pingDatabase,
  siteSettings,
} from "@/lib/server/db/collections";
import type {
  AutopilotPresetDoc,
  SiteSettingsDoc,
} from "@/lib/server/db/types";
import {
  SETTINGS_DEFAULTS,
  SETTINGS_ID,
  resolveSettings,
  type ResolvedSettings,
} from "@/lib/server/settings";
import {
  capabilityMatrix,
  outboundSendGate,
  type Capability,
  type OutboundSendGate,
} from "@/lib/server/capabilities";
import {
  JOB_TYPES,
  getQueueStats,
  type JobType,
} from "@/lib/server/jobs/queue";
import { getJobHandlers } from "@/lib/server/jobs/handlers";
import { RECURRING_AUTOMATIONS } from "@/lib/server/jobs/schedule";
import {
  readHeartbeat,
  type HeartbeatSnapshot,
} from "@/lib/server/jobs/heartbeat";
import { ensureSeededTemplates } from "@/lib/server/email/templates";
import { ensureSeededSequences } from "@/lib/server/email/sequences";
import {
  DEFAULT_MODELS,
  ensureSeededModels,
} from "@/lib/server/chatbot/models";
import { OUTREACH_TEMPLATE_SEEDS } from "@/lib/email/templates/outreach";
import {
  ALL_FOLLOWUP_TEMPLATE_SEEDS,
  SEQUENCE_SEEDS,
} from "@/lib/email/templates/followups";

/**
 * Autonomous first boot.
 *
 * A deployment with an empty database must be able to start, serve pages, and
 * begin the acquisition loop without anyone clicking a setup button. This
 * module is what runs at server start (`instrumentation.ts`) and on every
 * authenticated cron heartbeat (`/api/cron/run`), and it is deliberately
 * idempotent: repeated runs converge on the same records and never overwrite a
 * human's edit.
 *
 * What it guarantees on an empty database:
 *   - the settings document exists, with conservative automation defaults and
 *     every growth switch written explicitly (so the admin page reflects what
 *     the resolver already assumes);
 *   - the four default discovery presets exist, so the pipeline has something
 *     to search without a wizard;
 *   - outreach templates, the default sequence, and chatbot models are seeded;
 *   - declared indexes exist because the first database call ensures them.
 *
 * What it does not do: send email, enable auto-enrolment, or bypass any gate.
 * The default state is discovery on, drafting on, human approval on, and
 * auto-contact off. No optional provider is required to boot; missing ones are
 * reported as capability states rather than throwing.
 *
 * Full reconciliation (settings, seeds) runs on first boot and at most once a
 * day. Every heartbeat still repairs the one cheap invariant — an entirely
 * empty preset list — so a database that comes up blank after a reset starts
 * discovering again within one cron tick. A partial set of *default* presets is
 * also completed, because that is what a crash halfway through seeding leaves
 * behind; a preset list that contains any custom search is left alone, which is
 * how an operator opts out of automatic restoration. Pause a preset rather than
 * deleting it if you want it to stay gone.
 */

export const AUTONOMOUS_BOOTSTRAP_VERSION = 1;

/** Settings and seed reconciliation interval. */
export const BOOTSTRAP_RECONCILE_MS = 24 * 60 * 60 * 1000;

export interface DefaultDiscoveryPreset {
  presetId: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  categories: string[];
  cadenceHours: number;
}

/**
 * The standing searches installed on a fresh database.
 *
 * Chosen to match the countries in the ideal customer profile (India and
 * Australia) and the categories with the clearest commercial pain — clinics,
 * schools, professional services, trades and hospitality. Weekly, not daily:
 * Overpass is donated infrastructure, and four area queries a week is enough
 * to keep a pipeline fed without behaving like a scraper. Every one is
 * editable, pausable, and replaceable from the admin console.
 */
export const DEFAULT_DISCOVERY_PRESETS: readonly DefaultDiscoveryPreset[] = [
  {
    presetId: "bootstrap:in-ahmedabad-core",
    label: "Ahmedabad — clinics, schools & professional services",
    lat: 23.0225,
    lng: 72.5714,
    radiusMeters: 20_000,
    categories: ["health", "education", "professional-services"],
    cadenceHours: 168,
  },
  {
    presetId: "bootstrap:in-bengaluru-core",
    label: "Bengaluru — clinics, schools & professional services",
    lat: 12.9716,
    lng: 77.5946,
    radiusMeters: 20_000,
    categories: ["health", "education", "professional-services"],
    cadenceHours: 168,
  },
  {
    presetId: "bootstrap:au-sydney-core",
    label: "Sydney — clinics, professional services & trades",
    lat: -33.8688,
    lng: 151.2093,
    radiusMeters: 20_000,
    categories: ["health", "professional-services", "trades"],
    cadenceHours: 168,
  },
  {
    presetId: "bootstrap:au-melbourne-core",
    label: "Melbourne — clinics, professional services & hospitality",
    lat: -37.8136,
    lng: 144.9631,
    radiusMeters: 20_000,
    categories: ["health", "professional-services", "hospitality"],
    cadenceHours: 168,
  },
];

export interface ScheduleHealth {
  ok: boolean;
  total: number;
  withHandlers: number;
  missingHandlers: string[];
  duplicateIds: string[];
  /** Job types declared in `JOB_TYPES` but never scheduled. Not an error. */
  unscheduledTypes: string[];
}

/**
 * Verifies that the code-defined schedule and the handler registry agree.
 *
 * Schedules are code, not database rows, so there is nothing to "create" on
 * boot — the real failure is a recurring automation whose type has no handler,
 * which the worker would dead-letter on its first run. Checking this every
 * heartbeat makes that a reported misconfiguration rather than a silent one.
 */
export function scheduleHealth(): ScheduleHealth {
  const handlers = getJobHandlers();
  const missingHandlers: string[] = [];
  const duplicateIds: string[] = [];
  const seen = new Set<string>();
  const scheduledTypes = new Set<string>();

  for (const automation of RECURRING_AUTOMATIONS) {
    if (seen.has(automation.id)) duplicateIds.push(automation.id);
    seen.add(automation.id);
    scheduledTypes.add(automation.type);
    if (!handlers[automation.type]) missingHandlers.push(automation.type);
  }

  const withHandlers = RECURRING_AUTOMATIONS.filter(
    (automation) => handlers[automation.type],
  ).length;
  const allTypes = Object.values(JOB_TYPES) as JobType[];
  const unscheduledTypes = allTypes.filter((type) => !scheduledTypes.has(type));

  return {
    ok: missingHandlers.length === 0 && duplicateIds.length === 0,
    total: RECURRING_AUTOMATIONS.length,
    withHandlers,
    missingHandlers,
    duplicateIds,
    unscheduledTypes,
  };
}

export interface BootstrapAction {
  area: "database" | "settings" | "presets" | "seeds" | "schedule";
  action: string;
  detail: string;
}

export interface BootstrapReport {
  ok: boolean;
  version: number;
  source: string;
  dryRun: boolean;
  /** True when the full reconciliation ran. False when a recent run covered it. */
  reconciled: boolean;
  startedAt: string;
  finishedAt: string;
  database: { ok: boolean; latencyMs?: number; error?: string };
  settings: {
    presentBefore: boolean;
    created: boolean;
    wouldCreate: boolean;
    version: number | null;
    completedAt: string | null;
    lastReconciledAt: string | null;
  };
  presets: {
    created: number;
    present: number;
    total: number;
    defaults: number;
    wouldCreate: number;
  };
  seeds: {
    templatesInserted: number;
    templatesRefreshed: number;
    templatesMissingBefore: number;
    sequencesInserted: number;
    sequenceTemplatesInserted: number;
    sequencesMissingBefore: number;
    modelsReconciled: boolean;
    modelsMissingBefore: number;
  };
  schedules: ScheduleHealth;
  gates: OutboundSendGate;
  capabilities: Capability[];
  actions: BootstrapAction[];
  errors: string[];
}

export interface RunBootstrapOptions {
  /** Inspect and report without writing anything. */
  dryRun?: boolean;
  /** Reconcile even when a recent run covered it. */
  force?: boolean;
  /** Written to the settings marker; "server-start", "heartbeat", "api". */
  source?: string;
  now?: Date;
}

function settingsMarker(
  existing: SiteSettingsDoc | null,
  now: Date,
  source: string,
) {
  const sameVersion =
    existing?.bootstrap?.version === AUTONOMOUS_BOOTSTRAP_VERSION;
  return {
    version: AUTONOMOUS_BOOTSTRAP_VERSION,
    completedAt:
      sameVersion && existing?.bootstrap?.completedAt
        ? existing.bootstrap.completedAt
        : now,
    lastReconciledAt: now,
    source,
  };
}

function isStale(existing: SiteSettingsDoc | null, now: Date): boolean {
  if (
    !existing?.bootstrap ||
    existing.bootstrap.version !== AUTONOMOUS_BOOTSTRAP_VERSION
  ) {
    return true;
  }
  const last = existing.bootstrap.lastReconciledAt;
  return !last || now.getTime() - last.getTime() >= BOOTSTRAP_RECONCILE_MS;
}

async function countMissingTemplateSeeds(): Promise<number> {
  const { emailTemplates } = await import("@/lib/server/db/collections");
  const collection = await emailTemplates();
  const keys = [
    ...OUTREACH_TEMPLATE_SEEDS.map((seed) => seed.key),
    ...ALL_FOLLOWUP_TEMPLATE_SEEDS.map((seed) => seed.key),
  ];
  const present = await collection.countDocuments({ key: { $in: keys } });
  return Math.max(0, keys.length - present);
}

async function countMissingSequenceSeeds(): Promise<number> {
  const { emailSequences } = await import("@/lib/server/db/collections");
  const collection = await emailSequences();
  const keys = SEQUENCE_SEEDS.map((seed) => seed.key);
  const present = await collection.countDocuments({ key: { $in: keys } });
  return Math.max(0, keys.length - present);
}

async function countMissingModels(): Promise<number> {
  const { chatbotModels } = await import("@/lib/server/db/collections");
  const collection = await chatbotModels();
  const keys = DEFAULT_MODELS.map((model) => model.key);
  const present = await collection.countDocuments({ key: { $in: keys } });
  return Math.max(0, keys.length - present);
}

function emptySeedReport(): BootstrapReport["seeds"] {
  return {
    templatesInserted: 0,
    templatesRefreshed: 0,
    templatesMissingBefore: 0,
    sequencesInserted: 0,
    sequenceTemplatesInserted: 0,
    sequencesMissingBefore: 0,
    modelsReconciled: false,
    modelsMissingBefore: 0,
  };
}

let inFlight: Promise<BootstrapReport> | null = null;

/**
 * Runs the bootstrap, coalescing concurrent non-dry runs.
 *
 * Two server instances starting together, or a heartbeat landing during first
 * boot, should not race four independent preset upserts. Returning the
 * in-flight promise makes them share one result.
 */
export async function runBootstrap(
  options: RunBootstrapOptions = {},
): Promise<BootstrapReport> {
  if (options.dryRun) return executeBootstrap(options);
  if (inFlight) return inFlight;

  const promise = executeBootstrap(options).finally(() => {
    if (inFlight === promise) inFlight = null;
  });
  inFlight = promise;
  return promise;
}

async function executeBootstrap(
  options: RunBootstrapOptions,
): Promise<BootstrapReport> {
  const now = options.now ?? new Date();
  const startedAt = now.toISOString();
  const dryRun = options.dryRun === true;
  const source = options.source?.trim() || "manual";
  const actions: BootstrapAction[] = [];
  const errors: string[] = [];

  const report: BootstrapReport = {
    ok: false,
    version: AUTONOMOUS_BOOTSTRAP_VERSION,
    source,
    dryRun,
    reconciled: false,
    startedAt,
    finishedAt: startedAt,
    database: { ok: false },
    settings: {
      presentBefore: false,
      created: false,
      wouldCreate: false,
      version: null,
      completedAt: null,
      lastReconciledAt: null,
    },
    presets: {
      created: 0,
      present: 0,
      total: 0,
      defaults: DEFAULT_DISCOVERY_PRESETS.length,
      wouldCreate: 0,
    },
    seeds: emptySeedReport(),
    schedules: scheduleHealth(),
    gates: outboundSendGate(resolveSettings(null)),
    capabilities: capabilityMatrix({ settings: resolveSettings(null) }),
    actions,
    errors,
  };

  const database = await pingDatabase();
  report.database = database;
  if (!database.ok) {
    errors.push(database.error ?? "The database is unreachable.");
    actions.push({
      area: "database",
      action: "skipped",
      detail: "No writes were attempted because the database is unreachable.",
    });
    report.finishedAt = new Date().toISOString();
    return report;
  }

  actions.push({
    area: "database",
    action: "indexes",
    detail:
      "Declared indexes were ensured by the first database call (unique indexes awaited).",
  });

  let existing: SiteSettingsDoc | null = null;
  try {
    const collection = await siteSettings();
    existing = await collection.findOne({ _id: SETTINGS_ID });
  } catch (error) {
    errors.push(
      `Could not read settings: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  report.settings.presentBefore = Boolean(existing);
  report.settings.version = existing?.bootstrap?.version ?? null;
  report.settings.completedAt =
    existing?.bootstrap?.completedAt?.toISOString() ?? null;
  report.settings.lastReconciledAt =
    existing?.bootstrap?.lastReconciledAt?.toISOString() ?? null;
  report.settings.wouldCreate = !existing;

  const full = options.force === true || isStale(existing, now);
  // Written only after seeds and presets reconcile. A marker written first
  // would make a crash halfway through seeding look like a completed boot, and
  // nothing would repair the missing half until the next day's reconcile.
  const marker = full ? settingsMarker(existing, now, source) : null;
  let settingsWritten = false;

  if (full && marker) {
    report.reconciled = true;

    if (dryRun) {
      actions.push({
        area: "settings",
        action: existing ? "would-reconcile" : "would-create",
        detail: existing
          ? "The existing document and every human-edited value would be preserved; only the bootstrap marker would be refreshed."
          : "Safe automation defaults and every growth switch would be written.",
      });
    } else {
      try {
        const collection = await siteSettings();
        const update: {
          $set: Record<string, unknown>;
          $setOnInsert: Record<string, unknown>;
        } = {
          $set: { updatedAt: now },
          $setOnInsert: {
            createdAt: now,
            automation: SETTINGS_DEFAULTS.automation,
            ai: SETTINGS_DEFAULTS.ai,
            map: SETTINGS_DEFAULTS.map,
            growth: SETTINGS_DEFAULTS.growth,
          },
        };
        const result = await collection.updateOne(
          { _id: SETTINGS_ID },
          update,
          { upsert: true },
        );
        report.settings.created = result.upsertedCount === 1;
        settingsWritten = true;
        actions.push({
          area: "settings",
          action: report.settings.created ? "created" : "reconciled",
          detail: report.settings.created
            ? "Wrote safe automation defaults and every growth switch."
            : "Kept every stored setting; the bootstrap marker is refreshed after seeds and presets.",
        });
      } catch (error) {
        errors.push(
          `Could not write settings: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } else {
    actions.push({
      area: "settings",
      action: "skipped",
      detail:
        "Reconciled within the last 24 hours at the current bootstrap version.",
    });
  }

  // Seeds. Only in a full reconciliation, and only ever additive/idempotent.
  if (!full) {
    actions.push({
      area: "seeds",
      action: "skipped",
      detail: "Seed reconciliation is covered by the daily bootstrap.",
    });
  } else {
    try {
      const [templatesMissing, sequencesMissing, modelsMissing] =
        await Promise.all([
          countMissingTemplateSeeds(),
          countMissingSequenceSeeds(),
          countMissingModels(),
        ]);
      report.seeds.templatesMissingBefore = templatesMissing;
      report.seeds.sequencesMissingBefore = sequencesMissing;
      report.seeds.modelsMissingBefore = modelsMissing;

      if (dryRun) {
        actions.push({
          area: "seeds",
          action: "would-reconcile",
          detail: `${templatesMissing} template(s), ${sequencesMissing} sequence(s), and ${modelsMissing} model(s) are missing.`,
        });
      } else {
        try {
          const templates = await ensureSeededTemplates(now);
          report.seeds.templatesInserted = templates.inserted;
          report.seeds.templatesRefreshed = templates.refreshed;
        } catch (error) {
          errors.push(
            `Could not seed templates: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        try {
          const sequences = await ensureSeededSequences(now);
          report.seeds.sequencesInserted = sequences.sequences;
          report.seeds.sequenceTemplatesInserted = sequences.templates;
        } catch (error) {
          errors.push(
            `Could not seed sequences: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        try {
          await ensureSeededModels();
          report.seeds.modelsReconciled = true;
        } catch (error) {
          errors.push(
            `Could not seed models: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        actions.push({
          area: "seeds",
          action: "reconciled",
          detail: `${report.seeds.templatesInserted} template(s), ${report.seeds.sequenceTemplatesInserted} follow-up template(s), ${report.seeds.sequencesInserted} sequence(s) inserted; models reconciled.`,
        });
      }
    } catch (error) {
      errors.push(
        `Could not inspect seeds: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Default presets. A list made only of defaults is completed if some are
  // missing (the signature of a crash during first seeding); a list with any
  // custom preset is preserved exactly, so an operator who replaced the
  // defaults is never second-guessed.
  try {
    const collection = await autopilotPresets();
    const total = await collection.countDocuments({});
    const defaultIds = DEFAULT_DISCOVERY_PRESETS.map(
      (preset) => preset.presetId,
    );
    const present = await collection.countDocuments({
      presetId: { $in: defaultIds },
    });
    report.presets.total = total;
    report.presets.present = present;

    const onlyDefaults = total === present;
    const missingDefaults = DEFAULT_DISCOVERY_PRESETS.length - present;
    const shouldInstall = total === 0 || (onlyDefaults && missingDefaults > 0);

    if (shouldInstall) {
      if (dryRun) {
        report.presets.wouldCreate = missingDefaults;
        actions.push({
          area: "presets",
          action: "would-create",
          detail: `${missingDefaults} default standing search(es) would be installed.`,
        });
      } else {
        let created = 0;
        for (const preset of DEFAULT_DISCOVERY_PRESETS) {
          const doc: Omit<AutopilotPresetDoc, "_id"> = {
            ...preset,
            enabled: true,
            lastRunAt: null,
            lastSearchId: null,
            createdById: null,
            createdAt: now,
            updatedAt: now,
          };
          const result = await collection.updateOne(
            { presetId: preset.presetId },
            { $setOnInsert: doc },
            { upsert: true },
          );
          if (result.upsertedCount === 1) created += 1;
        }
        report.presets.created = created;
        report.presets.total = total + created;
        report.presets.present = present + created;
        actions.push({
          area: "presets",
          action: "created",
          detail: `${created} default standing search(es) installed.`,
        });
      }
    } else {
      actions.push({
        area: "presets",
        action: "preserved",
        detail: `${total} existing standing search(es) left untouched.`,
      });
    }
  } catch (error) {
    errors.push(
      `Could not reconcile presets: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // The marker is the contract that this boot finished. Writing it only now
  // means any failure above leaves the next run in full-reconcile mode.
  if (full && marker && !dryRun && settingsWritten && errors.length === 0) {
    try {
      const collection = await siteSettings();
      await collection.updateOne(
        { _id: SETTINGS_ID },
        { $set: { bootstrap: marker, updatedAt: now } },
      );
      report.settings.version = marker.version;
      report.settings.completedAt = marker.completedAt.toISOString();
      report.settings.lastReconciledAt = marker.lastReconciledAt.toISOString();
      actions.push({
        area: "settings",
        action: "marker",
        detail:
          "Bootstrap marker written after settings, seeds, and presets reconciled.",
      });
    } catch (error) {
      errors.push(
        `Could not write the bootstrap marker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const schedules = scheduleHealth();
  report.schedules = schedules;
  actions.push({
    area: "schedule",
    action: schedules.ok ? "healthy" : "mismatch",
    detail: schedules.ok
      ? `${schedules.total} recurring automation(s), all with registered handlers.`
      : `${schedules.missingHandlers.length} automation(s) have no handler: ${schedules.missingHandlers.join(", ") || "duplicate ids"}.`,
  });

  let resolved: ResolvedSettings = resolveSettings(existing);
  if (!dryRun && report.reconciled) {
    try {
      const collection = await siteSettings();
      const stored = (await collection.findOne({
        _id: SETTINGS_ID,
      })) as SiteSettingsDoc | null;
      resolved = resolveSettings(stored);
    } catch {
      // Fall back to what we read before writing; the capability states below
      // are best-effort when the database is flaky.
    }
  }
  report.gates = outboundSendGate(resolved);
  report.capabilities = capabilityMatrix({ settings: resolved });

  report.ok = errors.length === 0;
  report.finishedAt = new Date().toISOString();
  return report;
}

export interface AutonomySnapshot {
  settingsPresent: boolean;
  bootstrap: {
    version: number | null;
    completedAt: string | null;
    lastReconciledAt: string | null;
    source: string | null;
    stale: boolean;
  };
  presets: {
    total: number;
    enabled: number;
    due: number;
    defaultsInstalled: number;
    nextDueAt: string | null;
    lastRunAt: string | null;
  };
  schedules: ScheduleHealth;
  outboundGate: OutboundSendGate;
  queue: { queued: number; running: number; failed: number };
  /** Last authenticated scheduler tick, or null before the first one. */
  heartbeat: HeartbeatSnapshot | null;
  lastAutopilotRun: { status: string; finishedAt: string | null } | null;
}

/** A read-only view for `/api/health` and the admin health panel. */
export async function autonomySnapshot(
  now = new Date(),
): Promise<AutonomySnapshot | null> {
  try {
    const settingsCollection = await siteSettings();
    const stored = (await settingsCollection.findOne({
      _id: SETTINGS_ID,
    })) as SiteSettingsDoc | null;
    const settings = resolveSettings(stored);

    const presetCollection = await autopilotPresets();
    const defaults = new Set(
      DEFAULT_DISCOVERY_PRESETS.map((preset) => preset.presetId),
    );
    const presets = await presetCollection.find({}).toArray();
    const enabled = presets.filter((preset) => preset.enabled);
    const due = enabled.filter(
      (preset) =>
        !preset.lastRunAt ||
        preset.lastRunAt.getTime() + preset.cadenceHours * 3_600_000 <=
          now.getTime(),
    );
    const upcoming = enabled
      .map((preset) =>
        preset.lastRunAt
          ? preset.lastRunAt.getTime() + preset.cadenceHours * 3_600_000
          : now.getTime(),
      )
      .sort((a, b) => a - b);
    const lastRuns = presets
      .map((preset) => preset.lastRunAt?.getTime() ?? 0)
      .filter((time) => time > 0);

    const queueStats = await getQueueStats();
    const heartbeat = await readHeartbeat(now);

    let lastAutopilotRun: AutonomySnapshot["lastAutopilotRun"] = null;
    try {
      const job = await (await jobs())
        .find({ type: JOB_TYPES.autopilotTick })
        .sort({ createdAt: -1 })
        .limit(1)
        .project({ status: 1, finishedAt: 1 })
        .next();
      if (job) {
        lastAutopilotRun = {
          status: job.status,
          finishedAt: job.finishedAt?.toISOString() ?? null,
        };
      }
    } catch {
      // The queue view is supplementary; a missing job must not hide the rest.
    }

    return {
      settingsPresent: Boolean(stored),
      bootstrap: {
        version: stored?.bootstrap?.version ?? null,
        completedAt: stored?.bootstrap?.completedAt?.toISOString() ?? null,
        lastReconciledAt:
          stored?.bootstrap?.lastReconciledAt?.toISOString() ?? null,
        source: stored?.bootstrap?.source ?? null,
        stale: isStale(stored, now),
      },
      presets: {
        total: presets.length,
        enabled: enabled.length,
        due: due.length,
        defaultsInstalled: presets.filter((preset) =>
          defaults.has(preset.presetId),
        ).length,
        nextDueAt: upcoming.length
          ? new Date(upcoming[0]!).toISOString()
          : null,
        lastRunAt: lastRuns.length
          ? new Date(Math.max(...lastRuns)).toISOString()
          : null,
      },
      schedules: scheduleHealth(),
      outboundGate: outboundSendGate(settings),
      queue: {
        queued: queueStats.queued ?? 0,
        running: queueStats.running ?? 0,
        failed: queueStats.failed ?? 0,
      },
      heartbeat,
      lastAutopilotRun,
    };
  } catch (error) {
    console.error(
      "[bootstrap] Could not read the autonomy snapshot:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
