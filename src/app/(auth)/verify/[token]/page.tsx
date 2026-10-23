import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { ConfirmEmailForm } from "@/components/account/verify-forms";
import { peekToken } from "@/lib/server/auth/recovery";
import { ResendVerificationForm } from "@/components/account/verify-forms";

/**
 * The page a verification link opens.
 *
 * `noindex` and dynamic: the URL carries a credential, so it must never be
 * cached, shared through a search engine, or served from a static shell.
 */
export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VerifyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Peeked, never consumed: spending the token here would burn it on the
  // link-scanner that fetched the URL before the recipient clicked.
  const valid = await peekToken(token, "verify-email");

  return (
    <div className="bg-surface-2 rounded-[28px] p-7 sm:p-8">
      {valid ? (
        <>
          <div className="flex items-start gap-3">
            <MailCheck
              aria-hidden="true"
              className="text-primary mt-0.5 size-5 shrink-0"
            />
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
                Confirm your email
              </h1>
              <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
                One click and your account is live, with free credits on every
                product.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <ConfirmEmailForm token={token} />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
            This link is no longer valid
          </h1>
          <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
            Confirmation links work once and expire after 48 hours. If your
            account is already confirmed, just sign in. Otherwise, enter your
            address and we will send a fresh link.
          </p>
          <div className="mt-6">
            <ResendVerificationForm />
          </div>
        </>
      )}
    </div>
  );
}
