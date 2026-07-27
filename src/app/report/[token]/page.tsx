import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleSlash,
  Minus,
} from "lucide-react";
import { verifySignedToken } from "@/lib/server/tokens";
import { getProspect } from "@/lib/server/prospecting/repository";
import { getSettings } from "@/lib/server/settings";
import {
  buildObservations,
  buildReportItems,
  reportHeadline,
} from "@/lib/prospecting/report";
import { shortUrl } from "@/lib/prospecting/display";
import { siteConfig } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * The personalised report a cold email links to.
 *
 * This page carries the whole weight of the outreach: the email's only job is to
 * earn a click on it. So it is built to be *useful whether or not they ever
 * reply* — observations they can verify themselves, plainly worded, with no
 * score-shaming and no invented figures.
 *
 * Deliberately not indexable and deliberately not guessable. The URL contains an
 * HMAC-signed, expiring token rather than a prospect id, so it cannot be
 * enumerated, and `next.config.ts` sends `X-Robots-Tag: noindex` for `/report`
 * so a forwarded link never turns into a public page about someone's business.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Website review",
  // Belt and braces alongside the header: this must never be indexed.
  robots: { index: false, follow: false, nocache: true },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params;
  const verified = verifySignedToken<{ id: string }>(token, "report");

  if (!verified.ok) {
    return (
      <ReportShell>
        <UnavailableNotice
          title={
            verified.reason === "expired"
              ? "This link has expired"
              : "This link is not valid"
          }
          detail={
            verified.reason === "expired"
              ? "Reviews are kept for ninety days. Ask us for a fresh one and we will re-run it."
              : "The link may have been copied incompletely. Ask us to send it again."
          }
        />
      </ReportShell>
    );
  }

  const prospect = await getProspect(String(verified.data.id));

  // A valid token for a deleted prospect, or one whose check never completed.
  // Showing an empty report would be worse than saying so plainly.
  if (!prospect || !prospect.classification) {
    return (
      <ReportShell>
        <UnavailableNotice
          title="This review is not ready"
          detail="We could not complete the check for this business. Get in touch and we will look at it properly."
        />
      </ReportShell>
    );
  }

  const settings = await getSettings();
  const { classification, signals } = prospect;
  const items = buildReportItems(classification.tags);
  const observations = buildObservations(signals);
  const headline = reportHeadline(prospect.name, classification.primaryTag);

  return (
    <ReportShell>
      <header className="space-y-3">
        <Badge variant="secondary">Independent website review</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {headline}
        </h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          {prospect.website ? (
            <>
              We looked at{" "}
              <span className="text-foreground font-medium">
                {shortUrl(prospect.websiteFinalUrl ?? prospect.website)}
              </span>{" "}
              the way a customer&rsquo;s browser would — one visit to the
              homepage, nothing more.
            </>
          ) : (
            <>
              We searched for {prospect.name}
              {prospect.city ? ` in ${prospect.city}` : ""} the way a customer
              would.
            </>
          )}{" "}
          No logins, no scanning, and nothing was changed. Here is what we
          found.
        </p>
      </header>

      <section aria-labelledby="findings" className="space-y-4">
        <h2 id="findings" className="text-xl font-semibold">
          What we found
        </h2>
        <ol className="space-y-4">
          {items.map((item, index) => (
            <li
              key={item.title}
              className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="bg-muted text-muted-foreground mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold"
                >
                  {index + 1}
                </span>
                <div className="space-y-2">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.why}
                  </p>
                  <p className="text-sm leading-relaxed">
                    <span className="font-medium">What it takes to fix: </span>
                    {item.fix}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {observations.length > 0 && (
        <section aria-labelledby="checks" className="space-y-4">
          <h2 id="checks" className="text-xl font-semibold">
            Everything we checked
          </h2>
          <p className="text-muted-foreground text-sm">
            Every line here is something you can confirm yourself.
          </p>
          <dl className="border-border divide-border divide-y overflow-hidden rounded-2xl border">
            {observations.map((observation) => (
              <div
                key={observation.label}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <dt className="text-sm">{observation.label}</dt>
                <dd className="flex items-center gap-2 text-sm font-medium">
                  {observation.value}
                  {observation.ok === true && (
                    <Check
                      aria-label="Fine"
                      className="size-4"
                      style={{ color: "var(--chart-3)" }}
                    />
                  )}
                  {observation.ok === false && (
                    <AlertTriangle
                      aria-label="Worth attention"
                      className="text-destructive size-4"
                    />
                  )}
                  {observation.ok === null && (
                    <Minus
                      aria-hidden="true"
                      className="text-muted-foreground size-4"
                    />
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="border-border bg-card space-y-4 rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-xl font-semibold">
          Want this sorted without the jargon?
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We are {siteConfig.name}, a software studio
          {siteConfig.contact.address.city
            ? ` in ${siteConfig.contact.address.city}`
            : ""}
          . Reply to the email or use the form and we will tell you what we
          would do first, what it would cost, and how long it would take — with
          no obligation. If the honest answer is &ldquo;you do not need
          us&rdquo;, we will say that instead.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/contact">
              Talk to us
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/website-audit">Run your own free check</Link>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Prefer email? {settings.contact.salesEmail}
        </p>
      </section>

      <footer className="text-muted-foreground space-y-2 text-xs leading-relaxed">
        <p>
          This review is a passive look at one public page and its response
          headers, carried out on{" "}
          {(prospect.enrichedAt ?? prospect.updatedAt).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "long", year: "numeric" },
          )}
          . It is a starting point for a conversation, not a formal audit, and
          websites change.
        </p>
        <p>
          Business details came from OpenStreetMap. If you would rather we did
          not hold your details,{" "}
          <Link
            href="/contact"
            className="text-primary underline underline-offset-2"
          >
            tell us
          </Link>{" "}
          and we will remove them.
        </p>
      </footer>
    </ReportShell>
  );
}

function ReportShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
      <div className="space-y-10">
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

function UnavailableNotice({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="space-y-4 py-8">
      <CircleSlash
        aria-hidden="true"
        className="text-muted-foreground size-8"
      />
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground leading-relaxed">{detail}</p>
      <Button asChild variant="secondary">
        <Link href="/contact">Get in touch</Link>
      </Button>
    </div>
  );
}
