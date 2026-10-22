"use client";

import * as React from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Menu,
  Monitor,
  Smartphone,
  UtensilsCrossed,
} from "lucide-react";
import type { LaunchTemplate, TemplateIcon } from "@/data/templates";
import { cn } from "@/lib/utils";

const icons: Record<TemplateIcon, typeof CalendarDays> = {
  calendar: CalendarDays,
  menu: UtensilsCrossed,
  chart: BarChart3,
};

export function TemplatePreview({ template }: { template: LaunchTemplate }) {
  const [device, setDevice] = React.useState<"desktop" | "phone">("desktop");
  const palette = template.palette;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Interactive preview — switch devices to see the responsive layout.
        </p>
        <div
          className="border-border bg-card inline-flex rounded-full border p-1"
          role="group"
          aria-label="Preview device"
        >
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            aria-pressed={device === "desktop"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              device === "desktop"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Monitor className="size-3.5" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setDevice("phone")}
            aria-pressed={device === "phone"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              device === "phone"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Smartphone className="size-3.5" />
            Phone
          </button>
        </div>
      </div>

      <div
        className={cn(
          "border-border overflow-hidden border shadow-[var(--shadow-lift)] transition-all duration-300",
          device === "desktop"
            ? "rounded-2xl"
            : "mx-auto w-full max-w-[390px] rounded-[2rem] border-8",
        )}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ background: "#1b1c22" }}
        >
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="mx-auto truncate rounded-md bg-white/10 px-3 py-1 text-[10px] text-white/60">
            {template.slug}.bitecodes.site
          </span>
        </div>

        <div
          className="max-h-[760px] overflow-y-auto"
          style={{ background: palette.bg, color: palette.ink }}
        >
          <PreviewNav template={template} compact={device === "phone"} />
          <PreviewHero template={template} compact={device === "phone"} />
          <PreviewFeatures template={template} compact={device === "phone"} />
          <PreviewProof template={template} />
          <PreviewFooter template={template} />
        </div>
      </div>
    </div>
  );
}

function PreviewNav({
  template,
  compact,
}: {
  template: LaunchTemplate;
  compact: boolean;
}) {
  const { palette } = template;
  return (
    <nav
      className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8"
      style={{ borderBottom: `1px solid ${palette.border}` }}
      aria-label="Preview navigation"
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 items-center justify-center rounded-lg text-xs font-bold"
          style={{ background: palette.accent, color: palette.accentInk }}
        >
          {template.name.slice(0, 1)}
        </span>
        <span className="text-sm font-semibold tracking-tight">
          {template.name}
        </span>
      </div>
      {compact ? (
        <Menu className="size-5" style={{ color: palette.muted }} />
      ) : (
        <div className="flex items-center gap-6">
          {template.nav.map((item) => (
            <span
              key={item}
              className="text-xs"
              style={{ color: palette.muted }}
            >
              {item}
            </span>
          ))}
          <span
            className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{
              background: palette.accent,
              color: palette.accentInk,
            }}
          >
            {template.hero.primaryCta}
          </span>
        </div>
      )}
    </nav>
  );
}

