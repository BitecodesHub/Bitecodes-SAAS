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
    <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
      {valid ? (
        <>
          <div className="flex items-start gap-3">
            <MailCheck
              aria-hidden="true"
              className="text-primary mt-0.5 size-5 shrink-0"
            />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Confirm your email
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
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
          <h1 className="text-xl font-semibold tracking-tight">
            This link is no longer valid
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
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
