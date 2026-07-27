"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A checkbox on the native input.
 *
 * Native so it participates in forms, submits with `FormData` (which the admin
 * Server Actions rely on), and needs no JavaScript for its checked state.
 *
 * `indeterminate` is a DOM property with no HTML attribute, so it is applied
 * through a ref. It backs the "some rows selected" state of a bulk-select
 * header checkbox, and `aria-checked="mixed"` is set alongside it so the state
 * is announced rather than merely drawn.
 */
const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    label?: React.ReactNode;
    indeterminate?: boolean;
  }
>(({ className, label, indeterminate = false, id, ...props }, ref) => {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const innerRef = React.useRef<HTMLInputElement | null>(null);

  React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

  React.useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative inline-flex size-5 shrink-0">
        <input
          ref={innerRef}
          id={inputId}
          type="checkbox"
          aria-checked={indeterminate ? "mixed" : undefined}
          className="peer border-input bg-background checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:ring-ring/40 focus-visible:ring-offset-background size-5 cursor-pointer appearance-none rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        {/*
          Both marks are always rendered and revealed by the input's own state,
          so the tick needs no React re-render and stays correct even when the
          checkbox is toggled by a form reset or by the browser.
        */}
        <Check
          aria-hidden="true"
          className="text-primary-foreground pointer-events-none absolute inset-0 m-auto hidden size-3.5 peer-checked:block peer-indeterminate:hidden"
        />
        <Minus
          aria-hidden="true"
          className="text-primary-foreground pointer-events-none absolute inset-0 m-auto hidden size-3.5 peer-indeterminate:block"
        />
      </span>

      {label && (
        <label
          htmlFor={inputId}
          className="cursor-pointer text-sm leading-snug"
        >
          {label}
        </label>
      )}
    </div>
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