function PreviewHero({
  template,
  compact,
}: {
  template: LaunchTemplate;
  compact: boolean;
}) {
  const { palette, hero } = template;
  return (
    <section className="px-5 pt-10 pb-8 sm:px-8 sm:pt-14">
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide uppercase"
        style={{ background: palette.accentSoft, color: palette.accent }}
      >
        {hero.eyebrow}
      </span>
      <h3
        className={cn(
          "mt-4 font-semibold tracking-tight text-balance",
          compact ? "text-3xl" : "text-4xl sm:text-5xl",
        )}
      >
        {hero.headline}
      </h3>
      <p
        className={cn(
          "mt-4 leading-relaxed",
          compact ? "text-sm" : "max-w-xl text-base",
        )}
        style={{ color: palette.muted }}
      >
        {hero.subhead}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
          style={{ background: palette.accent, color: palette.accentInk }}
        >
          {hero.primaryCta}
          <ArrowRight className="size-3.5" />
        </span>
        <span
          className="inline-flex items-center rounded-full border px-4 py-2 text-xs font-medium"
          style={{ borderColor: palette.border, color: palette.ink }}
        >
          {hero.secondaryCta}
        </span>
      </div>

      <div
        className={cn(
          "mt-8 grid gap-3",
          compact ? "grid-cols-3" : "max-w-xl grid-cols-3",
        )}
      >
        {hero.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-3"
            style={{
              background: palette.surface,
              border: `1px solid ${palette.border}`,
            }}
          >
            <p className="text-base font-semibold">{stat.value}</p>
            <p className="mt-0.5 text-[10px]" style={{ color: palette.muted }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <HeroVisual template={template} compact={compact} />
    </section>
  );
}

function HeroVisual({
  template,
  compact,
}: {
  template: LaunchTemplate;
  compact: boolean;
}) {
  const { palette } = template;
  if (template.slug === "northwind") {
    return (
      <div
        className={cn("mt-8 rounded-2xl p-4", compact ? "w-full" : "max-w-2xl")}
        style={{
          background: palette.surface,
          border: `1px solid ${palette.border}`,
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold">Delivery overview</p>
          <span
            className="rounded-full px-2 py-0.5 text-[9px]"
            style={{ background: palette.accentSoft, color: palette.accent }}
          >
            Live
          </span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[72, 44, 91, 58].map((height, index) => (
            <div key={index} className="flex h-20 items-end">
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${height}%`,
                  background: index === 2 ? palette.accent : palette.accentSoft,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (template.slug === "ember-table") {
    return (
      <div
        className={cn("mt-8 rounded-2xl p-4", compact ? "w-full" : "max-w-md")}
        style={{
          background: palette.surface,
          border: `1px solid ${palette.border}`,
        }}
      >
        <p
          className="text-[10px] font-semibold tracking-wide uppercase"
          style={{ color: palette.accent }}
        >
          Tonight
        </p>
        <div className="mt-2 space-y-2">
          {[
            ["Charred leeks, hazelnut", "12"],
            ["Wood-fired sea bream", "26"],
            ["Burnt honey tart", "9"],
          ].map(([dish, price]) => (
            <div
              key={dish}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span>{dish}</span>
              <span className="tabular-nums" style={{ color: palette.muted }}>
                {price}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("mt-8 rounded-2xl p-4", compact ? "w-full" : "max-w-md")}
      style={{
        background: palette.surface,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold">Next available</p>
        <CalendarDays className="size-3.5" style={{ color: palette.accent }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["Tue 09:30", "Wed 11:00", "Thu 14:15"].map((slot) => (
          <span
            key={slot}
            className="rounded-lg px-2 py-2 text-center text-[10px] font-medium"
            style={{ background: palette.accentSoft, color: palette.accent }}
          >
            {slot}
          </span>
        ))}
      </div>
    </div>
  );
}

function PreviewFeatures({
  template,
  compact,
}: {
  template: LaunchTemplate;
  compact: boolean;
}) {
  const { palette } = template;
  return (
    <section
      className="px-5 py-8 sm:px-8"
      style={{
        background: palette.surface,
        borderTop: `1px solid ${palette.border}`,
        borderBottom: `1px solid ${palette.border}`,
      }}
    >
      <div
        className={cn("grid gap-4", compact ? "grid-cols-1" : "grid-cols-3")}
      >
        {template.features.map((feature) => {
          const Icon = icons[feature.icon];
          return (
            <div key={feature.title}>
              <span
                className="flex size-8 items-center justify-center rounded-lg"
                style={{
                  background: palette.accentSoft,
                  color: palette.accent,
                }}
              >
                <Icon className="size-4" />
              </span>
              <h4 className="mt-3 text-xs font-semibold">{feature.title}</h4>
              <p
                className="mt-1 text-[11px] leading-relaxed"
                style={{ color: palette.muted }}
              >
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PreviewProof({ template }: { template: LaunchTemplate }) {
  const { palette, testimonial } = template;
  return (
    <section className="px-5 py-8 sm:px-8">
      <p
        className="text-sm leading-relaxed font-medium"
        style={{ color: palette.ink }}
      >
        “{testimonial.quote}”
      </p>
      <p className="mt-3 text-[11px]" style={{ color: palette.muted }}>
        {testimonial.name} · {testimonial.role}
      </p>
    </section>
  );
}

function PreviewFooter({ template }: { template: LaunchTemplate }) {
  const { palette, finalCta } = template;
  return (
    <section
      className="px-5 py-10 text-center sm:px-8"
      style={{ background: palette.accent, color: palette.accentInk }}
    >
      <h3 className="text-2xl font-semibold tracking-tight">
        {finalCta.heading}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-xs opacity-80">
        {finalCta.body}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black">
        {finalCta.button}
        <ArrowRight className="size-3.5" />
      </span>
    </section>
  );
}
