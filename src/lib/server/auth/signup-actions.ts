"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { resendVerification, signUpCustomer } from "@/lib/server/auth/signup";
import { normalizeEmail } from "@/lib/email/address";
import { kickJobs } from "@/lib/server/jobs/worker";

/**
 * Sign-up Server Actions.
 *
 * Kept apart from `actions.ts` because these are the only auth endpoints an
 * unauthenticated stranger is *meant* to succeed at, and the abuse questions are
 * different: not "who is this", but "how many of these should one address be
 * allowed to cause, and who pays when they do".
 *
 * Every response here is deliberately uninformative about whether an account
 * exists. See the note in `signup.ts` — the module keeps that contract, and
 * these actions must not undo it by reporting anything the module did not.
 */

async function hashedRequestIp(): Promise<string> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(200),
  company: z.string().trim().max(120).optional(),
  /** Unused field the widget scripts leave empty. Filled in means a bot. */
  website: z.string().max(200).optional(),
  terms: z.string().optional(),
});

export type SignupState =
  | { sent: true; email: string }
  | {
      sent?: false;
      error: string;
      field?: "name" | "email" | "password" | "terms";
      /** Echoed so a rejected attempt does not clear the whole form. */
      values?: { name?: string; email?: string; company?: string };
    }
  | undefined;

export async function signupAction(
  _previous: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    company: formData.get("company") || undefined,
    website: formData.get("website") || undefined,
    terms: formData.get("terms") || undefined,
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Fill in your name, email address, and a password.",
      values: {
        name: typeof raw.name === "string" ? raw.name : "",
        email: typeof raw.email === "string" ? raw.email : "",
        company: typeof raw.company === "string" ? raw.company : "",
      },
    };
  }

  const values = {
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company ?? "",
  };

  if (parsed.data.website) {
    // Honeypot. Answered as success and dropped on the floor: telling a bot it
    // was detected only teaches whoever wrote it to fill the field in next time.
    return { sent: true, email: parsed.data.email };
  }

  if (!parsed.data.terms) {
    return {
      error: "Please accept the terms and the privacy policy to continue.",
      field: "terms",
      values,
    };
  }

  const throttle = await consumeNamedRateLimit(
    "signup",
    await hashedRequestIp(),
  );
  if (!throttle.allowed) {
    return {
      error: `Too many sign-ups from this connection. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
      values,
    };
  }

  const result = await signUpCustomer({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    company: parsed.data.company,
  });

  if (!result.ok) {
    return { error: result.error, field: result.field, values };
  }

  await recordAudit({
    action: AUDIT_ACTIONS.signupStarted,
    actorEmail: normalizeEmail(parsed.data.email),
  });

  // Queued, not sent. Nudge the worker so the link lands in seconds rather than
  // whenever the cron next runs — a verification email that arrives in fifteen
  // minutes is a sign-up that does not complete.
  after(() => kickJobs(15_000));

  return { sent: true, email: parsed.data.email };
}

export type VerifyState = { error: string } | undefined;

/**
 * Completes email verification.
 *
 * Reached from a button rather than from the GET that loaded the page, for the
 * same reason the sign-in link is: inbox scanners and link-preview bots fetch
 * every URL in an email, and a GET that consumed the single-use token would
 * spend it before the recipient ever clicked. It also keeps the write out of a
 * component render, where a retry would run it twice.
 *
 * On success the account is active but no session is created. A verification
 * link lives for 48 hours; treating one as a sign-in would make a link sitting
 * in an inbox for two days equivalent to the password. They type the password
 * they chose a minute ago instead.
 */
export async function completeVerificationAction(
  _previous: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token || token.length > 200) {
    return { error: "That confirmation link is incomplete." };
  }

  const throttle = await consumeNamedRateLimit(
    "verifyResend",
    await hashedRequestIp(),
  );
  if (!throttle.allowed) {
    return {
      error: `Too many attempts. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const { verifyEmail } = await import("@/lib/server/auth/signup");
  const result = await verifyEmail(token);

  if (!result.ok) {
    return {
      error:
        "That confirmation link has expired or was already used. Enter your address below and we will send a fresh one.",
    };
  }

  await recordAudit({
    action: AUDIT_ACTIONS.signupVerified,
    actorId: result.userId,
    actorEmail: result.email,
    detail: { creditsGranted: result.granted },
  });

  redirect("/login?verified=1");
}

export type ResendState = { sent: true } | { error: string } | undefined;

export async function resendVerificationAction(
  _previous: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const email = formData.get("email");
  if (typeof email !== "string" || email.length < 3 || email.length > 254) {
    return { error: "Enter the email address you signed up with." };
  }

  const throttle = await consumeNamedRateLimit(
    "verifyResend",
    await hashedRequestIp(),
  );
  if (!throttle.allowed) {
    return {
      error: `Too many requests. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
    };
  }

  await resendVerification(email);
  after(() => kickJobs(15_000));

  // Reports success whether or not there was a pending account to resend to.
  return { sent: true };
}
