import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/types/content";
import { cn } from "@/lib/utils";

export function ServiceCard({
  service,
  className,
}: {
  service: Service;
  className?: string;
}) {
  const Icon = service.icon;
  return (
    <Link
      href={`/services/${service.slug}`}
      className={cn(
        "group bg-background focus-visible:ring-ring hover:border-primary/30 dark:hover:border-primary/50 relative isolate flex flex-col overflow-hidden rounded-[28px] border border-black/[0.08] p-7 shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:ring-2 focus-visible:outline-none active:translate-y-0 active:scale-[0.995] dark:border-white/10",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_100%_at_100%_0%,rgba(96,64,244,0.10),transparent_55%)] opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 dark:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(139,112,255,0.18),transparent_55%)]"
      />
      <div className="flex items-start justify-between">
        <span className="text-primary bg-primary/10 ring-primary/10 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary/30 flex size-12 items-center justify-center rounded-2xl ring-1 transition-[background-color,color,box-shadow,transform] duration-300 ease-out group-hover:scale-105">
          <Icon
            className="size-5 transition-transform duration-300 group-hover:scale-110"
            aria-hidden
          />
        </span>
        <ArrowUpRight
          aria-hidden
          className="text-muted-foreground group-hover:text-primary size-5 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </div>
      <h3 className="mt-8 text-[21px] font-semibold tracking-[-0.02em]">
        {service.title}
      </h3>
      <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
        {service.tagline}
      </p>
    </Link>
  );
}
