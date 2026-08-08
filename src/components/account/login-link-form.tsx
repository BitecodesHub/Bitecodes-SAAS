"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  completeLoginLinkAction,
  type LoginLinkState,
} from "@/lib/server/auth/actions";
import { Button } from "@/components/ui/button";

/**
 * The "Complete sign-in" button on the magic-link landing page.
 *
 * A deliberate extra click: the single-use token is consumed by this POST,
 * never by the GET that rendered the page, so inbox link-scanners that
 * prefetch URLs cannot burn the link before its owner uses it.
 */
export function LoginLinkForm({ token }: { token: string }) {
  const [state, action] = useActionState<LoginLinkState, FormData>(
    completeLoginLinkAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-5">
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
      {pending ? "Signing in…" : "Complete sign-in"}
    </Button>
  );
}
