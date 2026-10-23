import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Faq } from "@/types/content";

/**
 * Answer-first FAQ list rendered with native <details>/<summary> so every
 * answer is present in the HTML without JavaScript. Hairline rows and large
 * question type follow the same disclosure rhythm as a settings list.
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
        "border-t border-black/[0.08] dark:border-white/12",
        className,
      )}
    >
      {faqs.map((faq, index) => (
        <details
          key={faq.question}
          className="group border-b border-black/[0.08] dark:border-white/12"
          open={defaultOpenFirst && index === 0 ? true : undefined}
        >
          <summary className="focus-visible:ring-ring flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="text-[17px] leading-snug font-medium tracking-[-0.015em] sm:text-[19px]">
              {faq.question}
            </span>
            <Plus
              aria-hidden="true"
              className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-open:rotate-45"
            />
          </summary>
          <div className="text-muted-foreground max-w-3xl pb-6 text-[15px] leading-[1.7] sm:text-[16px]">
            {faq.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
