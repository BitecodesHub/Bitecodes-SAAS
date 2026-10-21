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
}: {
  project: Project;
  className?: string;
  priority?: boolean;
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
        />
        <span className="absolute top-5 left-5 z-30 text-2xl font-semibold tracking-tight text-white/95 drop-shadow-sm">
          {project.name}
        </span>
        <span className="absolute right-5 bottom-5 z-30 flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">{project.year}</Badge>
          {label && <Badge variant="muted">{label}</Badge>}
          <span className="text-muted-foreground text-xs">
            {project.client}
          </span>
        </div>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {project.teaser}
        </p>
      </div>
      {priority ? <span className="sr-only">Featured case study</span> : null}
    </Link>
  );
}
