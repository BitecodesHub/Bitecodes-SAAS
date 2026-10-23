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
        "group bg-surface-2 focus-visible:ring-ring hover:bg-background relative flex flex-col rounded-[28px] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-primary flex size-12 items-center justify-center rounded-2xl bg-white shadow-[var(--shadow-soft)] dark:bg-white/10">
          <Icon className="size-5" aria-hidden />
        </span>
        <ArrowUpRight
          aria-hidden
          className="text-muted-foreground size-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
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
