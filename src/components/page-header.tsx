import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  name: string;
  href: string;
}

/**
 * The opening statement for every interior page. Apple product pages lead with
 * a single large idea, generous air, and one short supporting paragraph — no
 * rules, cards, or decoration competing with the headline.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  align = "center",
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  align?: "center" | "left";
  /** Optional actions or a visual that belongs with the headline. */
  children?: React.ReactNode;
}) {
  return (
    <section className="relative">
      <div className="container-page pt-32 pb-10 sm:pt-40 sm:pb-16 lg:pt-44 lg:pb-20">
        <div
          className={cn(
            "flex flex-col gap-5",
            align === "center"
              ? "mx-auto max-w-4xl items-center text-center"
              : "max-w-4xl items-start",
          )}
        >
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb">
              <ol
                className={cn(
                  "text-muted-foreground flex flex-wrap items-center gap-1 text-[13px]",
                  align === "center" && "justify-center",
                )}
              >
                {breadcrumbs.map((crumb, i) => (
                  <li key={crumb.href} className="flex items-center gap-1">
                    {i > 0 && (
                      <ChevronRight aria-hidden className="size-3 opacity-50" />
                    )}
                    {i === breadcrumbs.length - 1 ? (
                      <span aria-current="page" className="text-foreground">
                        {crumb.name}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="hover:text-foreground inline-flex min-h-11 items-center rounded-md px-2.5 transition-colors"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {eyebrow && (
            <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
              {eyebrow}
            </p>
          )}
          {/* Heading + description render immediately (LCP-critical, no JS gate). */}
          <h1 className="text-[clamp(2.75rem,6.4vw,5.75rem)] leading-[1.01] font-semibold tracking-[-0.04em] text-balance">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground max-w-2xl text-[17px] leading-[1.55] tracking-[-0.012em] text-pretty sm:text-[21px]">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
