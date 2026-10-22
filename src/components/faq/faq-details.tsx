import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Faq } from "@/types/content";

/**
 * Answer-first FAQ list rendered with native <details>/<summary> so every
 * answer is present in the HTML without JavaScript. Used by server pages and
 * by the client search island.
 */
export function FaqDetails({
  faqs,
  className,
  defaultOpenFirst = true,
}: {
  faqs: Faq[];
  className?: string;
  defaultOpenFirst?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {faqs.map((faq, index) => (
        <details
          key={faq.question}
          className="group"
          open={defaultOpenFirst && index === 0 ? true : undefined}
        >
          <summary className="focus-visible:ring-ring hover:text-primary flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-left text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span>{faq.question}</span>
            <ChevronDown
              aria-hidden="true"
              className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="text-muted-foreground px-6 pb-5 text-sm leading-relaxed">
            {faq.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
