import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A native `<select>` with the project's input styling.
 *
 * Native rather than a Radix listbox on purpose: it is keyboard- and
 * screen-reader-correct for free, uses the platform picker on mobile (a much
 * better experience than a custom dropdown in a small viewport), and ships no
 * JavaScript. The chevron is decorative and the native arrow is hidden with
 * `appearance-none`.
 *
 * This replaces the identical class strings that were copy-pasted into
 * `contact-form.tsx`, `project-cost-calculator.tsx`, and `project-consultant.tsx`.
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 flex h-11 w-full appearance-none rounded-xl border px-4 py-2 pr-10 text-base shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden="true"
      className="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
    />
  </div>
));
Select.displayName = "Select";

export { Select };
