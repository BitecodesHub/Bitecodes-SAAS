"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import {
  signupAction,
  type SignupState,
} from "@/lib/server/auth/signup-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Self-serve sign-up.
 *
 * A plain `<form action={…}>` bound to a Server Action, so it works without
 * JavaScript; `useActionState` layers the error and the success panel on top of
 * that baseline rather than replacing it.
 *
 * The success panel says "check your inbox" whether or not an account was
 * created, because the action cannot tell us which happened — see the note in
 * `signup.ts`. Wording it as "we have sent you a link" rather than "your account
 * is ready" keeps it true in both cases.
 */
export function SignupForm() {
  const [state, action] = useActionState<SignupState, FormData>(
    signupAction,
    undefined,
  );

  if (state?.sent) {
    return (
      <div role="status" className="space-y-4">
        <div className="border-border bg-muted/40 flex items-start gap-3 rounded-2xl border p-4">
          <MailCheck
            aria-hidden="true"
            className="text-primary mt-0.5 size-5"
          />
          <div>
            <p className="font-medium">Check your inbox</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              We have sent a confirmation link to{" "}
              <span className="text-foreground font-medium">{state.email}</span>
              . Open it and your account is ready, with free credits already on
              it.
            </p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The link expires in 48 hours. If it does not arrive within a few
          minutes, check your spam folder, or{" "}
          <Link
            href="/verify"
            className="hover:text-foreground underline underline-offset-4"
          >
            send it again
          </Link>
          .
        </p>
      </div>
    );
  }

  const values = state?.values;

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
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          defaultValue={values?.name ?? ""}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={values?.email ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">
          Company{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="company"
          name="company"
          autoComplete="organization"
          defaultValue={values?.company ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby="password-rules"
        />
        <p id="password-rules" className="text-muted-foreground text-xs">
          At least 12 characters, with an uppercase letter, a lowercase letter,
          a number, and a symbol.
        </p>
      </div>

      {/*
        Honeypot. Hidden from sight and from assistive technology, and skipped in
        the tab order, so no person will ever fill it in — which is what makes a
        filled-in value a reliable signal rather than a guess.
      */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="terms"
          value="yes"
          required
          className="border-input accent-primary mt-0.5 size-4 shrink-0 rounded"
        />
        <span className="text-muted-foreground leading-relaxed">
          I accept the{" "}
          <Link
            href="/terms"
            className="hover:text-foreground underline underline-offset-4"
          >
            terms
          </Link>{" "}
          and the{" "}
          <Link
            href="/privacy"
            className="hover:text-foreground underline underline-offset-4"
          >
            privacy policy
          </Link>
          .
        </span>
      </label>

      <SubmitButton />
    </form>
  );
}

/**
 * Split out because `useFormStatus` reports only the pending state of the form
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
      {pending ? "Creating your account…" : "Create my account"}
    </Button>
  );
}
