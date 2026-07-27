import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { applyUnsubscribe } from "@/lib/server/email/unsubscribe";
import { siteConfig } from "@/lib/site";
import { Button } from "@/components/ui/button";

/**
 * One-click unsubscribe.
 *
 * Three deliberate choices, all of them compliance decisions rather than design
 * preferences:
 *
 * 1. **It acts on load — no confirmation button.** RFC 8058 one-click
 *    unsubscribe and the `List-Unsubscribe-Post` header both require that a
 *    single interaction completes the opt-out. A "are you sure?" step would
 *    break that and is the oldest dark pattern in email.
 * 2. **It never asks who you are.** The token carries the address. Asking a
 *    recipient to type their email to stop receiving email is hostile.
 * 3. **It suppresses even when the token has expired**, provided the signature
 *    is valid. Unsubscribe tokens are minted without expiry precisely so this
 *    cannot happen, but if one ever did expire, honouring the intent matters far
 *    more than honouring the clock.
 *
 * Suppression is by address, so it also covers any other prospect record sharing
 * that address.
 *
 * **Known trade-off: link prefetching.** Some mail clients and security scanners
 * issue a GET on links before a human sees them, which can unsubscribe someone
 * who never clicked. Requiring a confirmation click would prevent that, but it
 * would also break RFC 8058 one-click and add friction to an opt-out, which is
 * the wrong place to add friction. Acting immediately is the deliberate choice
 * because its failure mode favours the recipient: the worst case is that we stop
 * emailing someone who did not ask us to, which they can correct by contacting
 * us, rather than continuing to email someone who did.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false, nocache: true },
};

interface PageProps {
  searchParams: Promise<{ t?: string | string[] }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.t) ? params.t[0] : params.t;

  // Same shared action the one-click POST endpoint uses, so a person and a
  // mailbox provider can never end up with different outcomes.
  const outcome = await applyUnsubscribe(raw);

  if (!outcome.ok) {
    const message =
      outcome.reason === "storage-failed"
        ? "We could not record your request just now, and we would rather tell you than pretend otherwise."
        : "It may have been copied incompletely.";

    return (
      <Shell>
        <CircleSlash
          aria-hidden="true"
          className={
            outcome.reason === "storage-failed"
              ? "text-destructive size-8"
              : "text-muted-foreground size-8"
          }
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          {outcome.reason === "storage-failed"
            ? "Something went wrong"
            : "This link is not valid"}
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {message} Email{" "}
          <a
            href={`mailto:${siteConfig.contact.email}`}
            className="text-primary underline underline-offset-2"
          >
            {siteConfig.contact.email}
          </a>{" "}
          and a person will remove you today — you do not need a working link to
          be taken off our list.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <CheckCircle2
        aria-hidden="true"
        className="size-8"
        style={{ color: "var(--chart-3)" }}
      />
      <h1 className="text-2xl font-semibold tracking-tight">
        You are unsubscribed
      </h1>
      <p className="text-muted-foreground leading-relaxed">
        <span className="text-foreground font-medium">{outcome.email}</span>{" "}
        will not receive anything further from us. No confirmation step, and
        nothing else to do.
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">
        We have also removed the business record this was linked to. If you
        would like the rest of your details deleted as well, email{" "}
        <a
          href={`mailto:${siteConfig.contact.email}`}
          className="text-primary underline underline-offset-2"
        >
          {siteConfig.contact.email}
        </a>{" "}
        and we will do it.
      </p>
      <Button asChild variant="secondary">
        <Link href="/">Go to {siteConfig.name}</Link>
      </Button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-16 sm:px-6 sm:py-24">
      <div className="space-y-4">
        <Link
          href="/"
          className="text-primary text-sm font-semibold tracking-wide"
        >
          {siteConfig.name.toUpperCase()}
        </Link>
        {children}
      </div>
    </main>
  );
}
