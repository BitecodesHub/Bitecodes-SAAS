"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/types/content";
import { ProjectCard } from "@/components/cards/project-card";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export interface FilterOption {
  slug: string;
  name: string;
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring focus-visible:ring-offset-background min-h-11 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        active
          ? "bg-foreground text-background"
          : "bg-surface-2 text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Static-data filters for the portfolio.
 *
 * The server page passes its published projects and the options that actually
 * occur in them. This island only holds selection state, so the page itself
 * remains statically rendered and every card is present in the initial HTML.
 */
export function PortfolioExplorer({
  projects,
  industryOptions,
  serviceOptions,
}: {
  projects: Project[];
  industryOptions: FilterOption[];
  serviceOptions: FilterOption[];
}) {
  const [industry, setIndustry] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      projects.filter(
        (project) =>
          (!industry || project.industry === industry) &&
          (!service || project.services?.includes(service)),
      ),
    [projects, industry, service],
  );

  const hasFilters = industry !== null || service !== null;

  function clearFilters() {
    setIndustry(null);
    setService(null);
  }

  return (
    <div>
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <fieldset>
            <legend className="text-muted-foreground px-1 text-[13px] font-medium tracking-[0.06em] uppercase">
              Industry
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <FilterButton
                active={industry === null}
                onClick={() => setIndustry(null)}
              >
                All industries
              </FilterButton>
              {industryOptions.map((option) => (
                <FilterButton
                  key={option.slug}
                  active={industry === option.slug}
                  onClick={() =>
                    setIndustry((current) =>
                      current === option.slug ? null : option.slug,
                    )
                  }
                >
                  {option.name}
                </FilterButton>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-muted-foreground px-1 text-[13px] font-medium tracking-[0.06em] uppercase">
              Service
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <FilterButton
                active={service === null}
                onClick={() => setService(null)}
              >
                All services
              </FilterButton>
              {serviceOptions.map((option) => (
                <FilterButton
                  key={option.slug}
                  active={service === option.slug}
                  onClick={() =>
                    setService((current) =>
                      current === option.slug ? null : option.slug,
                    )
                  }
                >
                  {option.name}
                </FilterButton>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p
            aria-live="polite"
            className="text-muted-foreground text-[13px] tabular-nums"
          >
            Showing {filtered.length} of {projects.length} case studies
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-primary focus-visible:ring-ring focus-visible:ring-offset-background rounded-md text-[13px] font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <StaggerGroup className="mt-10 grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project, index) => (
            <StaggerItem key={project.slug}>
              <ProjectCard
                project={project}
                priority={index < 3 && !hasFilters}
                className="h-full"
              />
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <div className="bg-surface-2 mt-10 rounded-[28px] p-10 text-center">
          <p className="text-[17px] font-medium">
            No case studies match these filters.
          </p>
          <p className="text-muted-foreground mt-2 text-[15px]">
            Clear one of the filters to see the rest of the published work.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="bg-primary text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-primary/90 mt-5 inline-flex h-11 items-center justify-center rounded-full px-6 text-[15px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
