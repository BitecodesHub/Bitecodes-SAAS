"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const selectedWork = [
  {
    name: "PRISM",
    href: "/portfolio/prism",
    url: "prism.sublimecare.com.au",
    image: "/images/projects/prism.jpg",
    alt: "PRISM homepage, an AI SEO and generative-engine-optimisation platform built by Bitecodes",
    category: "AI · SEO platform",
    stack: "Next.js · TypeScript · Python",
    year: "2025",
  },
  {
    name: "ConceptServe",
    href: "/portfolio/conceptserve-technologies",
    url: "conceptserve.com",
    image: "/images/projects/conceptserve.jpg",
    alt: "ConceptServe Technologies homepage, a corporate platform built by Bitecodes",
    category: "Web · Corporate platform",
    stack: "Next.js · TypeScript · PostgreSQL",
    year: "2024",
  },
  {
    name: "Sublime Care",
    href: "/portfolio/sublime-care",
    url: "sublimecare.com.au",
    image: "/images/projects/sublimecare.jpg",
    alt: "Sublime Care homepage, an Australian aged-care provider website built by Bitecodes",
    category: "Healthcare · Website",
    stack: "Python · Node.js · PostgreSQL",
    year: "2025",
  },
] as const;

export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const project = selectedWork[active];

  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
      <div className="relative">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase">
            <span className="bg-primary size-1.5 rounded-full" aria-hidden />
            Selected work
          </p>

          <div
            role="group"
            aria-label="Choose a project to preview"
            className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-auto sm:flex-wrap sm:items-center"
          >
            {selectedWork.map((item, index) => (
              <button
                key={item.name}
                type="button"
                aria-pressed={active === index}
                aria-controls="hero-work-preview"
                onClick={() => setActive(index)}
                className={cn(
                  "min-w-0 truncate rounded-full px-2.5 py-1.5 text-center font-mono text-[10px] tracking-[0.1em] uppercase transition-colors sm:py-1",
                  active === index
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          {/* Offset backing card gives the preview depth without a backdrop. */}
          <div
            aria-hidden
            className="border-border/70 bg-surface-2/80 absolute inset-x-4 top-6 -bottom-2 rotate-[1deg] rounded-2xl border"
          />

          <div
            id="hero-work-preview"
            className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-[var(--shadow-lift)]"
          >
            <div className="border-border/80 bg-surface-2/80 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-3 py-2.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="bg-foreground/15 size-1.5 rounded-full" />
                <span className="bg-foreground/15 size-1.5 rounded-full" />
                <span className="bg-foreground/15 size-1.5 rounded-full" />
              </span>
              <span className="bg-background/80 text-muted-foreground max-w-[52vw] truncate rounded-full px-3 py-1 font-mono text-[10px] tracking-tight sm:max-w-none">
                {project.url}
              </span>
              <span className="text-muted-foreground flex items-center justify-end gap-1.5 text-[10px] font-medium">
                <span
                  className="size-1.5 rounded-full bg-[var(--chart-good)]"
                  aria-hidden
                />
                <span className="hidden sm:inline">Live</span>
                <span className="sr-only">Live site</span>
              </span>
            </div>

            <div className="bg-secondary relative aspect-[16/10]">
              {selectedWork.map((item, index) => (
                <div
                  key={item.name}
                  aria-hidden={active !== index}
                  className={cn(
                    "absolute inset-0 transition-[opacity,transform] duration-500 ease-out",
                    active === index
                      ? "scale-100 opacity-100"
                      : "pointer-events-none scale-[1.015] opacity-0",
                  )}
                >
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 1024px) 92vw, 42vw"
                    className="object-cover object-top"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1">
          <div>
            <p className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(selectedWork.length).padStart(2, "0")} ·{" "}
              {project.category}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              {project.name}
              <span className="text-muted-foreground ml-2 font-normal">
                {project.year}
              </span>
            </p>
            <p className="text-muted-foreground mt-1 font-mono text-[10px] tracking-[0.06em] uppercase">
              {project.stack}
            </p>
          </div>
          <Link
            href={project.href}
            className="group text-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            View case study
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
