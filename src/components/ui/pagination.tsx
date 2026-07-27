import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Pagination control.
 *
 * Renders real `<a>` elements inside a `<nav>` rather than buttons, so pages are
 * linkable, shareable, and open in a new tab — and so the list still works with
 * JavaScript disabled. Arithmetic lives in `lib/pagination.ts`.
 */
export function Pagination({
  page,
  totalItems,
  perPage,
  /** Receives a page number and returns the href for it. */
  buildHref,
  className,
  label = "Pagination",
}: {
  page: number;
  totalItems: number;
  perPage: number;
  buildHref: (page: number) => string;
  className?: string;
  label?: string;
}) {
  const window = buildPageWindow(page, totalItems, perPage);
  if (window.totalPages <= 1) return null;

  return (
    <nav
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center justify-between gap-4",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Showing {window.from}–{window.to} of {totalItems}
      </p>

      <ul className="flex items-center gap-1">
        <li>
          <PageLink
            href={window.hasPrevious ? buildHref(window.page - 1) : undefined}
            aria-label="Previous page"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </PageLink>
        </li>

        {window.items.map((item, index) =>
          item === null ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="text-muted-foreground px-2 text-sm"
            >
              …
            </li>
          ) : (
            <li key={item}>
              <PageLink
                href={buildHref(item)}
                current={item === window.page}
                aria-label={`Page ${item}`}
              >
                {item}
              </PageLink>
            </li>
          ),
        )}

        <li>
          <PageLink
            href={window.hasNext ? buildHref(window.page + 1) : undefined}
            aria-label="Next page"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </PageLink>
        </li>
      </ul>
    </nav>
  );
}

/**
 * One page slot. With no `href` it renders a disabled span rather than a dead
 * link, so the previous/next controls at the ends are not focusable targets
 * that do nothing.
 */
function PageLink({
  href,
  current,
  children,
  ...props
}: {
  href?: string;
  current?: boolean;
  children: React.ReactNode;
} & React.AriaAttributes) {
  const shared =
    "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors";

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={cn(shared, "text-muted-foreground/40 cursor-not-allowed")}
        {...props}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        shared,
        "focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none",
        current
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent hover:text-accent-foreground",
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
