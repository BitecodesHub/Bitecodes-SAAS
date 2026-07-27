"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A toggle switch built on a real checkbox input.
 *
 * `role="switch"` on a native checkbox keeps keyboard behaviour, form
 * participation, and label association for free while announcing on/off rather
 * than checked/unchecked. A `div` with a click handler would have needed all
 * three re-implemented.
 *
 * The track and thumb are styled from the input's state with no JavaScript.
 * Note the thumb rule is `peer-checked:[&>span:first-child]:…` rather than a
 * plain `peer-checked:` on the thumb itself: Tailwind compiles `peer-*` to a
 * general-sibling selector (`.peer:checked ~ …`), which can only match a
 * sibling of the input — the thumb is a descendant of the label, so it has to
 * be targeted from the label.
 */
const Switch = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    label?: string;
    description?: string;
  }
>(({ className, label, description, id, ...props }, ref) => {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        aria-describedby={descriptionId}
        className="peer sr-only"
        {...props}
      />

      <label
        htmlFor={inputId}
        aria-hidden="true"
        className="bg-input peer-checked:bg-primary peer-focus-visible:ring-ring/40 peer-focus-visible:ring-offset-background relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-checked:[&>span:first-child]:translate-x-5"
      >
        <span className="bg-background pointer-events-none ml-0.5 size-5 rounded-full shadow-sm transition-transform duration-200 motion-reduce:transition-none" />
      </label>

      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label
              htmlFor={inputId}
              className="cursor-pointer text-sm font-medium"
            >
              {label}
            </label>
          )}
          {description && (
            <p
              id={descriptionId}
              className="text-muted-foreground mt-0.5 text-sm leading-relaxed"
            >
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
Switch.displayName = "Switch";

export { Switch };
