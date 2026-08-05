import Image from "next/image";
import type { Project } from "@/types/content";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * Cover artwork for a project, used on portfolio cards and case-study pages.
 *
 * A real screenshot when the project has one; otherwise a quiet branded panel —
 * dark surface, faint grid, watermark mark. Never a bare accent gradient: a
 * block of colour where a screenshot belongs reads as a broken image.
 */
export function ProjectCover({
  project,
  priority = false,
  aspect = "aspect-[16/10]",
  rounded = "",
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
}: {
  project: Pick<Project, "name" | "image" | "category">;
  priority?: boolean;
  /** Tailwind aspect-ratio class; cards and detail covers differ. */
  aspect?: string;
  rounded?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden bg-[#100e17]", aspect, rounded)}
    >
      <div className="bg-grid absolute inset-0 opacity-15" />
      {project.image ? (
        <>
          <Image
            src={project.image}
            alt={`Screenshot of ${project.name}`}
            fill
            sizes={sizes}
            className="relative z-10 object-cover object-top transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
          {/* Legibility scrim for the overlaid title on cards. */}
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/45 via-transparent to-black/25" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 [background:radial-gradient(110%_90%_at_85%_110%,rgba(255,255,255,0.14),transparent_60%)]" />
          {/* Watermark mark, bleeding off the corner like a pressmark. */}
          <Logo
            iconOnly
            href={null}
            className="absolute -right-6 -bottom-8 text-white opacity-[0.16] [&_svg]:size-44"
          />
          <span className="absolute bottom-5 left-5 z-10 text-xs font-medium tracking-wider text-white/70 uppercase">
            {project.category}
          </span>
        </>
      )}
    </div>
  );
}
