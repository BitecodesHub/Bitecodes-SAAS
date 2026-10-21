import { describe, expect, it } from "vitest";
import {
  gradeForScore,
  inferLeadCountry,
  isHotLead,
  scoreLead,
} from "@/lib/leads/score";

const ideal = {
  name: "Dr Asha Mehta",
  email: "asha@mehta-clinic.in",
  phone: "+91 98765 43210",
  company: "Mehta Clinic",
  message:
    "Our clinic needs online appointment booking, patient intake forms, and automated reminders. The current website is slow and hard to use on a phone.",
  budget: "₹5 lakh – ₹15 lakh",
  timeline: "As soon as possible",
  source: "website-contact",
  kind: "form",
  engagement: { opens: 2, clicks: 1, replies: 1 },
};

describe("gradeForScore", () => {
  it("uses the documented bands", () => {
    expect(gradeForScore(75)).toBe("A");
    expect(gradeForScore(74)).toBe("B");
    expect(gradeForScore(55)).toBe("B");
    expect(gradeForScore(54)).toBe("C");
    expect(gradeForScore(35)).toBe("C");
    expect(gradeForScore(34)).toBe("D");
  });

  it("treats A and B as hot", () => {
    expect(isHotLead({ score: 75, grade: "A" })).toBe(true);
    expect(isHotLead({ score: 55, grade: "B" })).toBe(true);
    expect(isHotLead({ score: 54, grade: "C" })).toBe(false);
  });
});

describe("inferLeadCountry", () => {
  it("prefers an explicit answer, then ccTLD, then phone", () => {
    expect(inferLeadCountry({ country: "AU", email: "x@example.in" })).toBe(
      "AU",
    );
    expect(inferLeadCountry({ email: "x@clinic.com.au" })).toBe("AU");
    expect(inferLeadCountry({ email: "x@clinic.in" })).toBe("IN");
    expect(inferLeadCountry({ phone: "+61 400 000 000" })).toBe("AU");
    expect(inferLeadCountry({ phone: "+91 90000 00000" })).toBe("IN");
  });

  it("does not guess from a generic .com address", () => {
    expect(inferLeadCountry({ email: "x@example.com" })).toBeNull();
    expect(inferLeadCountry({ country: "other" })).toBeNull();
  });
});

describe("scoreLead", () => {
  it("scores a strong ICP enquiry as an A and names the reasons", () => {
    const result = scoreLead(ideal);

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.grade).toBe("A");
    expect(result.fit).toBe("strong");
    expect(result.segmentId).toBe("healthcare-allied-health");
    expect(result.country).toBe("IN");
    expect(result.disqualified).toBeNull();
    expect(result.reasons.join(" ")).toContain("₹5–15 lakh");
    expect(result.reasons.join(" ")).toContain("Healthcare");
  });

  it("awards the mid budget band, not the top one, for a 5–15 range", () => {
    const result = scoreLead({
      ...ideal,
      engagement: undefined,
      budget: "₹5 lakh – ₹15 lakh",
    });
    const reasons = result.reasons.join(" ");

    expect(reasons).toContain("₹5–15 lakh (+12)");
    expect(reasons).not.toContain("₹15 lakh or more");
  });

  it("penalises a free-mail address compared with a company domain", () => {
    const business = scoreLead({ ...ideal, engagement: undefined });
    const freeMail = scoreLead({
      ...ideal,
      email: "asha@gmail.com",
      engagement: undefined,
    });

    expect(freeMail.score).toBeLessThan(business.score);
    expect(freeMail.reasons.join(" ")).toContain("Free-mail");
  });

  it("clamps job applications even when the budget is large", () => {
    const result = scoreLead({
      ...ideal,
      message: "I am applying for a job and attached my resume and CV.",
    });

    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.disqualified).toContain("Job");
    expect(result.fit).not.toBe("strong");
  });

  it("returns a low score for a sparse, out-of-profile enquiry", () => {
    const result = scoreLead({
      name: "A",
      email: null,
      message: "hello",
    });

    expect(result.grade).toBe("D");
    expect(result.country).toBeNull();
    expect(result.segmentId).toBeNull();
  });

  it("never exceeds 100 or drops below zero", () => {
    const high = scoreLead({
      ...ideal,
      engagement: { opens: 99, clicks: 99, replies: 99 },
    });
    const low = scoreLead({ message: "internship" });

    expect(high.score).toBe(100);
    expect(low.score).toBeGreaterThanOrEqual(0);
  });
});
