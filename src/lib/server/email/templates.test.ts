import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { OUTREACH_TEMPLATE_SEEDS } from "@/lib/email/templates/outreach";

/**
 * Integration tests for template seeding and the outreach planner.
 *
 * Two properties matter most and are why these run against a real database:
 *
 * 1. **An operator's edit is never overwritten by a later deploy.** The
 *    `isDefault` flag carries that guarantee, and getting it wrong destroys
 *    someone's work silently.
 * 2. **The planner refuses to email a prospect it cannot honestly describe.**
 *    Those refusals are the last guard against the false-claim failure the
 *    enrichment rules exist to prevent.
 */

describeWithDatabase("email templates", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { emailTemplates, prospects, emailMessages, suppressions } =
      await import("@/lib/server/db/collections");
    await (await emailTemplates()).deleteMany({});
    await (await prospects()).deleteMany({});
    await (await emailMessages()).deleteMany({});
    await (await suppressions()).deleteMany({});
  });

  it("seeds one template per classification tag", async () => {
    const { ensureSeededTemplates, listTemplates } =
      await import("@/lib/server/email/templates");

    const { inserted } = await ensureSeededTemplates();
    expect(inserted).toBe(OUTREACH_TEMPLATE_SEEDS.length);

    const templates = await listTemplates();
    expect(templates).toHaveLength(OUTREACH_TEMPLATE_SEEDS.length);
    for (const template of templates) {
      expect(template.isDefault).toBe(true);
      expect(template.enabled).toBe(true);
      expect(template.prospectTag).toBeTruthy();
      // Variables are derived at seed time so the editor can validate against them.
      expect(template.variables).toContain("businessName");
      expect(template.variables).toContain("reportUrl");
    }
  });

  it("is idempotent — seeding twice inserts nothing new", async () => {
    const { ensureSeededTemplates } =
      await import("@/lib/server/email/templates");

    await ensureSeededTemplates();
    const second = await ensureSeededTemplates();
    expect(second.inserted).toBe(0);
    expect(second.refreshed).toBe(0);
  });

  it("refreshes an untouched default when the seed changes", async () => {
    const { ensureSeededTemplates, getTemplate } =
      await import("@/lib/server/email/templates");
    const { emailTemplates } = await import("@/lib/server/db/collections");

    await ensureSeededTemplates();
    const key = OUTREACH_TEMPLATE_SEEDS[0]!.key;

    // Simulate an older deployment's wording, still marked as a default.
    await (
      await emailTemplates()
    ).updateOne({ key }, { $set: { subject: "Old wording", isDefault: true } });

    const { refreshed } = await ensureSeededTemplates();
    expect(refreshed).toBe(1);
    expect((await getTemplate(key))?.subject).toBe(
      OUTREACH_TEMPLATE_SEEDS[0]!.subject,
    );
  });

  it("never overwrites a template a human has edited", async () => {
    // The guarantee this flag exists for. A deploy that reverted an operator's
    // reviewed wording would be a silent, unrecoverable data loss.
    const { ensureSeededTemplates, updateTemplate, getTemplate } =
      await import("@/lib/server/email/templates");

    await ensureSeededTemplates();
    const key = OUTREACH_TEMPLATE_SEEDS[0]!.key;

    await updateTemplate(key, { subject: "My own carefully chosen subject" });
    const edited = await getTemplate(key);
    expect(edited?.isDefault).toBe(false);

    const { refreshed } = await ensureSeededTemplates();
    expect(refreshed).toBe(0);
    expect((await getTemplate(key))?.subject).toBe(
      "My own carefully chosen subject",
    );
  });

  it("marks a template as edited even when the content matches the seed", async () => {
    // Taking ownership is the point, not whether the bytes differ.
    const { ensureSeededTemplates, updateTemplate, getTemplate } =
      await import("@/lib/server/email/templates");

    await ensureSeededTemplates();
    const seed = OUTREACH_TEMPLATE_SEEDS[0]!;
    await updateTemplate(seed.key, { subject: seed.subject });

    expect((await getTemplate(seed.key))?.isDefault).toBe(false);
  });

  it("recomputes variables when blocks are edited", async () => {
    const { ensureSeededTemplates, updateTemplate, getTemplate } =
      await import("@/lib/server/email/templates");

    await ensureSeededTemplates();
    const key = OUTREACH_TEMPLATE_SEEDS[0]!.key;

    await updateTemplate(key, {
      subject: "Hi {{businessName}}",
      blocks: [{ type: "p", text: "Your city is {{city}}." }],
    });

    const updated = await getTemplate(key);
    expect(updated?.variables).toEqual(["businessName", "city"]);
  });

  it("restores a template to its shipped default", async () => {
    const {
      ensureSeededTemplates,
      updateTemplate,
      resetTemplate,
      getTemplate,
    } = await import("@/lib/server/email/templates");

    await ensureSeededTemplates();
    const seed = OUTREACH_TEMPLATE_SEEDS[0]!;
    await updateTemplate(seed.key, { subject: "Changed", enabled: false });

    expect(await resetTemplate(seed.key)).toBe(true);
    const restored = await getTemplate(seed.key);
    expect(restored?.subject).toBe(seed.subject);
    expect(restored?.isDefault).toBe(true);
    expect(restored?.enabled).toBe(true);
  });

  it("resolves a template for a tag, falling back to the seed when unseeded", async () => {
    const { getTemplateForTag } = await import("@/lib/server/email/templates");

    // Nothing in the database at all — a send must still find its template.
    const template = await getTemplateForTag("no-website");
    expect(template?.key).toBe("outreach.no-website");
  });

  it("returns nothing for a disabled template, so the toggle actually stops sends", async () => {
    // Falling back to the seed here would make "disabled" a no-op: the operator
    // would believe sending had stopped while it carried on.
    const { ensureSeededTemplates, updateTemplate, getTemplateForTag } =
      await import("@/lib/server/email/templates");

    await ensureSeededTemplates();
    await updateTemplate("outreach.no-website", { enabled: false });

    expect(await getTemplateForTag("no-website")).toBeNull();

    // Re-enabling restores it, edits intact.
    await updateTemplate("outreach.no-website", { enabled: true });
    expect((await getTemplateForTag("no-website"))?.key).toBe(
      "outreach.no-website",
    );
  });

  it("prefers an operator's edited wording over the seed", async () => {
    const { ensureSeededTemplates, updateTemplate, getTemplateForTag } =
      await import("@/lib/server/email/templates");

    await ensureSeededTemplates();
    await updateTemplate("outreach.no-website", { subject: "Mine" });

    expect((await getTemplateForTag("no-website"))?.subject).toBe("Mine");
  });

  it("seeds once per process on the read path, not once per page view", async () => {
    const { listTemplates, resetSeededTemplatesFlag } =
      await import("@/lib/server/email/templates");
    const { emailTemplates } = await import("@/lib/server/db/collections");
    resetSeededTemplatesFlag();

    const first = await listTemplates();
    expect(first).toHaveLength(OUTREACH_TEMPLATE_SEEDS.length);

    // Delete a template behind the read path's back. A second listTemplates()
    // must NOT re-seed it, because reconciliation already ran in this process —
    // that is the whole point of the guard. /admin/email used to pay nine serial
    // round trips on every single render.
    await (
      await emailTemplates()
    ).deleteOne({
      key: OUTREACH_TEMPLATE_SEEDS[0]!.key,
    });
    const second = await listTemplates();
    expect(second).toHaveLength(OUTREACH_TEMPLATE_SEEDS.length - 1);

    // Clearing the flag restores full reconciliation, so a fresh process heals.
    resetSeededTemplatesFlag();
    const third = await listTemplates();
    expect(third).toHaveLength(OUTREACH_TEMPLATE_SEEDS.length);
  });

  it("still reconciles every time when called directly", async () => {
    const { ensureSeededTemplates } =
      await import("@/lib/server/email/templates");
    const { emailTemplates } = await import("@/lib/server/db/collections");

    const a = await ensureSeededTemplates();
    expect(a.inserted).toBe(OUTREACH_TEMPLATE_SEEDS.length);

    await (
      await emailTemplates()
    ).deleteOne({
      key: OUTREACH_TEMPLATE_SEEDS[0]!.key,
    });
    // Direct callers (deploy steps, tests) must never be short-circuited.
    const b = await ensureSeededTemplates();
    expect(b.inserted).toBe(1);
  });
});
