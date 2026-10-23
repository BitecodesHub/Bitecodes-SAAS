import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { SignupForm } from "@/components/account/signup-form";
import { createMetadata } from "@/lib/seo";
import {
  SIGNUP_BONUS,
  TOKENS_PER_CHATBOT_ANSWER,
} from "@/lib/server/auth/signup";
import { GoogleButton } from "@/components/account/google-button";
import { isGoogleSignInConfigured } from "@/lib/server/auth/google-oauth";

export const metadata: Metadata = createMetadata({
  title: "Create your account",
  description:
    "Sign up free — credits on every product: AI chatbot, forms, booking calendar, and transactional email. No card required, and credits never expire.",
  path: "/signup",
});

/**
 * The free allowance, described in the units a person recognises.
 *
 * Read from `SIGNUP_BONUS` rather than retyped, so the page cannot promise
 * something different from what verification actually grants. Chat is the one
 * entry that needs converting back: the wallet holds tokens, not replies, so
 * the number shown here is derived through the same `TOKENS_PER_CHATBOT_ANSWER`
 * the bonus itself was built from, rather than printing the raw token count.
 */
const INCLUDED: { product: string; body: string }[] = [
  {
    product: `${SIGNUP_BONUS.chatbot / TOKENS_PER_CHATBOT_ANSWER} chatbot replies`,
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

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawReferral = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const defaultReferralCode =
    typeof rawReferral === "string"
      ? rawReferral.trim().toUpperCase().slice(0, 32)
      : undefined;

  return (
    <div className="bg-surface-2 rounded-[28px] p-7 sm:p-8">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
        Create your account
      </h1>
      <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
        Free credits on every product, no card, and nothing expires. Takes about
        a minute.
      </p>

      <ul className="bg-background mt-5 space-y-2.5 rounded-[20px] p-4">
        {INCLUDED.map((item) => (
          <li
            key={item.product}
            className="flex items-start gap-2.5 text-[14px] leading-[1.55]"
          >
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

      <div className="mt-6">
        <SignupForm defaultReferralCode={defaultReferralCode} />
      </div>

      {/* Below the form, for the same reason as on the sign-in page. */}
      {isGoogleSignInConfigured() && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <span className="bg-border h-px flex-1" />
          </div>
          <GoogleButton label="Sign up with Google" />
        </div>
      )}

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
