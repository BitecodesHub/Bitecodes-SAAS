import { NextRequest } from "next/server";
import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { createSignedToken } from "@/lib/server/tokens";
import type {
  EmailMessageDoc,
  EmailSequenceDoc,
  SequenceEnrollmentDoc,
} from "@/lib/server/db/types";

const now = new Date();

describeWithDatabase("GET /e/c/[token]", () => {
  useTestDatabase();

  beforeEach(async () => {
    const {
      emailMessages,
      emailSequences,
      leadActivities,
      sequenceEnrollments,
    } = await import("@/lib/server/db/collections");
    await (await emailMessages()).deleteMany({});
    await (await emailSequences()).deleteMany({});
    await (await sequenceEnrollments()).deleteMany({});
    await (await leadActivities()).deleteMany({});
  });

  it("records the click, stops the sequence, and redirects to the signed URL", async () => {
    const { emailMessages, emailSequences, sequenceEnrollments } =
      await import("@/lib/server/db/collections");

    await (
      await emailSequences()
    ).insertOne({
      key: "inbound.followup",
      name: "Inbound",
      description: "test",
      prospectTag: null,
      audience: "lead",
      enabled: true,
      steps: [{ templateKey: "inbound.welcome", delayHours: 48 }],
      stopOnClick: true,
      createdAt: now,
      updatedAt: now,
    } as EmailSequenceDoc);
    await (
      await sequenceEnrollments()
    ).insertOne({
      enrollmentId: "enr_click_1",
      sequenceKey: "inbound.followup",
      prospectId: null,
      leadId: "507f1f77bcf86cd799439011",
      leadKind: "enquiry",
      consentAt: now,
      email: "lead@example.com",
      status: "active",
      stoppedReason: null,
      currentStep: 0,
      nextRunAt: now,
      createdAt: now,
      updatedAt: now,
    } as SequenceEnrollmentDoc);
    await (
      await emailMessages()
    ).insertOne({
      messageId: "msg_click_1",
      to: "lead@example.com",
      toName: null,
      from: "hello@bitecodes.com",
      replyTo: null,
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      templateKey: "inbound.welcome",
      category: "nurture",
      status: "sent",
      skipReason: null,
      prospectId: null,
      leadId: "507f1f77bcf86cd799439011",
      enrollmentId: "enr_click_1",
      sequenceStep: 1,
      approvedById: null,
      approvedAt: null,
      sendAfter: now,
      sentAt: now,
      failedAt: null,
      lastError: null,
      attempts: 1,
      providerMessageId: null,
      opens: [],
      clicks: [],
      trackingId: "track_click_1",
      createdAt: now,
      updatedAt: now,
    } as EmailMessageDoc);

    const token = createSignedToken({
      purpose: "email-click",
      data: { m: "track_click_1", u: "https://example.com/report" },
    });
    const { GET } = await import("@/app/e/c/[token]/route");
    const response = await GET(
      new NextRequest(`http://www.bitecodes.com/e/c/${token}`),
      { params: Promise.resolve({ token }) },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/report");

    const message = await (
      await emailMessages()
    ).findOne({
      trackingId: "track_click_1",
    });
    expect(message?.clicks).toHaveLength(1);

    const enrollment = await (
      await sequenceEnrollments()
    ).findOne({
      enrollmentId: "enr_click_1",
    });
    expect(enrollment?.status).toBe("stopped");
    expect(enrollment?.stoppedReason).toBe("clicked");
  });

  it("refuses a signed token whose URL is not http(s)", async () => {
    const { GET } = await import("@/app/e/c/[token]/route");
    const token = createSignedToken({
      purpose: "email-click",
      data: { m: "track_click_1", u: "javascript:alert(1)" },
    });
    const response = await GET(
      new NextRequest(`http://www.bitecodes.com/e/c/${token}`),
      { params: Promise.resolve({ token }) },
    );

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
  });
});
