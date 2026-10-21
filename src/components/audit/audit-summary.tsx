"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import {
  buildFallbackAuditSummary,
  type AuditSummaryInput,
} from "@/lib/audit-summary";

interface SummaryResponse {
  ok: boolean;
  summary: string;
  source: "ai" | "fallback";
}

/**
 * The plain-language summary shown under an audit result.
 *
 * The fallback is rendered on the first paint, computed from the findings the
 * visitor can already see, so the panel is never empty and never waits on a
 * model. When the summary endpoint answers with an AI-written version it
 * replaces the text; any failure leaves the deterministic version in place.
 */
export function AuditSummary({ input }: { input: AuditSummaryInput }) {
  const fallback = React.useMemo(
    () => buildFallbackAuditSummary(input),
    [input],
  );
  const requestKey = JSON.stringify(input);
  // Keyed by the exact request, so a second audit never displays the first
  // report while the new summary is in flight. Deriving this during render
  // avoids a reset effect that would render twice for every new audit.
  const [written, setWritten] = React.useState<{
    key: string;
    summary: string;
    source: "fallback" | "ai";
  } | null>(null);
  const summary = written?.key === requestKey ? written.summary : fallback;
  const source =
    written?.key === requestKey ? written.source : ("fallback" as const);

  React.useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/website-audit/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as SummaryResponse;
        if (payload.ok && payload.summary) {
          setWritten({
            key: requestKey,
            summary: payload.summary,
            source: payload.source,
          });
        }
      } catch {
        // The fallback is already on screen. A network failure here is not
        // worth an error message the visitor cannot act on.
      }
    }

    void load();
    return () => controller.abort();
  }, [input, requestKey]);

  return (
    <section
      aria-labelledby="audit-summary-heading"
      className="border-border bg-card mt-6 rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
      data-track="audit-summary-view"
    >
      <div className="flex items-center gap-2.5">
        <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
          <FileText className="size-4" />
        </span>
        <h3 id="audit-summary-heading" className="text-lg font-semibold">
          In plain language
        </h3>
      </div>
      <p className="text-muted-foreground mt-4 leading-relaxed">{summary}</p>
      <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
        {source === "ai"
          ? "Written from the findings above with AI assistance. It adds no new findings."
          : "Written from the findings above. AI was not available, so this is the direct summary."}
      </p>
    </section>
  );
}
