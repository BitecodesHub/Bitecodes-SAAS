import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ResetPasswordForm } from "@/components/admin/reset-password-form";
import { peekToken } from "@/lib/server/auth/recovery";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

/**
 * Reset landing page.
 *
 * The token is peeked, not consumed, on render: consumption happens only when
 * the new password is submitted, so refreshing this page never burns the link.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await peekToken(token, "password-reset");

  return (
    <main className="bg-mesh flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
          {valid ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                Choose a new password
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                You will be signed out everywhere once it is set.
              </p>
              <div className="mt-6">
                <ResetPasswordForm token={token} />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                This link is no longer valid
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Reset links work once and expire after an hour. Request a fresh
                one and try again.
              </p>
              <p className="mt-6 text-sm">
                <Link
                  href="/admin/forgot-password"
                  className="text-primary underline underline-offset-4"
                >
                  Request a new link
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
