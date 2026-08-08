import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { SignupForm } from "@/components/account/signup-form";
import { createMetadata } from "@/lib/seo";
import { SIGNUP_BONUS } from "@/lib/server/auth/signup";
import { GoogleButton } from "@/components/account/google-button";
import { isGoogleSignInConfigured } from "@/lib/server/auth/google-oauth";

export const metadata: Metadata = createMetadata({
  title: "Create your account",
  description:
    "Sign up for Bitecodes and get free credits on every product: an AI chatbot, embeddable forms, a booking calendar, and transactional email. No card required, and credits never expire.",
  path: "/signup",
});

/**
 * The free allowance, described in the units a person recognises.
 *
 * Read from `SIGNUP_BONUS` rather than retyped, so the page cannot promise
 * something different from what verification actually grants.
 */
const INCLUDED: { product: string; body: string }[] = [
  {
    product: `${SIGNUP_BONUS.chatbot} chatbot replies`,
    body: "Train it on your own pages and embed it with one line.",
  },
  {
    product: `${SIGNUP_BONUS.forms} form submissions`,
    body: "Build a form, paste it anywhere, and read the answers here.",
  },
  {
    product: `${SIGNUP_BONUS.bookings} bookings`,
    body: "Publish your hours and let people pick a time.",
  },
  {
    product: `${SIGNUP_BONUS.email} emails`,
    body: "Send transactional mail from your own app over our API.",
  },
];

export default function SignupPage() {
  return (
    <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
      <h1 className="text-xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
        Free credits on every product, no card, and nothing expires. Takes about
        a minute.
      </p>

      <ul className="border-border bg-muted/30 mt-5 space-y-2.5 rounded-2xl border p-4">
        {INCLUDED.map((item) => (
          <li key={item.product} className="flex items-start gap-2.5 text-sm">
            <Check
              aria-hidden="true"
              className="text-primary mt-0.5 size-4 shrink-0"
            />
            <span>
              <span className="font-medium">{item.product}</span>{" "}
              <span className="text-muted-foreground">{item.body}</span>
            </span>
          </li>
        ))}
      </ul>

      {isGoogleSignInConfigured() && (
        <div className="mt-6 space-y-4">
          <GoogleButton label="Sign up with Google" />
          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">
              or with your email
            </span>
            <span className="bg-border h-px flex-1" />
          </div>
        </div>
      )}

      <div className="mt-6">
        <SignupForm />
      </div>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground hover:text-primary font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
