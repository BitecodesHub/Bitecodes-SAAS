"use client";

import { useState } from "react";
import { priceRows, unitPhrase, type CurrencyCode } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Visible multi-currency "starting from" price block for a service detail
 * page. Renders ALL currency prices server-side (this is a client
 * component but the initial markup includes every price, so SSR HTML contains
 * them — required for Google price rich results and AI-engine citation). The
 * switcher toggles which price is visually emphasized via state + classes; it
 * NEVER removes a price from the DOM or swaps text content.
 */
export function ServicePricing({ slug }: { slug: string }) {
  const rows = priceRows(slug);
  const [active, setActive] = useState<CurrencyCode>("USD");

  if (!rows || rows.length === 0) return null;

  const current = rows.find((r) => r.currency === active) ?? rows[0];
  const others = rows.filter((r) => r.currency !== active);

  return (
    <div
      className="bg-surface-2 rounded-[24px] p-6"
      aria-label="Starting pricing"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted-foreground text-[13px] font-medium tracking-[0.06em] uppercase">
          Starting from
        </span>
        <div
          role="tablist"
          aria-label="Select currency"
          className="bg-background flex rounded-full p-1 shadow-[var(--shadow-soft)]"
        >
          {rows.map((r) => {
            const isActive = r.currency === active;
            return (
              <button
                key={r.currency}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActive(r.currency)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.currency}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-5 text-[36px] leading-none font-semibold tracking-[-0.035em]">
        {current.formatted}
        <span className="text-muted-foreground ml-2 text-[13px] font-normal tracking-normal">
          {unitPhrase(current.unit)}
        </span>
      </p>

      {/* The other two currencies stay in the DOM (SEO + citation safety). */}
      <p className="text-muted-foreground mt-2 text-[13px]">
        Also: {others.map((r) => `${r.formatted} ${r.currency}`).join(" · ")}{" "}
        {unitPhrase(current.unit)}
      </p>

      <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
        Indicative starting price for a scoped engagement. Final quotes are
        fixed after a short discovery call — no surprises.
      </p>
    </div>
  );
}
