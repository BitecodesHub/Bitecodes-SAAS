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

/**
 * The live-work frame. A real deployed site is the artwork, and the segmented
 * control lets people compare three without leaving the page. This is the one
 * interactive signature on the homepage; nothing else competes with it.
 */
export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const project = selectedWork[active];

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="mb-5 flex justify-center">
        <div
          role="group"
          aria-label="Choose a project to preview"
          className="bg-surface-2 inline-grid w-full grid-cols-3 gap-1 rounded-full p-1 sm:w-auto"
        >
          {selectedWork.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={active === index}
              aria-controls="hero-work-preview"
              onClick={() => setActive(index)}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center truncate rounded-full px-3 text-[13px] font-medium tracking-[-0.005em] transition-all duration-200 sm:px-5",
                active === index
                  ? "bg-background text-foreground shadow-[var(--shadow-soft)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-2 rounded-[32px] p-2 sm:p-4">
        <div
          id="hero-work-preview"
          className="bg-background relative overflow-hidden rounded-[24px] shadow-[var(--shadow-lift)]"
        >
          <div className="flex items-center gap-3 border-b border-black/[0.07] px-4 py-3">
            <div aria-hidden className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex min-w-0 flex-1 justify-center">
              <span className="bg-surface-2 text-muted-foreground inline-flex max-w-[70%] items-center gap-1.5 truncate rounded-full px-3.5 py-1 text-[11px]">
                <span
                  className="size-1.5 rounded-full bg-[#0ca30c]"
                  aria-hidden
                />
                {project.url}
              </span>
            </div>
            <span className="text-muted-foreground hidden items-center gap-1.5 text-[11px] sm:inline-flex">
              <span
                className="size-1.5 rounded-full bg-[var(--chart-good)]"
                aria-hidden
              />
              Live
            </span>
          </div>

          <div className="bg-surface-2 relative aspect-[16/10]">
            {selectedWork.map((item, index) => (
              <div
                key={item.name}
                aria-hidden={active !== index}
                className={cn(
                  "absolute inset-0 transition-[opacity,transform] duration-500 ease-out",
                  active === index
                    ? "scale-100 opacity-100"
                    : "pointer-events-none scale-[1.01] opacity-0",
                )}
              >
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 92vw, 70vw"
                  className="object-cover object-top"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-start justify-between gap-4 px-1 sm:flex-row sm:items-end">
        <div>
          <p className="text-muted-foreground text-[13px] font-medium tracking-[0.02em]">
            {project.category} · {project.stack}
          </p>
          <p className="mt-1.5 text-[24px] font-semibold tracking-[-0.025em]">
            {project.name}
            <span className="text-muted-foreground ml-2 text-[17px] font-normal">
              {project.year}
            </span>
          </p>
        </div>
        <Link
          href={project.href}
          className="text-primary inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium transition-opacity hover:opacity-75"
        >
          View case study
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
