import { beforeEach, describe, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describeWithDatabase("feedback", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { feedback, testimonials } =
      await import("@/lib/server/db/collections");
    await (await feedback()).deleteMany({});
    await (await testimonials()).deleteMany({});
  });

  describe("createFeedbackRequest", () => {
    it("creates a feedback record in requested status", async () => {
      const { createFeedbackRequest } =
        await import("@/lib/server/feedback/index");
      const { feedback } = await import("@/lib/server/db/collections");

      const { feedbackId, token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      expect(feedbackId).toBeTruthy();
      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(10);

      const col = await feedback();
      const count = await col.countDocuments({ status: "requested" });
      expect(count).toBe(1);
    });

    it("stores a hashed token, never the plaintext", async () => {
      const { createFeedbackRequest } =
        await import("@/lib/server/feedback/index");
      const { feedback } = await import("@/lib/server/db/collections");

      const { token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      const col = await feedback();
      const doc = await col.findOne({ status: "requested" });
      expect(doc?.tokenHash).not.toBe(token);
      expect(doc?.tokenHash).toHaveLength(64); // SHA-256 hex
    });
  });

  describe("verifyToken", () => {
    it("returns the feedback doc for a valid token", async () => {
      const { createFeedbackRequest, verifyToken } =
        await import("@/lib/server/feedback/index");

      const { token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      const doc = await verifyToken(token);
      expect(doc).not.toBeNull();
      expect(doc?.ownerId).toBe("owner-1");
    });

    it("returns null for a non-existent token", async () => {
      const { verifyToken } = await import("@/lib/server/feedback/index");
      const result = await verifyToken("not-a-real-token-xyz-abc");
      expect(result).toBeNull();
    });

    it("returns null for an empty token", async () => {
      const { verifyToken } = await import("@/lib/server/feedback/index");
      const result = await verifyToken("");
      expect(result).toBeNull();
    });
  });

  describe("submitFeedback", () => {
    it("saves score and marks status received", async () => {
      const { createFeedbackRequest, submitFeedback } =
        await import("@/lib/server/feedback/index");
      const { feedback } = await import("@/lib/server/db/collections");

      const { token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      const result = await submitFeedback({ token, score: 9 });
      expect(result.ok).toBe(true);

      const col = await feedback();
      const doc = await col.findOne({ status: "received" });
      expect(doc?.score).toBe(9);
      expect(doc?.respondedAt).toBeInstanceOf(Date);
    });

    it("rejects an invalid score", async () => {
      const { createFeedbackRequest, submitFeedback } =
        await import("@/lib/server/feedback/index");

      const { token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      const result = await submitFeedback({ token, score: 11 });
      expect(result.ok).toBe(false);
    });

    it("rejects a duplicate submission", async () => {
      const { createFeedbackRequest, submitFeedback } =
        await import("@/lib/server/feedback/index");

      const { token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      await submitFeedback({ token, score: 8 });
      const second = await submitFeedback({ token, score: 7 });
      expect(second.ok).toBe(false);
    });

    it("creates a pending testimonial when consent is given", async () => {
      const { createFeedbackRequest, submitFeedback } =
        await import("@/lib/server/feedback/index");
      const { testimonials } = await import("@/lib/server/db/collections");

      const { token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      await submitFeedback({
        token,
        score: 10,
        comment: "Absolutely fantastic service, highly recommend!",
        testimonialConsent: true,
        authorName: "Jane Doe",
        company: "Acme Corp",
      });

      const col = await testimonials();
      const testimonial = await col.findOne({ status: "pending" });
      expect(testimonial).not.toBeNull();
      expect(testimonial?.quote).toBe(
        "Absolutely fantastic service, highly recommend!",
      );
      expect(testimonial?.authorName).toBe("Jane Doe");
      expect(testimonial?.company).toBe("Acme Corp");
    });

    it("does not create a testimonial without consent", async () => {
      const { createFeedbackRequest, submitFeedback } =
        await import("@/lib/server/feedback/index");
      const { testimonials } = await import("@/lib/server/db/collections");

      const { token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      await submitFeedback({
        token,
        score: 9,
        comment: "Good service overall.",
        testimonialConsent: false,
      });

      const col = await testimonials();
      const count = await col.countDocuments({});
      expect(count).toBe(0);
    });
  });

  describe("isEligibleForFeedback", () => {
    it("returns true for a customer who has never been surveyed", async () => {
      const { isEligibleForFeedback } =
        await import("@/lib/server/feedback/index");
      const eligible = await isEligibleForFeedback("new-owner", "2026-10");
      expect(eligible).toBe(true);
    });

    it("returns false when a survey has already been sent for this key", async () => {
      const { createFeedbackRequest, isEligibleForFeedback } =
        await import("@/lib/server/feedback/index");

      await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-10",
      });

      const eligible = await isEligibleForFeedback("owner-1", "2026-10");
      expect(eligible).toBe(false);
    });

    it("returns false when owner responded within 30 days", async () => {
      const { createFeedbackRequest, submitFeedback, isEligibleForFeedback } =
        await import("@/lib/server/feedback/index");

      const { token } = await createFeedbackRequest({
        ownerId: "owner-1",
        email: "user@example.com",
        source: "nps-survey",
        surveyKey: "2026-09",
      });
      await submitFeedback({ token, score: 8 });

      // Different month, but responded recently
      const eligible = await isEligibleForFeedback("owner-1", "2026-10");
      expect(eligible).toBe(false);
    });
  });
});
