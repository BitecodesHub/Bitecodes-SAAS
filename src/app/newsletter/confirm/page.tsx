import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Newsletter confirmation",
  robots: { index: false, follow: false },
};

/**
 * /newsletter/confirm — shown after the subscriber clicks their confirmation
 * link.
 *
 * `status` is set by GET /api/newsletter/confirm:
 *  - `ok`      — confirmed (or was already confirmed)
 *  - `invalid` — bad/expired token
 */
export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const isOk = status === "ok";

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center">
      {isOk ? (
        <>
          <CheckCircle
            className="mb-5 size-12 text-green-500"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            You&rsquo;re subscribed!
          </h1>
          <p className="text-muted-foreground mt-3 max-w-sm leading-relaxed">
            Your email address has been confirmed. We&rsquo;ll send you our
            weekly newsletter every Thursday.
          </p>
        </>
      ) : (
        <>
          <XCircle className="mb-5 size-12 text-red-500" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Confirmation link invalid
          </h1>
          <p className="text-muted-foreground mt-3 max-w-sm leading-relaxed">
            This link has expired or is not valid. Please sign up again to
            receive a new confirmation email.
          </p>
        </>
      )}

      <Link
        href="/blog"
        className="text-primary mt-8 inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 text-sm font-medium hover:underline"
      >
        Back to the blog
      </Link>
    </main>
  );
}
