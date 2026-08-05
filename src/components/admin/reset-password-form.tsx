"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/lib/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

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
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          autoFocus
        />
        <p className="text-muted-foreground text-xs">At least 10 characters.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Repeat new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}

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
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}
