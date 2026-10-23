import type { Metadata } from "next";
import Link from "next/link";
import { RecoveryForm } from "@/components/account/recovery-form";

export const metadata: Metadata = {
  title: "Get back into your account",
  description:
    "Request a sign-in link or reset your Bitecodes account password.",
  robots: { index: false, follow: false },
};

export default function ForgotPage() {
  return (
    <div className="bg-surface-2 rounded-[28px] p-7 sm:p-8">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
        Get back into your account
      </h1>
      <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
        Enter your email and choose how you want to sign in.
      </p>

      <div className="mt-6">
        <RecoveryForm />
      </div>

      <p className="text-muted-foreground mt-6 text-center text-[13px] leading-relaxed">
        <Link
          href="/login"
          className="hover:text-foreground underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
