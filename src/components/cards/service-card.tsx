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
        "group bg-card focus-visible:ring-ring border-border relative flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
          <Icon className="size-5" />
        </span>
        <ArrowUpRight className="text-muted-foreground size-5 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">
        {service.title}
      </h3>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {service.tagline}
      </p>
    </Link>
  );
}
