import { describe, expect, it } from "vitest";
import { contactFormSchema, contactSchema } from "@/lib/contact";

const validInput = {
  name: "Asha Patel",
  email: "ASHA@example.com ",
  company: "Acme",
  budget: "₹1 lakh – ₹5 lakh",
  message: "We need a secure customer portal for our operations team.",
  role: "",
  website: "",
};

describe("contactSchema", () => {
  it("normalizes a valid enquiry", () => {
    const result = contactSchema.parse(validInput);

    expect(result.email).toBe("asha@example.com");
    expect(result.name).toBe("Asha Patel");
  });

  it("rejects unknown fields", () => {
    expect(() =>
      contactSchema.parse({ ...validInput, isAdmin: true }),
    ).toThrow();
  });

  it("accepts a filled honeypot so the API can silently discard it", () => {
    const result = contactSchema.parse({
      ...validInput,
      website: "https://spam.test",
    });

    expect(result.website).toBe("https://spam.test");
  });

  it("enforces useful message bounds", () => {
    expect(
      contactSchema.safeParse({ ...validInput, message: "Too short" }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ ...validInput, message: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });
});

describe("contactFormSchema", () => {
  it("accepts the browser-safe form fields", () => {
    const formInput = {
      name: validInput.name,
      email: validInput.email,
      company: validInput.company,
      budget: validInput.budget,
      message: validInput.message,
      website: validInput.website,
    };
    expect(contactFormSchema.safeParse(formInput).success).toBe(true);
  });
});
