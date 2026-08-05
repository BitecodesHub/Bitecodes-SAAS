"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createHash } from "node:crypto";
import { authenticateAdmin } from "@/lib/server/auth/login";
import {
  createAdminSession,
  destroyCurrentSession,
} from "@/lib/server/auth/session";
import { getAdminSession, getCurrentAdminUser } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { consumeNamedRateLimit } from "@/lib/server/rate-limit";
import { safeNextPath } from "@/lib/server/auth/next-path";
import {
  performPasswordReset,
  redeemLoginLink,
  requestLoginLink,
  requestPasswordReset,
} from "@/lib/server/auth/recovery";
import { kickJobs } from "@/lib/server/jobs/worker";
import { after } from "next/server";

/**
 * Authentication Server Actions.
 *
 * Server Actions rather than route handlers: Next verifies the request Origin
 * against the Host for every action invocation, which gives CSRF protection
 * without a hand-rolled token, and the form still submits without JavaScript.
 *
 * Treat these as public endpoints regardless — an action is reachable by anyone
 * who can craft a request, so every check is here on the server and none of it
 * relies on the UI.
 */

const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(200),
  totpCode: z.string().trim().max(10).optional(),
  /** Only ever a path, checked below. */
  next: z.string().max(500).optional(),
});

export type LoginState =
  | {
      error?: string;
      /** Set when the password was right but a second factor is needed. */
      needsTwoFactor?: boolean;
      /** Preserved so the form does not clear on a failed attempt. */
      email?: string;
    }
  | undefined;

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totpCode: formData.get("totpCode") || undefined,
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { error: "Enter your email address and password." };
  }

  const { email, password, totpCode } = parsed.data;
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    null;

  // Per-IP throttle on top of the per-account lockout. The lockout alone would
  // let an attacker lock every known admin out of their own panel; the throttle
  // makes the spraying itself expensive.
  const throttle = await consumeNamedRateLimit(
    "adminLogin",
    createHash("sha256")
      .update(ip ?? "unknown")
      .digest("hex"),
  );
  if (!throttle.allowed) {
    return {
      email,
      error: `Too many sign-in attempts. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const result = await authenticateAdmin(email, password, totpCode);

  if (!result.ok) {
    if (result.reason === "two-factor-required") {
      // Not an error: the password was correct, the form now asks for the code.
      return { email, needsTwoFactor: true };
    }

    if (result.reason === "locked") {
      await recordAudit({
        action: AUDIT_ACTIONS.loginLocked,
        actorEmail: email,
        detail: { retryAfterSeconds: result.retryAfterSeconds },
      });
      return {
        email,
        error: `This account is locked after too many failed attempts. Try again in ${Math.ceil(result.retryAfterSeconds / 60)} minutes.`,
      };
    }

    await recordAudit({
      action: AUDIT_ACTIONS.loginFailed,
      actorEmail: email,
      detail: { reason: result.reason },
    });

    // One message for every remaining failure. A distinct "no such account"
    // would enumerate valid admin addresses, which is exactly what the uniform
    // timing in `authenticateAdmin` is there to prevent.
    return {
      email,
      error: "Those details did not match an active account.",
    };
  }

  await createAdminSession({
    userId: result.userId,
    role: result.role,
    sessionEpoch: result.sessionEpoch,
    ip,
    userAgent: headerList.get("user-agent"),
  });

  await recordAudit({
    action: AUDIT_ACTIONS.loginSucceeded,
    actorId: result.userId,
    actorEmail: result.email,
    detail: { role: result.role, twoFactor: Boolean(totpCode) },
  });

  redirect(safeNextPath(parsed.data.next));
}

// ---------------------------------------------------------------------------
// Account recovery
// ---------------------------------------------------------------------------

const recoveryRequestSchema = z.object({
  email: z.string().trim().min(3).max(254),
  /** Which link to send. */
  mode: z.enum(["reset", "link"]),
});

export type RecoveryRequestState =
  | { sent: true; mode: "reset" | "link"; email: string }
  | { sent?: false; error: string; email?: string }
  | undefined;

async function hashedRequestIp(): Promise<string> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Sends a password-reset or one-click sign-in email.
 *
 * One action for both modes so they share the uniform response: whatever the
 * mode and whatever the address, the answer is always "if that address has an
 * account, the email is on its way".
 */
export async function requestRecoveryAction(
  _previous: RecoveryRequestState,
  formData: FormData,
): Promise<RecoveryRequestState> {
  const parsed = recoveryRequestSchema.safeParse({
    email: formData.get("email"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) {
    return { error: "Enter the email address you sign in with." };
  }

  const { email, mode } = parsed.data;

  const throttle = await consumeNamedRateLimit(
    mode === "reset" ? "passwordReset" : "loginLink",
    await hashedRequestIp(),
  );
  if (!throttle.allowed) {
    return {
      email,
      error: `Too many requests. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
    };
  }

  if (mode === "reset") {
    await requestPasswordReset(email);
  } else {
    await requestLoginLink(email);
  }

  await recordAudit({
    action:
      mode === "reset"
        ? AUDIT_ACTIONS.passwordResetRequested
        : AUDIT_ACTIONS.loginLinkRequested,
    actorEmail: email.trim().toLowerCase(),
  });

  // The email is queued, not sent; nudge the worker so it arrives in seconds.
  after(() => kickJobs(15_000));

  return { sent: true, mode, email };
}

