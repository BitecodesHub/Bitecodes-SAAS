import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/reset-password-form";
import { peekToken } from "@/lib/server/auth/recovery";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Reset landing page for customer accounts.
 *
 * The token is peeked, not consumed, on render: consumption happens only when
 * the new password is submitted, so refreshing this page never burns the link.
 * `resetPasswordAction` reads the account's role and returns the person to the
 * sign-in page that belongs to them.
 */
export default async function CustomerResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await peekToken(token, "password-reset");

  return (
    <div className="bg-surface-2 rounded-[28px] p-7 sm:p-8">
      {valid ? (
        <>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
            Choose a new password
          </h1>
          <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
            You will be signed out everywhere once it is set.
          </p>
          <div className="mt-6">
            <ResetPasswordForm token={token} />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
            This link is no longer valid
          </h1>
          <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
            Reset links work once and expire after an hour. Request a fresh one
            and try again.
          </p>
          <p className="mt-6 text-[15px]">
            <Link
              href="/forgot"
              className="text-primary underline underline-offset-4"
            >
              Request a new link
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
