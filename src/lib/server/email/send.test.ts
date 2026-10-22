import { beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import type { EmailMessageDoc } from "@/lib/server/db/types";

vi.mock("@/lib/server/email/transport", () => ({
  getTransporter: () => ({ sendMail }),
}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));
const sendMail = vi.fn(async () => ({ messageId: "provider-1" }));

function message(overrides: Partial<EmailMessageDoc> = {}): EmailMessageDoc {
  const now = new Date();
  return {
    messageId: `m-${Math.round(Math.random() * 1e9)}`,
    to: "owner@example.com",
    toName: "Owner",
    from: "Bitecodes <test@example.com>",
    replyTo: "owner@example.com",
    subject: "A note about your site",
    html: '<p>Hello</p><a href="https://www.bitecodes.com/api/unsubscribe?t=x">Unsubscribe</a>',
    text: "Hello\n\nUnsubscribe: https://www.bitecodes.com/api/unsubscribe?t=x",
    templateKey: "outreach.no-website",
    category: "outreach",
    status: "queued",
    skipReason: null,
    prospectId: null,
    leadId: null,
    enrollmentId: null,
    sequenceStep: null,
    approvedById: null,
    approvedAt: null,
    sendAfter: now,
    sentAt: null,
    failedAt: null,
    lastError: null,
    attempts: 0,
    providerMessageId: null,
    opens: [],
    clicks: [],
    trackingId: "track-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describeWithDatabase("delivery", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { emailMessages, jobs, siteSettings, suppressions } =
      await import("@/lib/server/db/collections");
    for (const collection of [
      await emailMessages(),
      await jobs(),
      await siteSettings(),
      await suppressions(),
    ]) {
      await collection.deleteMany({});
    }
    sendMail.mockClear();
  });

  it("retries a message whose previous SMTP attempt failed", async () => {
    // The job queue retries a failed send, but the message was persisted as
    // `failed`. If delivery refused to claim that state the retry would report
    // "not-queued" and the job would succeed without sending anything.
    const { emailMessages } = await import("@/lib/server/db/collections");
    const { deliverMessage } = await import("@/lib/server/email/send");

    const doc = message({ status: "failed", lastError: "connection reset" });
    await (await emailMessages()).insertOne(doc);

    const result = await deliverMessage(doc.messageId);

    expect(result.sent).toBe(true);
    expect(sendMail).toHaveBeenCalledOnce();
    const after = await (
      await emailMessages()
    ).findOne({
      messageId: doc.messageId,
    });
    expect(after?.status).toBe("sent");
    expect(after?.attempts).toBe(1);
  });

  it("never resends a message stuck in sending", async () => {
    // A crash between sendMail and the status update leaves the outcome
    // unknown. Retrying could deliver twice, which is worse for cold outreach
    // than a message a human has to reconcile.
    const { emailMessages } = await import("@/lib/server/db/collections");
    const { deliverMessage } = await import("@/lib/server/email/send");

    const doc = message({ status: "sending" });
    await (await emailMessages()).insertOne(doc);

    const result = await deliverMessage(doc.messageId);

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("not-queued");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("defers a commercial message to the next UTC day when the cap is spent", async () => {
    // Caps used to be checked only at queue time, so a batch queued in the
    // morning could send past the ceiling later in the day.
    const { emailMessages, jobs } = await import("@/lib/server/db/collections");
    const { deliverMessage } = await import("@/lib/server/email/send");
    const { updateSettings } = await import("@/lib/server/settings");

    await updateSettings({ automation: { globalDailyCap: 0 } });
    const doc = message();
    await (await emailMessages()).insertOne(doc);

    const result = await deliverMessage(doc.messageId);

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("global-cap");
    expect(sendMail).not.toHaveBeenCalled();

    const after = await (
      await emailMessages()
    ).findOne({
      messageId: doc.messageId,
    });
    expect(after?.status).toBe("queued");
    expect(after?.sendAfter.getTime()).toBeGreaterThan(Date.now());

    const retry = await (
      await jobs()
    ).findOne({
      type: "email.send",
      payload: { messageId: doc.messageId, track: true },
    });
    expect(retry).toBeTruthy();
    expect(retry?.idempotencyKey).toContain(doc.messageId);
  });

  it("does not defer transactional mail behind the commercial cap", async () => {
    const { emailMessages } = await import("@/lib/server/db/collections");
    const { deliverMessage } = await import("@/lib/server/email/send");
    const { updateSettings } = await import("@/lib/server/settings");

    await updateSettings({ automation: { globalDailyCap: 0 } });
    const doc = message({ category: "transactional" });
    await (await emailMessages()).insertOne(doc);

    expect((await deliverMessage(doc.messageId)).sent).toBe(true);
  });
});
