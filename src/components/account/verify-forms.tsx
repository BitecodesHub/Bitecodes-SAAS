"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import {
  completeVerificationAction,
  resendVerificationAction,
  type ResendState,
  type VerifyState,
} from "@/lib/server/auth/signup-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The one-button confirm on the landing page a verification link opens. */
export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, action] = useActionState<VerifyState, FormData>(
    completeVerificationAction,
    undefined,
  );

  // A spent link is replaced by the form that helps, rather than by a button
  // that would fail the same way again. Rendered as a sibling and never nested:
  // a `<form>` inside a `<form>` is invalid, and browsers resolve it by dropping
  // the inner one, so the resend would silently submit nothing.
  if (state?.error) {
    return (
      <div className="space-y-5">
        <ErrorPanel message={state.error} />
        <ResendVerificationForm />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <SubmitButton idle="Confirm my email" busy="Confirming…" />
    </form>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-xl border p-3.5 text-sm"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

/** Asks for a fresh link. Answers the same way whatever the address. */
export function ResendVerificationForm({
  defaultEmail = "",
}: {
  defaultEmail?: string;
}) {
  const [state, action] = useActionState<ResendState, FormData>(
    resendVerificationAction,
    undefined,
  );

  if (state && "sent" in state) {
    return (
      <div
        role="status"
        className="border-border bg-muted/40 flex items-start gap-3 rounded-2xl border p-4"
      >
        <MailCheck aria-hidden="true" className="text-primary mt-0.5 size-5" />
        <p className="text-sm leading-relaxed">
          If that address has an account waiting to be confirmed, a fresh link
          is on its way. It expires in 48 hours.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && <ErrorPanel message={state.error} />}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={defaultEmail}
        />
      </div>

      <SubmitButton idle="Send me a new link" busy="Sending…" />
    </form>
  );
}

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
      {pending ? busy : idle}
    </Button>
  );
}
