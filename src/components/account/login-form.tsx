"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The sign-in form, for staff and for customers alike.
 *
 * One form rather than two because there is one credential check behind it:
 * `loginAction` reads the account's role and sends it to the right area, so a
 * customer who arrives at the staff sign-in page still lands on their own
 * dashboard. Two forms would mean two places to get the lockout messaging, the
 * two-factor step, and the uniform failure wording right.
 *
 * A plain `<form action={…}>` bound to a Server Action, so it submits and shows
 * errors with JavaScript disabled. `useActionState` adds the returned error and
 * the two-factor step on top of that baseline rather than replacing it.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {state?.error && (
        // `role="alert"` so the failure is announced, not just drawn.
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-xl border p-3.5 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="leading-relaxed">
            <p>{state.error}</p>
            {state.needsVerification && (
              // The one failure with a next step the person can take here and
              // now, so it is offered rather than described.
              <Link
                href={`/verify?email=${encodeURIComponent(state.email ?? "")}`}
                className="mt-1.5 inline-block font-medium underline underline-offset-4"
              >
                Send the link again
              </Link>
            )}
          </div>
        </div>
      )}

      {state?.needsTwoFactor && (
        <div
          role="status"
          className="border-border bg-muted/40 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm"
        >
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">
            Enter the six-digit code from your authenticator app.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          // Preserved across a failed attempt, so only the password is retyped.
          defaultValue={state?.email ?? ""}
          // Focus lands here on first load, but must not steal focus from the
          // code field once the form has advanced to the second factor.
          autoFocus={!state?.needsTwoFactor}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.needsTwoFactor && (
        <div className="space-y-2">
          <Label htmlFor="totpCode">Authentication code</Label>
          <Input
            id="totpCode"
            name="totpCode"
            // `text` with a numeric inputMode: `type="number"` shows spinners
            // and strips leading zeros, and a TOTP code can start with one.
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            className="font-mono tracking-[0.3em]"
          />
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

/**
 * Split out because `useFormStatus` only reports the pending state of the form
 * it is rendered inside — calling it in the parent would always return false.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="gradient"
      className="w-full"
      disabled={pending}
    >
      {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}
