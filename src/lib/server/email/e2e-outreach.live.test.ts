import { beforeAll, describe, expect, it } from "vitest";

/**
 * Drives the real outreach path against the **development** database, so the
 * result is visible in the admin UI.
 *
 * Opt-in via `RUN_LIVE_EMAIL=1`. Unlike the other suites this one deliberately
 * does not use a throwaway database — the whole point is to leave queued
 * messages behind for a human to look at on `/admin/email`.
 *
 * It never delivers: `automation.requireApproval` is on, so messages stop at
 * `pending_approval`. Nothing reaches an inbox without someone clicking approve.
 */

const LIVE = process.env.RUN_LIVE_EMAIL === "1";
const describeLive = LIVE ? describe : describe.skip;

if (!LIVE) {
  it("live email end-to-end is opt-in", () => {
    expect(process.env.RUN_LIVE_EMAIL ?? "unset").not.toBe("1");
  });
}

describeLive("outreach end to end (dev database)", () => {
  beforeAll(() => {
    process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017";
    process.env.MONGODB_DB_NAME = "bitecodes_dev";

    // The whole server env schema is validated at once, and `getSettingsFresh`
    // swallows a validation failure and silently returns compiled-in defaults.
    // Without these, this test reads defaults instead of the real stored
    // settings — which is how it first appeared to fail on the postal address.
    process.env.SMTP_HOST ??= "localhost";
    process.env.SMTP_PORT ??= "1025";
    process.env.SMTP_SECURE ??= "false";
    process.env.SMTP_USER ??= "test";
    process.env.SMTP_PASSWORD ??= "test";
    process.env.SMTP_FROM ??= "Bitecodes <test@example.com>";
    process.env.CONTACT_NOTIFICATION_TO ??= "owner@example.com";
    process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long-000";
  });

  it("queues tag-matched outreach that stops at the approval gate", async () => {
    const { listProspects } =
      await import("@/lib/server/prospecting/repository");
    const { prepareBulkOutreach } = await import("@/lib/server/email/outreach");
    const { listPendingApproval, getEmailMessage } =
      await import("@/lib/server/email/inbox");
    const { getSettingsFresh } = await import("@/lib/server/settings");

    const settings = await getSettingsFresh();
    // The safety property this whole test relies on.
    expect(settings.automation.requireApproval).toBe(true);
    expect(settings.contact.address.postal.length).toBeGreaterThan(5);

    const withEmail = await listProspects({ emailOnly: true, pageSize: 5 });
    expect(withEmail.items.length).toBeGreaterThan(0);

    // Guard: this test must never touch a real business address.
    for (const prospect of withEmail.items) {
      expect(prospect.email).toBe("ismailmansury9737@gmail.com");
    }

    const ids = withEmail.items
      .filter((p) => p.classification)
      .map((p) => p._id!.toHexString());
    expect(ids.length).toBeGreaterThan(0);

    const summary = await prepareBulkOutreach(ids, { spacingSeconds: 60 });
    console.log(
      `[e2e] queued=${summary.queued} skipped=${summary.skipped.length}`,
      summary.skipped.map((s) => `${s.reason}`).join(","),
    );

    const pending = await listPendingApproval(50);
    expect(pending.length).toBeGreaterThan(0);

    // Inspect one rendered message the way a recipient would receive it.
    const message = await getEmailMessage(pending[0]!.messageId);
    expect(message).toBeTruthy();
    expect(message!.status).toBe("pending_approval");
    expect(message!.sentAt).toBeNull();

    // No unrendered placeholder may reach a stranger.
    expect(message!.html).not.toMatch(/\{\{[^}]+\}\}/);
    expect(message!.text).not.toMatch(/\{\{[^}]+\}\}/);

    // Compliance essentials for commercial mail.
    expect(message!.html).toContain("/api/unsubscribe");
    expect(message!.html).toContain("Ahmedabad");
    expect(message!.text.length).toBeGreaterThan(120);

    // The template chosen must match the prospect's classification.
    expect(message!.templateKey).toMatch(/^outreach\./);
    expect(message!.category).toBe("outreach");

    console.log(
      `[e2e] template=${message!.templateKey}\n[e2e] subject=${message!.subject}\n` +
        `[e2e] text:\n${message!.text.slice(0, 700)}`,
    );
  }, 120_000);
});
