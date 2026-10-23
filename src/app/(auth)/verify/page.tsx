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
    <div className="bg-surface-2 rounded-[28px] p-7 sm:p-8">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
        Send the link again
      </h1>
      <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
        Enter the address you signed up with and we will send a fresh
        confirmation link.
      </p>

      <div className="mt-6">
        {/* Prefilled only from the sign-in form's own hand-off, and treated as
            display text: it is echoed into a value, never into markup. */}
        <ResendVerificationForm defaultEmail={(email ?? "").slice(0, 254)} />
      </div>

      <p className="text-muted-foreground mt-6 text-center text-[14px]">
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
