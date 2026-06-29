"use client";

import { useState } from "react";
import { priceRows, unitPhrase, type CurrencyCode } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Visible multi-currency "starting from" price block for a service detail
 * page. Renders ALL three currency prices server-side (this is a client
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
      className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
      aria-label="Starting pricing"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Starting from
        </span>
        <div
          role="tablist"
          aria-label="Select currency"
          className="bg-muted/60 rounded-full p-1"
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
                  "min-h-11 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.currency}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-3xl font-bold tracking-tight">
        from {current.formatted}
        <span className="text-muted-foreground ml-2 text-sm font-normal">
          {unitPhrase(current.unit)}
        </span>
      </p>

      {/* The other two currencies stay in the DOM (SEO + citation safety). */}
      <p className="text-muted-foreground mt-1 text-sm">
        Also: {others.map((r) => `${r.formatted} ${r.currency}`).join(" · ")}{" "}
        {unitPhrase(current.unit)}
      </p>

      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        Indicative starting price for a scoped engagement. Final quotes are
        fixed after a short discovery call — no surprises.
      </p>
    </div>
  );
}
