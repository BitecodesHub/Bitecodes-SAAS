import { z } from "zod";

export const contactBudgets = [
  "Under ₹1 lakh",
  "₹1 lakh – ₹5 lakh",
  "₹5 lakh – ₹15 lakh",
  "₹15 lakh+",
  "Not sure yet",
] as const;

/** Timing is a buying signal, not a delivery promise. */
export const contactTimelines = [
  "As soon as possible",
  "Within 1 month",
  "1–3 months",
  "3–6 months",
  "Just exploring",
] as const;

/** Country is optional; the scorer treats it as a signal, never a gate. */
export const contactCountries = [
  { value: "IN", label: "India" },
  { value: "AU", label: "Australia" },
  { value: "other", label: "Somewhere else" },
] as const;

export const CONTACT_CONSENT_TEXT =
  "By sending this form, I agree to Bitecodes storing these details and contacting me about this enquiry.";

export const MARKETING_CONSENT_TEXT =
  "Send me an occasional short email with practical website, automation, and growth notes. I can unsubscribe at any time.";

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name.").max(100),
    email: z.string().trim().toLowerCase().email("Please enter a valid email."),
    company: z.string().trim().max(120),
    budget: z.enum(contactBudgets).or(z.literal("")),
    message: z
      .string()
      .trim()
      .min(10, "A little more detail helps us reply usefully.")
      .max(
        2000,
        "That is a little long — please keep it under 2000 characters.",
      ),
    role: z.string().trim().max(100),
    timeline: z.enum(contactTimelines).or(z.literal("")).optional(),
    country: z.enum(["IN", "AU", "other"]).or(z.literal("")).optional(),
    /** Explicit opt-in to marketing email. Unticked by default. */
    followUp: z.boolean().optional(),
    /** First-touch attribution, sanitised on the server. */
    attribution: z.unknown().optional(),
    // Honeypot: must accept any value so the API can silently discard bot
    // submissions instead of returning a 400 that names this field.
    website: z.string().max(200),
  })
  .strict();

export const contactFormSchema = contactSchema.omit({
  role: true,
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;

export type ContactResponse =
  | { ok: true; reference: string }
  | {
      ok: false;
      code: "INVALID" | "RATE_LIMITED" | "UNAVAILABLE";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };
