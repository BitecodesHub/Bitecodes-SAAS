import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export interface Crumb {
  name: string;
  href: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  align = "center",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  align?: "center" | "left";
}) {
  return (
    <section className="border-border relative overflow-hidden border-b">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-40" />
        <div className="bg-mesh absolute inset-0" />
      </div>
      <div className="container-page py-16 sm:py-20">
        <div
          className={cn(
            "flex max-w-3xl flex-col gap-5",
            align === "center" && "mx-auto items-center text-center",
          )}
        >
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb">
              <ol
                className={cn(
                  "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm",
                  align === "center" && "justify-center",
                )}
              >
                {breadcrumbs.map((crumb, i) => (
                  <li key={crumb.href} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="size-3.5 opacity-60" />}
                    {i === breadcrumbs.length - 1 ? (
                      <span className="text-foreground">{crumb.name}</span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="hover:text-foreground inline-flex min-h-11 items-center rounded-md px-1.5 py-2 transition-colors"
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
            <Reveal direction="none">
              <Badge>{eyebrow}</Badge>
            </Reveal>
          )}
          {/* Heading + description render immediately (LCP-critical, no JS gate). */}
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
