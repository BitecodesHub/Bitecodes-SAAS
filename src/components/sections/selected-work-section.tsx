"use client";

import { useState, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

const selectedWork = [
  {
    name: "PRISM",
    slug: "prism",
    href: "/portfolio/prism",
    url: "prism.sublimecare.com.au",
    liveUrl: "https://prism.sublimecare.com.au",
    image: "/images/projects/prism.jpg",
    alt: "PRISM homepage, an AI SEO and generative-engine-optimisation platform built by Bitecodes",
    category: "AI · SEO platform",
    stack: "Next.js · TypeScript · Python",
    year: "2025",
  },
  {
    name: "ConceptServe",
    slug: "conceptserve-technologies",
    href: "/portfolio/conceptserve-technologies",
    url: "conceptserve.com",
    liveUrl: "https://conceptserve.com",
    image: "/images/projects/conceptserve.jpg",
    alt: "ConceptServe Technologies homepage, a corporate platform built by Bitecodes",
    category: "Web · Corporate platform",
    stack: "Next.js · TypeScript · PostgreSQL",
    year: "2024",
  },
  {
    name: "Sublime Care",
    slug: "sublime-care",
    href: "/portfolio/sublime-care",
    url: "sublimecare.com.au",
    liveUrl: "https://sublimecare.com.au",
    image: "/images/projects/sublimecare.jpg",
    alt: "Sublime Care homepage, an Australian aged-care provider whose billing automation Bitecodes built",
    category: "Healthcare · Automation",
    stack: "Python · Node.js · PostgreSQL",
    year: "2025",
  },
] as const;

/**
 * The proof band. It carries the claim, the picker, and the live site in one
 * frame — the hero preview and the old case-study gallery showed the same three
 * projects twice, so they were folded together and cut to a single screenful.
 */
export function SelectedWorkSection() {
  const [active, setActive] = useState(0);
  const project = selectedWork[active];

  function handleTablistKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = selectedWork.length - 1;
    let next = active;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      next = active === last ? 0 : active + 1;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      next = active === 0 ? last : active - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = last;
    } else {
      return;
    }

    event.preventDefault();
    setActive(next);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }

  return (
    <section
      id="work"
      aria-labelledby="work-title"
      className="scroll-mt-24 py-10 sm:py-14"
    >
      <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 sm:gap-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12">
        <Reveal className="lg:col-start-1 lg:row-start-1">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            Selected work
          </p>
          <h2
            id="work-title"
            className="mt-4 max-w-[24ch] text-[clamp(1.9rem,3.2vw,2.75rem)] leading-[1.06] font-semibold tracking-[-0.03em] text-balance"
          >
            Case studies in shipping the hard part.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-[46ch] text-[16px] leading-[1.55] tracking-[-0.01em] text-pretty sm:text-[17px]">
            Real clients, real deployments — the problem, the approach, and what
            was built.
          </p>
        </Reveal>

        <Reveal
          direction="none"
          className="mx-auto w-full max-w-[38rem] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-none lg:self-center"
        >
          <div className="bg-surface-2 rounded-[24px] p-1.5 sm:rounded-[28px] sm:p-2">
            <div
              id="selected-work-preview"
              role="tabpanel"
              aria-labelledby={`selected-work-tab-${project.slug}`}
              className="bg-background overflow-hidden rounded-[18px] shadow-[var(--shadow-soft)] sm:rounded-[22px]"
            >
              <div className="flex items-center gap-2 border-b border-black/[0.07] px-2.5 sm:px-3.5 dark:border-white/10">
                <div aria-hidden className="flex shrink-0 gap-1.5 pl-1">
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex min-w-0 flex-1 justify-center">
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-track={`work_live_${project.slug}`}
                    className="group/url inline-flex min-h-11 max-w-full items-center px-1"
                  >
                    <span className="bg-surface-2 text-muted-foreground group-hover/url:text-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] tracking-[0.01em] transition-colors">
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-[var(--chart-good)]"
                        aria-hidden
                      />
                      <span className="truncate">{project.url}</span>
                    </span>
                    <span className="sr-only">
                      {" "}
                      (opens the live site in a new tab)
                    </span>
                  </a>
                </div>
                <span className="text-muted-foreground hidden shrink-0 items-center gap-1.5 text-[13px] sm:inline-flex">
                  <span
                    className="size-1.5 rounded-full bg-[var(--chart-good)]"
                    aria-hidden
                  />
                  Live
                </span>
              </div>

              <Link
                href={project.href}
                aria-label={`Read the ${project.name} case study`}
                data-track={`work_preview_${project.slug}`}
                className="group/preview bg-surface-2 relative block aspect-[16/9] overflow-hidden"
              >
                {selectedWork.map((item, index) => (
                  <div
                    key={item.slug}
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
                      sizes="(max-width: 1023px) 92vw, 45vw"
                      className="object-cover object-top transition-transform duration-700 ease-out group-hover/preview:scale-[1.01]"
                    />
                  </div>
                ))}
                <span className="bg-background/90 text-foreground pointer-events-none absolute right-3 bottom-3 hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium opacity-0 shadow-[var(--shadow-soft)] backdrop-blur transition-opacity duration-200 group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100 sm:inline-flex">
                  View case study
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </span>
              </Link>

              <div className="text-muted-foreground flex items-center justify-between gap-4 border-t border-black/[0.07] px-4 py-2.5 text-[13px] dark:border-white/10">
                <p className="min-w-0 truncate">
                  {project.category} · {project.stack}
                </p>
                <span className="shrink-0 tabular-nums">{project.year}</span>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="lg:col-start-1 lg:row-start-2">
          <div
            role="tablist"
            aria-label="Selected projects"
            onKeyDown={handleTablistKeyDown}
            className="bg-surface-2 grid grid-cols-3 gap-1 rounded-full p-1 sm:block sm:rounded-none sm:border-y sm:border-black/[0.08] sm:bg-transparent sm:p-0 dark:sm:border-white/10"
          >
            {selectedWork.map((item, index) => {
              const isActive = active === index;

              return (
                <button
                  key={item.slug}
                  type="button"
                  role="tab"
                  id={`selected-work-tab-${item.slug}`}
                  aria-selected={isActive}
                  aria-controls="selected-work-preview"
                  tabIndex={isActive ? 0 : -1}
                  data-track={`work_tab_${item.slug}`}
                  onClick={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setActive(index);
                  }}
                  className={cn(
                    "group/tab flex min-h-11 w-full items-center justify-center gap-3 rounded-full px-2 text-center transition-colors duration-200 sm:min-h-12 sm:justify-start sm:rounded-none sm:border-b sm:border-black/[0.08] sm:px-0 sm:py-3 sm:text-left sm:last:border-b-0 dark:sm:border-white/10",
                    isActive
                      ? "bg-background shadow-[var(--shadow-soft)] sm:bg-transparent sm:shadow-none"
                      : "bg-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.005em] transition-colors duration-200 sm:text-[17px] sm:tracking-[-0.015em]",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground group-hover/tab:text-foreground",
                    )}
                  >
                    {item.name}
                  </span>
                  <span className="text-muted-foreground hidden shrink-0 text-[13px] sm:block">
                    {item.category}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className={cn(
                      "hidden size-4 shrink-0 transition-all duration-200 sm:block",
                      isActive
                        ? "text-primary translate-x-0 opacity-100"
                        : "text-muted-foreground -translate-x-1 opacity-0 group-hover/tab:translate-x-0 group-hover/tab:opacity-100",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link
              href={project.href}
              data-track={`work_case_study_${project.slug}`}
              className="text-primary inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium underline-offset-4 hover:underline"
            >
              View case study
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/portfolio"
              className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium underline-offset-4 hover:underline"
            >
              All case studies
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