const resetPasswordSchema = z
  .object({
    token: z.string().min(10).max(200),
    password: z.string().min(10).max(200),
    confirm: z.string().min(1).max(200),
  })
  .refine((value) => value.password === value.confirm, {
    message: "The two passwords do not match.",
  });

export type ResetPasswordState = { error: string } | undefined;

export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Choose a password of at least 10 characters, entered twice.",
    };
  }

  const throttle = await consumeNamedRateLimit(
    "passwordReset",
    await hashedRequestIp(),
  );
  if (!throttle.allowed) {
    return {
      error: `Too many attempts. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const result = await performPasswordReset(
    parsed.data.token,
    parsed.data.password,
  );
  if (!result.ok) {
    return {
      error:
        "That reset link is no longer valid. Request a fresh one from the sign-in page.",
    };
  }

  await recordAudit({
    action: AUDIT_ACTIONS.passwordChanged,
    actorId: result.userId,
    actorEmail: result.email,
    detail: { via: "reset-link" },
  });

  redirect("/admin/login?reset=done");
}

/**
 * Completes a one-click sign-in.
 *
 * Reached from a button on the landing page rather than directly from the GET:
 * inbox link-scanners prefetch every URL in an email, and a GET that consumed
 * the single-use token would burn the link before the owner ever saw it.
 */
export type LoginLinkState = { error: string } | undefined;

export async function completeLoginLinkAction(
  _previous: LoginLinkState,
  formData: FormData,
): Promise<LoginLinkState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token || token.length > 200) {
    return { error: "That sign-in link is incomplete." };
  }

  const throttle = await consumeNamedRateLimit(
    "adminLogin",
    await hashedRequestIp(),
  );
  if (!throttle.allowed) {
    return {
      error: `Too many sign-in attempts. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const result = await redeemLoginLink(token);
  if (!result.ok) {
    return {
      error:
        "That sign-in link has expired or was already used. Request a fresh one from the sign-in page.",
    };
  }

  const headerList = await headers();
  await createAdminSession({
    userId: result.userId,
    role: result.role,
    sessionEpoch: result.sessionEpoch,
    ip:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerList.get("x-real-ip") ||
      null,
    userAgent: headerList.get("user-agent"),
  });

  await recordAudit({
    action: AUDIT_ACTIONS.loginLinkUsed,
    actorId: result.userId,
    actorEmail: result.email,
  });

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentAdminUser();
  const session = await getAdminSession();

  await destroyCurrentSession();

  if (session) {
    await recordAudit({
      action: AUDIT_ACTIONS.logout,
      actorId: session.userId,
      actorEmail: user?.email ?? null,
    });
  }

  redirect("/admin/login");
}
