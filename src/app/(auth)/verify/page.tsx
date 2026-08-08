import type { Metadata } from "next";
import Link from "next/link";
import { ResendVerificationForm } from "@/components/account/verify-forms";

export const metadata: Metadata = {
  title: "Resend your confirmation link",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
      <h1 className="text-xl font-semibold tracking-tight">
        Send the link again
      </h1>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
        Enter the address you signed up with and we will send a fresh
        confirmation link.
      </p>

      <div className="mt-6">
        {/* Prefilled only from the sign-in form's own hand-off, and treated as
            display text: it is echoed into a value, never into markup. */}
        <ResendVerificationForm defaultEmail={(email ?? "").slice(0, 254)} />
      </div>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already confirmed?{" "}
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
