import { NextRequest } from "next/server";
import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";
import { createSignedToken } from "@/lib/server/tokens";
import type { EmailMessageDoc } from "@/lib/server/db/types";

describeWithDatabase("GET /e/o/[token]", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { emailMessages, leadActivities } =
      await import("@/lib/server/db/collections");
    await (await emailMessages()).deleteMany({});
    await (await leadActivities()).deleteMany({});
  });

  it("records an open and returns a GIF for a valid token", async () => {
    const { emailMessages } = await import("@/lib/server/db/collections");
    await (
      await emailMessages()
    ).insertOne({
      messageId: "msg_open_1",
      to: "lead@example.com",
      toName: null,
      from: "hello@bitecodes.com",
      replyTo: null,
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      templateKey: null,
      category: "nurture",
      status: "sent",
      skipReason: null,
      prospectId: null,
      leadId: null,
      enrollmentId: null,
      sequenceStep: null,
      approvedById: null,
      approvedAt: null,
      sendAfter: new Date(),
      sentAt: new Date(),
      failedAt: null,
      lastError: null,
      attempts: 1,
      providerMessageId: null,
      opens: [],
      clicks: [],
      trackingId: "track_open_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as EmailMessageDoc);

    const token = createSignedToken({
      purpose: "email-open",
      data: { m: "track_open_1" },
    });
    const { GET } = await import("@/app/e/o/[token]/route");
    const response = await GET(
      new NextRequest(`http://www.bitecodes.com/e/o/${token}`),
      { params: Promise.resolve({ token }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/gif");

    const stored = await (
      await emailMessages()
    ).findOne({
      trackingId: "track_open_1",
    });
    expect(stored?.opens).toHaveLength(1);
  });

  it("redirects home instead of recording an unsigned open", async () => {
    const { GET } = await import("@/app/e/o/[token]/route");
    const response = await GET(
      new NextRequest("http://www.bitecodes.com/e/o/not-a-token"),
      { params: Promise.resolve({ token: "not-a-token" }) },
    );

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
  });
});
