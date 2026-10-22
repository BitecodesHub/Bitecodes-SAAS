import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { PROSPECT_CATEGORY_IDS } from "@/lib/prospecting/categories";

/**
 * First boot against a real, empty MongoDB.
 *
 * The properties under test are the ones a deploy depends on: the first run
 * creates the records, the second changes nothing, a dry run writes nothing,
 * and a human edit survives every later reconciliation.
 */
describeWithDatabase("runBootstrap", () => {
  useTestDatabase();

  async function collections() {
    const {
      siteSettings,
      autopilotPresets,
      emailTemplates,
      emailSequences,
      chatbotModels,
    } = await import("@/lib/server/db/collections");
    return {
      siteSettings,
      autopilotPresets,
      emailTemplates,
      emailSequences,
      chatbotModels,
    };
  }

  beforeEach(async () => {
    const {
      siteSettings,
      autopilotPresets,
      emailTemplates,
      emailSequences,
      chatbotModels,
    } = await collections();
    await Promise.all([
      (await siteSettings()).deleteMany({}),
      (await autopilotPresets()).deleteMany({}),
      (await emailTemplates()).deleteMany({}),
      (await emailSequences()).deleteMany({}),
      (await chatbotModels()).deleteMany({}),
    ]);
    const { resetSeededModelsFlag } =
      await import("@/lib/server/chatbot/models");
    resetSeededModelsFlag();

    // A developer's shell may carry real outreach settings. The closed-gate
    // assertion must not depend on that.
    delete process.env.OUTREACH_FROM;
    delete process.env.OUTREACH_POSTAL_ADDRESS;
  });

  it("dry run reports what a first boot would create and writes nothing", async () => {
    const { runBootstrap } = await import("@/lib/server/bootstrap");
    const report = await runBootstrap({ dryRun: true });

    expect(report.ok).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.settings.wouldCreate).toBe(true);
    expect(report.settings.created).toBe(false);
    expect(report.presets.wouldCreate).toBe(4);
    expect(report.presets.created).toBe(0);
    expect(report.seeds.templatesMissingBefore).toBeGreaterThan(0);
    expect(report.seeds.sequencesMissingBefore).toBeGreaterThan(0);
    expect(report.schedules.ok).toBe(true);

    const { siteSettings, autopilotPresets, emailTemplates } =
      await collections();
    expect(await (await siteSettings()).countDocuments({})).toBe(0);
    expect(await (await autopilotPresets()).countDocuments({})).toBe(0);
    expect(await (await emailTemplates()).countDocuments({})).toBe(0);
  });

  it("creates safe defaults, presets, and seeds on an empty database", async () => {
    const { runBootstrap, DEFAULT_DISCOVERY_PRESETS } =
      await import("@/lib/server/bootstrap");
    const report = await runBootstrap({ source: "test-first-boot" });

    expect(report.ok).toBe(true);
    expect(report.reconciled).toBe(true);
    expect(report.settings.created).toBe(true);
    expect(report.presets.created).toBe(DEFAULT_DISCOVERY_PRESETS.length);
    expect(report.seeds.templatesInserted).toBeGreaterThan(0);
    expect(report.seeds.sequencesInserted).toBeGreaterThan(0);
    expect(report.seeds.modelsReconciled).toBe(true);
    expect(report.schedules.missingHandlers).toEqual([]);

    const { siteSettings, autopilotPresets, emailSequences, chatbotModels } =
      await collections();
    const settings = await (await siteSettings()).findOne({ _id: "site" });
    expect(settings?.bootstrap?.version).toBe(1);
    expect(settings?.bootstrap?.source).toBe("test-first-boot");
    expect(settings?.automation?.requireApproval).toBe(true);
    expect(settings?.automation?.autopilot).toBe(false);
    // Writing the resolver's defaults makes the admin page show what is
    // actually in force, rather than a partly-empty document.
    expect(typeof settings?.growth).toBe("object");

    const presets = await (await autopilotPresets()).find({}).toArray();
    expect(presets).toHaveLength(DEFAULT_DISCOVERY_PRESETS.length);
    for (const preset of presets) {
      expect(preset.enabled).toBe(true);
      expect(preset.lastRunAt).toBeNull();
      for (const category of preset.categories) {
        expect(PROSPECT_CATEGORY_IDS).toContain(category);
      }
    }

    expect(await (await emailSequences()).countDocuments({})).toBeGreaterThan(
      0,
    );
    expect(await (await chatbotModels()).countDocuments({})).toBeGreaterThan(0);

    // The default state discovers but does not contact anyone: the settings
    // say approval is required and auto-enrolment is off.
    expect(report.gates.state).toBe("closed");
    expect(report.gates.canSend).toBe(false);
  });

  it("is idempotent and never overwrites a human edit", async () => {
    const { runBootstrap } = await import("@/lib/server/bootstrap");
    await runBootstrap({ source: "test-first" });

    const { siteSettings, autopilotPresets, emailTemplates } =
      await collections();
    await (
      await siteSettings()
    ).updateOne(
      { _id: "site" },
      { $set: { "contact.address.postal": "12 Test Lane, Ahmedabad" } },
    );
    await (
      await autopilotPresets()
    ).updateOne(
      { presetId: "bootstrap:in-ahmedabad-core" },
      { $set: { enabled: false } },
    );
    const templatesBefore = await (await emailTemplates()).countDocuments({});
    const presetsBefore = await (await autopilotPresets()).countDocuments({});

    const second = await runBootstrap({ force: true, source: "test-second" });

    expect(second.ok).toBe(true);
    expect(second.settings.created).toBe(false);
    expect(second.presets.created).toBe(0);
    expect(second.presets.total).toBe(presetsBefore);
    expect(await (await emailTemplates()).countDocuments({})).toBe(
      templatesBefore,
    );

    const stored = await (await siteSettings()).findOne({ _id: "site" });
    expect(stored?.contact?.address?.postal).toBe("12 Test Lane, Ahmedabad");

    const paused = await (
      await autopilotPresets()
    ).findOne({ presetId: "bootstrap:in-ahmedabad-core" });
    expect(paused?.enabled).toBe(false);
  });

  it("restores the defaults on a heartbeat only when the preset list is empty", async () => {
    const { runBootstrap, DEFAULT_DISCOVERY_PRESETS } =
      await import("@/lib/server/bootstrap");
    await runBootstrap({ source: "test-first" });

    const { autopilotPresets } = await collections();
    await (await autopilotPresets()).deleteMany({});

    const heartbeat = await runBootstrap({ source: "heartbeat" });

    // The full reconciliation is still within its daily window...
    expect(heartbeat.reconciled).toBe(false);
    // ...but an empty list is repaired immediately, so discovery survives a
    // database reset without waiting 24 hours.
    expect(heartbeat.presets.created).toBe(DEFAULT_DISCOVERY_PRESETS.length);
    expect(await (await autopilotPresets()).countDocuments({})).toBe(
      DEFAULT_DISCOVERY_PRESETS.length,
    );
  });
});
