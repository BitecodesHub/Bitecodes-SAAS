import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Search,
  Network,
} from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import { seoAudits } from "@/lib/server/db/collections";
import {
  getBingSiteVerification,
  getGoogleSiteVerification,
  getIndexNowKey,
  getSiteUrl,
} from "@/lib/server/env";
import { siteConfig } from "@/lib/site";
import sitemap from "@/app/sitemap";

export const metadata: Metadata = { title: "SEO" };
export const dynamic = "force-dynamic";

/**
 * Search visibility and technical setup.
 *
 * The self-audit runs weekly and stores one document per date, so this page
 * reads the latest rather than auditing on request: a page render must never
 * wait on eight outbound requests. The checklist below reports only what the
 * deployment can actually know — an environment token being present, and how
 * many URLs the sitemap currently generates.
 */
export default async function AdminSeoPage() {
  await requireCapability("view");

  const [latest, sitemapCount] = await Promise.all([
    seoAudits().then((collection) =>
      collection.findOne({}, { sort: { date: -1 } }),
    ),
    sitemap()
      .then((urls) => urls.length)
      .catch(() => null),
  ]);

  const google = getGoogleSiteVerification();
  const bing = getBingSiteVerification();
  const indexNow = getIndexNowKey();
  const origin = getSiteUrl();

  const checklist = [
    {
      label: "Google Search Console verification",
      ok: Boolean(google),
      detail: google
        ? "GOOGLE_SITE_VERIFICATION is set and emitted in the site head."
        : "Set GOOGLE_SITE_VERIFICATION to the token from Search Console.",
      href: "https://search.google.com/search-console",
    },
    {
      label: "Bing Webmaster Tools verification",
      ok: Boolean(bing),
      detail: bing
        ? "BING_SITE_VERIFICATION is set and emitted in the site head."
        : "Set BING_SITE_VERIFICATION to the token from Bing Webmaster Tools.",
      href: "https://www.bing.com/webmasters",
    },
    {
      label: "IndexNow submissions",
      ok: Boolean(indexNow),
      detail: indexNow
        ? "INDEXNOW_KEY is set; the daily search.ping job can submit changed URLs."
        : "Set INDEXNOW_KEY to enable the daily search.ping job.",
      href: "https://www.indexnow.org/",
    },
    {
      label: "Sitemap",
      ok: sitemapCount !== null && sitemapCount > 0,
      detail:
        sitemapCount === null
          ? "The sitemap could not be generated while rendering this page."
          : `${sitemapCount} URLs currently generated at ${siteConfig.url}/sitemap.xml.`,
      href: `${siteConfig.url}/sitemap.xml`,
    },
    {
      label: "Machine-readable summary",
      ok: true,
      detail: "llms.txt and llms-full.txt are generated from site data.",
      href: `${siteConfig.url}/llms.txt`,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">SEO</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Technical visibility for {origin}. The weekly self-audit checks the
          key public pages against the same auditor the public tool uses and
          records any score drop or new issue.
        </p>
      </header>

      <section
        className="bg-card rounded-lg border p-5"
        aria-labelledby="self-audit-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="self-audit-heading" className="font-semibold">
            Latest self-audit
          </h2>
          {latest && (
            <span className="text-muted-foreground text-sm tabular-nums">
              {latest.date}
            </span>
          )}
        </div>

        {!latest ? (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            No self-audit has run yet. The job runs every Sunday at 02:00 UTC;
            it can also be queued from{" "}
            <Link
              href="/admin/jobs"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Jobs
            </Link>
            .
          </p>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Overall score", latest.overallScore ?? "—"],
                ["Pages audited", latest.pages.length],
                ["Regressions", latest.regressions.length],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-border rounded-lg border p-3"
                >
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {latest.regressions.length > 0 && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300"
              >
                <p className="font-medium">
                  Regressions since the previous run
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {latest.regressions.map((regression) => (
                    <li key={regression}>{regression}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-left text-xs">
                    <th className="py-2 pr-4 font-medium">Page</th>
                    <th className="py-2 pr-4 font-medium">Score</th>
                    <th className="py-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.pages.map((page) => (
                    <tr
                      key={page.path}
                      className="border-border/60 border-b align-top last:border-0"
                    >
                      <td className="py-2 pr-4 font-mono text-xs">
                        {page.path}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {page.score ?? "failed"}
                      </td>
                      <td className="text-muted-foreground py-2 text-xs">
                        {page.issues.length > 0
                          ? page.issues.join("; ")
                          : "None"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section
        className="bg-card rounded-lg border p-5"
        aria-labelledby="setup-heading"
      >
        <h2 id="setup-heading" className="font-semibold">
          External setup
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          What this deployment can verify from its own configuration.
          Verification tokens are checked as present, not tested against the
          search engine.
        </p>
        <ul className="mt-4 divide-y">
          {checklist.map((item) => (
            <li
              key={item.label}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                {item.ok ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-emerald-600"
                  />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                  />
                )}
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-4"
              >
                Open <ArrowUpRight aria-hidden="true" className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <a
          href="https://search.google.com/search-console"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card hover:border-primary/40 flex items-center justify-between rounded-lg border p-5 transition-colors"
        >
          <span className="flex items-center gap-3">
            <Search aria-hidden="true" className="size-5" />
            <span>
              <span className="block text-sm font-medium">
                Google Search Console
              </span>
              <span className="text-muted-foreground block text-xs">
                Coverage, queries, and Core Web Vitals
              </span>
            </span>
          </span>
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
        <a
          href="https://www.bing.com/webmasters"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card hover:border-primary/40 flex items-center justify-between rounded-lg border p-5 transition-colors"
        >
          <span className="flex items-center gap-3">
            <Network aria-hidden="true" className="size-5" />
            <span>
              <span className="block text-sm font-medium">
                Bing Webmaster Tools
              </span>
              <span className="text-muted-foreground block text-xs">
                IndexNow submissions and crawl health
              </span>
            </span>
          </span>
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </section>
    </div>
  );
}
