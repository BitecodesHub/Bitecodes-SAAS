import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import type { Project } from "@/types/content";
import { Badge } from "@/components/ui/badge";
import { WebsitePreview } from "@/components/website-preview";
import { cn } from "@/lib/utils";

export function ProjectCard({
  project,
  className,
  priority,
}: {
  project: Project;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/portfolio/${project.slug}`}
      className={cn(
        "group gradient-ring bg-card hover:glow-primary focus-visible:ring-ring border-border relative flex flex-col overflow-hidden rounded-2xl border shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {/* Cover — live preview or gradient + grid placeholder. */}
      {project.liveUrl ? (
        <div className="relative">
          <WebsitePreview url={project.liveUrl} />
          <span className="absolute top-5 left-5 text-2xl font-semibold tracking-tight text-white/95 drop-shadow-sm">
            {project.name}
          </span>
          <span className="absolute right-5 bottom-5 flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      ) : (
        <div
          className={cn(
            "relative aspect-[16/10] overflow-hidden bg-gradient-to-br",
            project.accent,
          )}
        >
          <div className="bg-grid absolute inset-0 opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 [background:radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.25),transparent)] group-hover:opacity-100" />
          <span className="absolute top-5 left-5 text-2xl font-semibold tracking-tight text-white/95 drop-shadow-sm">
            {project.name}
          </span>
          <span className="absolute bottom-5 left-5 text-xs font-medium tracking-wider text-white/80 uppercase">
            {project.category}
          </span>
          <span className="absolute right-5 bottom-5 flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2">
          <Badge variant="muted">{project.year}</Badge>
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
