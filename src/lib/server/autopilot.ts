import "server-only";

import { randomUUID } from "node:crypto";
import {
  autopilotPresets,
  prospects,
  sequenceEnrollments,
} from "@/lib/server/db/collections";
import type { AutopilotPresetDoc } from "@/lib/server/db/types";
import { getSettingsFresh } from "@/lib/server/settings";
import { enqueueJob, JOB_TYPES } from "@/lib/server/jobs/queue";
import { createProspectSearch } from "@/lib/server/prospecting/repository";
import { enrollProspect } from "@/lib/server/email/sequences";
import { RESULT_LIMITS } from "@/lib/prospecting/overpass-query";

/**
 * The autopilot: the piece that turns the discover → audit → outreach chain
 * into a standing employee rather than a set of buttons.
 *
 * One tick, two duties, with different gates:
 *
 * 1. **Feed the pipeline — always on.** Re-run saved discovery presets whose
 *    cadence has elapsed. Discovery reads a public map service and writes
 *    internal prospect rows; it contacts nobody, so the autonomous-first-boot
 *    contract expects it to run without a setup wizard. At most one preset per
 *    tick, deliberately: Overpass is a donated public service, and a tick that
 *    fired five area queries at once would be indistinguishable from abuse.
 * 2. **Work the pipeline — gated.** Enrol qualified, scored, contactable
 *    prospects into the default outreach sequence, newest-best first, under a
 *    daily ceiling. This half is what `automation.autopilot` switches on, and
 *    it is off by default. Every message still passes the send-time compliance
 *    gate — the autopilot decides *who to write to*, never *whether a send is
 *    lawful*.
 *
 * Everything here is idempotent per tick: presets advance `lastRunAt` while
 * claimed, but the claim is reverted if the discovery run cannot be created, so
 * a transient failure costs one tick rather than a whole cadence.
 * `enrollProspect` refuses duplicates, so an overlapping tick cannot
 * double-contact anyone.
 */

export interface AutopilotPresetSummary {
  presetId: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  categories: string[];
  cadenceHours: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastSearchId: string | null;
}

function toSummary(doc: AutopilotPresetDoc): AutopilotPresetSummary {
  return {
    presetId: doc.presetId,
    label: doc.label,
    lat: doc.lat,
    lng: doc.lng,
    radiusMeters: doc.radiusMeters,
    categories: doc.categories,
    cadenceHours: doc.cadenceHours,
    enabled: doc.enabled,
    lastRunAt: doc.lastRunAt?.toISOString() ?? null,
    lastSearchId: doc.lastSearchId,
  };
}

export async function listAutopilotPresets(): Promise<
  AutopilotPresetSummary[]
> {
  const collection = await autopilotPresets();
  const all = await collection.find({}).sort({ createdAt: 1 }).toArray();
  return all.map(toSummary);
}

export async function createAutopilotPreset(input: {
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  categories: string[];
  cadenceHours: number;
  createdById: string | null;
}): Promise<AutopilotPresetSummary> {
  const now = new Date();
  const doc: Omit<AutopilotPresetDoc, "_id"> = {
    presetId: randomUUID(),
    label: input.label,
    lat: input.lat,
    lng: input.lng,
    radiusMeters: input.radiusMeters,
    categories: input.categories,
    cadenceHours: input.cadenceHours,
    enabled: true,
    lastRunAt: null,
    lastSearchId: null,
    createdById: input.createdById,
    createdAt: now,
    updatedAt: now,
  };
  const collection = await autopilotPresets();
  await collection.insertOne(doc as AutopilotPresetDoc);
  return toSummary(doc as AutopilotPresetDoc);
}

