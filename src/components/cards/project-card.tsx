import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/types/content";
import { ProjectCover } from "@/components/project-cover";
import { cn } from "@/lib/utils";

function relationshipLabel(relationship: Project["relationship"]) {
  switch (relationship) {
    case "internal":
      return "Internal product";
    case "related-party":
      return "Related-party work";
    default:
      return null;
  }
}

export function ProjectCard({
  project,
  className,
  priority,
  coverAspect,
  lead,
}: {
  project: Project;
  className?: string;
  priority?: boolean;
  /** Override the cover ratio for editorial layouts. */
  coverAspect?: string;
  /** Larger type and a wider title for the lead case study. */
  lead?: boolean;
}) {
  const label = relationshipLabel(project.relationship);

  return (
    <Link
      href={`/portfolio/${project.slug}`}
      className={cn(
        "group bg-surface-2 focus-visible:ring-ring relative flex flex-col overflow-hidden rounded-[28px] transition-all duration-300 hover:shadow-[var(--shadow-lift)] focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <div className="relative">
        <ProjectCover
          project={project}
          priority={priority}
          rounded="rounded-t-[28px]"
          aspect={coverAspect}
        />
        <span className="absolute right-5 bottom-5 z-30 flex size-10 items-center justify-center rounded-full bg-white/90 text-[#1d1d1f] shadow-[var(--shadow-soft)] transition-transform duration-300 group-hover:scale-105">
          <ArrowUpRight className="size-4" aria-hidden />
        </span>
      </div>
      <div className={cn("flex flex-1 flex-col", lead ? "p-7 sm:p-9" : "p-6")}>
        <p className="text-muted-foreground text-[13px] font-medium tracking-[0.02em]">
          {project.category} · {project.year}
        </p>
        <h3
          className={cn(
            "mt-2 font-semibold tracking-[-0.025em]",
            lead ? "text-[28px] sm:text-[34px]" : "text-[22px]",
          )}
        >
          {project.name}
        </h3>
        <p className="text-muted-foreground mt-1 text-[13px]">
          {[project.client !== project.name ? project.client : null, label]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p
          className={cn(
            "text-muted-foreground mt-3 leading-relaxed",
            lead ? "max-w-2xl text-[16px]" : "text-[15px]",
          )}
        >
          {project.teaser}
        </p>
      </div>
      {priority ? <span className="sr-only">Featured case study</span> : null}
    </Link>
  );
}
