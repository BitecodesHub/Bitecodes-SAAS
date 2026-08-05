import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { RecoveryForm } from "@/components/admin/recovery-form";

export const metadata: Metadata = {
  title: "Account recovery",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="bg-mesh flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
          <h1 className="text-xl font-semibold tracking-tight">
            Get back into your account
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            Enter your email and choose how you want to sign in.
          </p>

          <div className="mt-6">
            <RecoveryForm />
          </div>

          <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
            <Link
              href="/admin/login"
              className="hover:text-foreground underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
