import type { Service } from "@/types/content";
import { cn } from "@/lib/utils";
import { ServiceCardFrame } from "@/components/cards/service-card-frame";
import { ArrowUpRight } from "lucide-react";

export function ServiceCard({
  service,
  className,
}: {
  service: Service;
  className?: string;
}) {
  const Icon = service.icon;
  return (
    <ServiceCardFrame
      href={`/services/${service.slug}`}
      className={cn(
        "service-card group bg-background focus-visible:ring-ring relative isolate flex flex-col overflow-hidden rounded-[28px] border border-black/[0.08] p-7 shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:outline-none dark:border-white/10",
        className,
      )}
    >
      <span
        aria-hidden
        className="service-card-light pointer-events-none absolute inset-0 -z-10"
      />
      <div className="flex items-start justify-between">
        <span className="service-icon flex size-12 items-center justify-center rounded-2xl">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="service-arrow" aria-hidden>
          <ArrowUpRight className="service-arrow-a" />
          <ArrowUpRight className="service-arrow-b" />
        </span>
      </div>
      <h3 className="mt-8 text-[21px] font-semibold tracking-[-0.02em]">
        {service.title}
      </h3>
      <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
        {service.tagline}
      </p>
    </ServiceCardFrame>
  );
}
