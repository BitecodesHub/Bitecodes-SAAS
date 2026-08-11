"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import {
  requestRecoveryAction,
  type RecoveryRequestState,
} from "@/lib/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One form, two outcomes: a password-reset email or a one-click sign-in
 * email. Two submit buttons set the `mode` field rather than two pages,
 * because the input — "which address?" — is identical for both.
 */
export function RecoveryForm() {
  const [state, action] = useActionState<RecoveryRequestState, FormData>(
    requestRecoveryAction,
    undefined,
  );

  if (state?.sent) {
    return (
      <div
        role="status"
        className="border-border bg-muted/40 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm"
      >
        <MailCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p className="leading-relaxed">
          If <span className="font-medium">{state.email}</span> has an account,{" "}
          {state.mode === "reset" ? "a reset link" : "a sign-in link"} is on its
          way. Check your inbox — the link{" "}
          {state.mode === "reset"
            ? "works once and expires in an hour."
            : "works once and expires in 15 minutes."}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.error && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-xl border p-3.5 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">{state.error}</p>
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
          defaultValue={state?.email ?? ""}
          autoFocus
        />
      </div>

      <RecoveryButtons />
    </form>
  );
}

/** Inside its own component so `useFormStatus` sees the surrounding form. */
function RecoveryButtons() {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <Button
        type="submit"
        name="mode"
        value="link"
        className="w-full"
        disabled={pending}
      >
        {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
        Email me a one-click sign-in link
      </Button>
      <Button
        type="submit"
        name="mode"
        value="reset"
        variant="outline"
        className="w-full"
        disabled={pending}
      >
        Email me a password-reset link
      </Button>
    </div>
  );
}
