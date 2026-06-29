"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const LOCAL_SCREENSHOTS: Record<string, string> = {
  "https://prism.sublimecare.com.au": "/images/projects/prism.png",
  "https://conceptserve.com": "/images/projects/conceptserve.png",
  "https://sublimecare.com.au": "/images/projects/sublimecare.png",
};

export function WebsitePreview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const localSrc = LOCAL_SCREENSHOTS[url];

  if (failed) {
    return (
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <span className="absolute top-5 left-5 text-2xl font-semibold tracking-tight text-white/95 drop-shadow-sm">
          Preview
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden rounded-t-2xl",
        "bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500",
      )}
    >
      <div className="bg-grid absolute inset-0 opacity-20" />
      {localSrc ? (
        <Image
          src={localSrc}
          alt={`Live preview of ${url}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="relative z-10 object-cover object-top transition-transform duration-500 group-hover:scale-105"
          priority
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src={`https://v1.screenshot.11ty.dev/${encodeURIComponent(url)}/opengraph/`}
          alt={`Live preview of ${url}`}
          className="relative z-10 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
