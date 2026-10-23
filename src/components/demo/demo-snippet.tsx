"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A copyable embed snippet.
 *
 * The demo page shows the exact snippet a customer receives. It is deliberately
 * a client component and nothing more: there is no "pretend product" behind it,
 * so what is on the page is literally what gets pasted into a site.
 */
export function DemoSnippet({
  label,
  code,
  className,
}: {
  label: string;
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  React.useEffect(() => () => clearTimeout(timeout.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard access can be denied; the code remains selectable by hand.
    }
  }

  return (
    <div
      className={cn("border-border bg-muted/30 rounded-xl border", className)}
    >
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label={copied ? "Copied" : `Copy ${label}`}
          data-track="demo-copy-snippet"
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="text-foreground/90 overflow-x-auto p-4 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
