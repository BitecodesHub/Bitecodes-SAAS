"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const LOCAL_SCREENSHOTS: Record<string, string> = {
  "https://prism.sublimecare.com.au": "/images/projects/prism.png",
  "https://conceptserve.com": "/images/projects/conceptserve.png",
  "https://sublimecare.com.au": "/images/projects/sublimecare.png",
};

export function WebsitePreview({
  url,
  priority = false,
}: {
  url: string;
  priority?: boolean;
}) {
  const localSrc = LOCAL_SCREENSHOTS[url];

  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden rounded-t-2xl",
        "bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500",
      )}
    >
      <div className="bg-grid absolute inset-0 opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      {localSrc ? (
        <Image
          src={localSrc}
          alt={`Project screenshot for ${new URL(url).hostname}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="relative z-10 object-cover object-top transition-transform duration-500 group-hover:scale-105"
          priority={priority}
        />
      ) : (
        <div className="absolute inset-0 flex items-end p-5">
          <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
            {new URL(url).hostname}
          </span>
        </div>
      )}
    </div>
  );
}