export async function setAutopilotPresetEnabled(
  presetId: string,
  enabled: boolean,
): Promise<boolean> {
  const collection = await autopilotPresets();
  const result = await collection.updateOne(
    { presetId },
    { $set: { enabled, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

export async function deleteAutopilotPreset(
  presetId: string,
): Promise<boolean> {
  const collection = await autopilotPresets();
  const result = await collection.deleteOne({ presetId });
  return result.deletedCount === 1;
}

/**
 * Claims the single most-overdue preset and starts its discovery run.
 *
 * `lastRunAt` is advanced atomically so a concurrent tick cannot claim the same
 * preset. The advance is rolled back when starting the run fails: otherwise a
 * momentary database or enqueue error would suppress that search for the whole
 * cadence (a week, by default), which is why this is one operation rather than
 * "claim here, start there".
 */
async function claimAndStartDuePreset(
  now: Date,
): Promise<{ preset: AutopilotPresetDoc; searchId: string } | null> {
  const collection = await autopilotPresets();
  const candidates = await collection
    .find({ enabled: true })
    .sort({ lastRunAt: 1 })
    .limit(20)
    .toArray();

  for (const preset of candidates) {
    const due =
      !preset.lastRunAt ||
      preset.lastRunAt.getTime() + preset.cadenceHours * 3_600_000 <=
        now.getTime();
    if (!due) continue;

    const claimed = await collection.findOneAndUpdate(
      { presetId: preset.presetId, lastRunAt: preset.lastRunAt },
      { $set: { lastRunAt: now, updatedAt: now } },
    );
    if (!claimed) continue;

    try {
      const searchId = await startPresetDiscovery(preset, now);
      return { preset, searchId };
    } catch (error) {
      console.error(
        `[autopilot] Could not start discovery for "${preset.label}"; the preset will be retried:`,
        error instanceof Error ? error.message : error,
      );
      try {
        await collection.updateOne(
          { presetId: preset.presetId, lastRunAt: now },
          { $set: { lastRunAt: preset.lastRunAt, updatedAt: new Date() } },
        );
      } catch (revertError) {
        console.error(
          `[autopilot] Could not revert the claim on "${preset.label}":`,
          revertError instanceof Error ? revertError.message : revertError,
        );
      }
      return null;
    }
  }
  return null;
}

/** Starts a discovery run for a preset. Shared by the tick and "run now". */
export async function startPresetDiscovery(
  preset: Pick<
    AutopilotPresetDoc,
    "presetId" | "label" | "lat" | "lng" | "radiusMeters" | "categories"
  >,
  now = new Date(),
): Promise<string> {
  const searchId = randomUUID();

  await createProspectSearch({
    searchId,
    label: `Autopilot · ${preset.label}`,
    lat: preset.lat,
    lng: preset.lng,
    radiusMeters: preset.radiusMeters,
    categories: preset.categories,
    provider: "osm",
    status: "queued",
    discovered: 0,
    added: 0,
    skipped: 0,
    error: null,
    createdById: null,
  });

  await enqueueJob({
    type: JOB_TYPES.prospectDiscover,
    payload: {
      searchId,
      lat: preset.lat,
      lng: preset.lng,
      radiusMeters: preset.radiusMeters,
      categories: preset.categories,
      limit: RESULT_LIMITS.default,
    },
    idempotencyKey: `discover:${searchId}`,
  });

  const collection = await autopilotPresets();
  await collection.updateOne(
    { presetId: preset.presetId },
    { $set: { lastSearchId: searchId, updatedAt: now } },
  );

  return searchId;
}

/**
 * Cold-outreach enrolments since midnight UTC, whoever made them.
 *
 * Lead sequences are excluded: they are opted-in nurture mail subject to their
 * own consent rules, and counting them would silently spend the cold-outreach
 * budget. Manual prospect enrolments are included on purpose — the ceiling is
 * about the sending domain's daily volume, not about who clicked the button.
 */
async function countOutreachEnrollmentsToday(now: Date): Promise<number> {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const enrollments = await sequenceEnrollments();
  return enrollments.countDocuments({
    createdAt: { $gte: dayStart },
    prospectId: { $ne: null },
  });
}

export interface AutopilotTickSummary {
  /** True when auto-enrolment is on. Discovery runs regardless. */
  enabled: boolean;
  presetRun: string | null;
  candidates: number;
  enrolled: number;
  skipped: { reason: string; count: number }[];
}

/**
 * One autopilot pass. Called from the cron-driven job runner.
 */
export async function runAutopilotTick(
  now = new Date(),
): Promise<AutopilotTickSummary> {
  const settings = await getSettingsFresh();

  // Duty one: feed the pipeline. This is intentionally independent of the
  // auto-enrolment switch: prospecting is read-only external work plus
  // internal records, and an operator who has not opted into automatic
  // contact should still get a populated pipeline to review.
  let presetRun: string | null = null;
  const started = await claimAndStartDuePreset(now);
  if (started) {
    presetRun = started.preset.label;
  }

  if (!settings.automation.autopilot) {
    return {
      enabled: false,
      presetRun,
      candidates: 0,
      enrolled: 0,
      skipped: [],
    };
  }

  // Duty two: work the pipeline.
  const cap = settings.automation.autopilotDailyEnrollCap;
  const alreadyToday = await countOutreachEnrollmentsToday(now);
  const budget = Math.max(0, cap - alreadyToday);

  const collection = await prospects();
  const candidates = budget
    ? await collection
        .find({
          status: "qualified",
          email: { $nin: [null, ""] },
          "classification.score": {
            $gte: settings.automation.autopilotScoreThreshold,
          },
        })
        .sort({ "classification.score": -1, updatedAt: -1 })
        .limit(budget)
        .toArray()
    : [];

  let enrolled = 0;
  const skipCounts = new Map<string, number>();

  for (const prospect of candidates) {
    const id = prospect._id?.toHexString();
    if (!id) continue;

    const result = await enrollProspect(id, "outreach.default", now);
    if (result.ok) {
      // The send advances the prospect to `contacted`; setting `queued` here
      // would drag the pipeline backwards after the first email went out.
      enrolled += 1;
    } else {
      skipCounts.set(result.reason, (skipCounts.get(result.reason) ?? 0) + 1);
    }
  }

  return {
    enabled: true,
    presetRun,
    candidates: candidates.length,
    enrolled,
    skipped: [...skipCounts.entries()].map(([reason, count]) => ({
      reason,
      count,
    })),
  };
}
