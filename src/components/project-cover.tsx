import Image from "next/image";
import type { Project } from "@/types/content";
import { cn } from "@/lib/utils";

/**
 * Cover artwork for a project, used on portfolio cards and case-study pages.
 *
 * A real screenshot when one exists for a live site, cover artwork where the
 * client only has art direction, and otherwise a typographic panel built from
 * the project's own name and category — ink surface, a large monogram, and no
 * invented interface. It reads as deliberate art direction rather than a
 * missing image, and it never implies a screenshot that does not exist.
 */
export function ProjectCover({
  project,
  priority = false,
  aspect = "aspect-[16/10]",
  rounded = "",
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
}: {
  project: Pick<
    Project,
    "name" | "image" | "category" | "features" | "liveUrl"
  >;
  priority?: boolean;
  /** Tailwind aspect-ratio class; cards and detail covers differ. */
  aspect?: string;
  rounded?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden bg-[#1d1d1f]", aspect, rounded)}
    >
      {project.image ? (
        <>
          <Image
            src={project.image}
            alt={
              project.liveUrl
                ? `Cover image for ${project.name}`
                : `Cover artwork for ${project.name}`
            }
            fill
            sizes={sizes}
            className="relative z-10 object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
            priority={priority}
          />
          {/* Minimal scrim so the corner control stays legible on light sites. */}
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="absolute -right-6 -bottom-16 text-[12rem] leading-none font-semibold tracking-[-0.08em] text-white/[0.07] sm:text-[16rem]"
          >
            {project.name
              .split(/\s+/)
              .map((word) => word[0] ?? "")
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
            <span className="text-[13px] font-medium tracking-[0.12em] text-white/50 uppercase">
              {project.category}
            </span>
            <div>
              <p className="max-w-xs text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
                {project.name}
              </p>
              <ul className="mt-4 space-y-1.5">
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
          </div>
        </>
      )}
    </div>
  );
}
