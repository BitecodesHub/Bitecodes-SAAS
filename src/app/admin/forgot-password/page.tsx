import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { RecoveryForm } from "@/components/account/recovery-form";

export const metadata: Metadata = {
  title: "Account recovery",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="bg-surface-2 rounded-[28px] p-7 sm:p-8">
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">
            Get back into your account
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
            Enter your email and choose how you want to sign in.
          </p>

          <div className="mt-6">
            <RecoveryForm />
          </div>

          <p className="text-muted-foreground mt-6 text-center text-[13px] leading-[1.6]">
            <Link
              href="/admin/login"
              className="text-primary underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
