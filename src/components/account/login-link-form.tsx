"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  completeLoginLinkAction,
  type LoginLinkState,
} from "@/lib/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The "Complete sign-in" button on the magic-link landing page.
 *
 * A deliberate extra click: the single-use token is consumed by this POST,
 * never by the GET that rendered the page, so inbox link-scanners that
 * prefetch URLs cannot burn the link before its owner uses it.
 */
export function LoginLinkForm({
  token,
  requiresTwoFactor = false,
}: {
  token: string;
  /** The account has TOTP enabled, so a code must accompany the link. */
  requiresTwoFactor?: boolean;
}) {
  const [state, action] = useActionState<LoginLinkState, FormData>(
    completeLoginLinkAction,
    undefined,
  );
  const showCode = requiresTwoFactor || state?.needsTwoFactor;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      {showCode && (
        <div className="space-y-1.5">
          <Label htmlFor="link-totp">Authentication code</Label>
          <Input
            id="link-totp"
            name="totpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            autoFocus
            required
            placeholder="123456"
            className="bg-background"
          />
          <p className="text-muted-foreground text-[13px] leading-[1.5]">
            Enter the six-digit code from your authenticator app.
          </p>
        </div>
      )}

      {state?.error && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2.5 rounded-xl border p-3.5 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">{state.error}</p>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
      {pending ? "Signing in…" : "Complete sign-in"}
    </Button>
  );
}
