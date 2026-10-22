import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/types/content";
import { Badge } from "@/components/ui/badge";
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
        "group bg-card focus-visible:ring-ring border-border relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {/* Cover, a screenshot when we have one, branded panel otherwise. */}
      <div className="relative">
        <ProjectCover
          project={project}
          priority={priority}
          rounded="rounded-t-2xl"
          aspect={coverAspect}
        />
        <span className="absolute right-5 bottom-5 z-30 flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className={cn("flex flex-1 flex-col", lead ? "p-6 sm:p-8" : "p-6")}>
        <div className="flex items-start justify-between gap-4">
          <h3
            className={cn(
              "font-semibold tracking-tight",
              lead ? "text-2xl sm:text-3xl" : "text-xl",
            )}
          >
            {project.name}
          </h3>
          <Badge variant="muted">{project.year}</Badge>
        </div>
        <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 text-xs">
          {project.client !== project.name && <span>{project.client}</span>}
          {project.client !== project.name && label && (
            <span aria-hidden>·</span>
          )}
          {label && <span>{label}</span>}
        </p>
        <p
          className={cn(
            "text-muted-foreground mt-3 leading-relaxed",
            lead ? "max-w-2xl text-base" : "text-sm",
          )}
        >
          {project.teaser}
        </p>
      </div>
      {priority ? <span className="sr-only">Featured case study</span> : null}
    </Link>
  );
}
