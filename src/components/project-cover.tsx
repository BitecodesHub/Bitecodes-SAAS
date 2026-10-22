import Image from "next/image";
import type { Project } from "@/types/content";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Cover artwork for a project, used on portfolio cards and case-study pages.
 *
 * A real screenshot when the project has one; otherwise a typographic panel
 * built from the project's own category and features — ink surface, hairline
 * grid, monogram, and a short spec list. It reads as deliberate art direction
 * rather than a missing image, and it never implies a screenshot that does
 * not exist.
 */
export function ProjectCover({
  project,
  priority = false,
  aspect = "aspect-[16/10]",
  rounded = "",
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
}: {
  project: Pick<Project, "name" | "image" | "category" | "features">;
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
          {/* Minimal scrim so the corner control stays legible on light sites. */}
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [mask-image:radial-gradient(140%_120%_at_30%_0%,black,transparent_90%)] [background-size:44px_44px]"
          />
          <div
            aria-hidden
            className="absolute inset-4 rounded-lg border border-white/10"
          />
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-8xl font-semibold tracking-[-0.08em] text-white/[0.12] sm:text-9xl"
          >
            {initials(project.name)}
          </span>
          <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-6">
            <span className="text-[10px] font-medium tracking-[0.18em] text-white/45 uppercase">
              {project.category}
            </span>
            <ul className="space-y-1.5">
              {project.features.slice(0, 2).map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2.5 text-[13px] leading-snug text-white/55"
                >
                  <span aria-hidden className="h-px w-4 bg-white/25" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
