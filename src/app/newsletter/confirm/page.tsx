import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

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
    <main className="bg-surface-2 flex min-h-screen items-center justify-center px-5 py-16 sm:px-6 sm:py-24">
      <div className="bg-background flex w-full max-w-xl flex-col items-start gap-4 rounded-[28px] p-7 sm:p-9">
        <Link
          href="/"
          className="text-primary inline-flex min-h-11 items-center text-[13px] font-semibold tracking-[0.08em] uppercase"
        >
          {siteConfig.name}
        </Link>
        {isOk ? (
          <>
            <CheckCircle
              className="size-8"
              style={{ color: "var(--chart-3)" }}
              aria-hidden="true"
            />
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
              You&rsquo;re subscribed
            </h1>
            <p className="text-muted-foreground text-[15px] leading-[1.6]">
              Your email address has been confirmed. We&rsquo;ll send you our
              weekly newsletter every Thursday.
            </p>
          </>
        ) : (
          <>
            <XCircle className="text-destructive size-8" aria-hidden="true" />
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
              Confirmation link invalid
            </h1>
            <p className="text-muted-foreground text-[15px] leading-[1.6]">
              This link has expired or is not valid. Please sign up again to
              receive a new confirmation email.
            </p>
          </>
        )}

        <Button asChild variant="secondary" className="bg-surface-2 mt-2">
          <Link href="/blog">Back to the blog</Link>
        </Button>
      </div>
    </main>
  );
}
