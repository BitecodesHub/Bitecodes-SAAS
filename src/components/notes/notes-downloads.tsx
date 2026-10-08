"use client";

import { useSyncExternalStore } from "react";
import { Apple, Download, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NotesDownload {
  key: "macArm64" | "macX64" | "winX64" | "winArm64";
  label: string;
  detail: string;
  url: string;
}

type Os = "mac" | "windows" | null;

const noopSubscribe = () => () => {};

/** Best guess at the visitor's OS, so their download is the obvious one. */
function detectOs(): Os {
  const ua = navigator.userAgent;
  if (/Macintosh|Mac OS X/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  return null;
}

export function NotesDownloads({
  downloads,
  version,
}: {
  downloads: NotesDownload[];
  version: string | null;
}) {
  // OS is unknown on the server; read it on the client without a hydration
  // mismatch (the server snapshot is null) and without an effect-driven re-render.
  const os = useSyncExternalStore(noopSubscribe, detectOs, () => null);

  if (downloads.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border p-4 text-sm">
        Downloads are being prepared. Check back shortly.
      </p>
    );
  }

  // Apple Silicon vs Intel cannot be told apart from the browser reliably, so
  // on a Mac the Apple Silicon build leads (all Macs since late 2020).
  const primary =
    os === "mac"
      ? (downloads.find((d) => d.key === "macArm64") ??
        downloads.find((d) => d.key === "macX64"))
      : os === "windows"
        ? downloads.find((d) => d.key === "winX64")
        : null;

  return (
    <div className="space-y-4">
      {primary && (
        <Button asChild size="lg">
          <a href={primary.url} rel="noopener">
            <Download className="size-4" aria-hidden="true" />
            Download for {primary.label}
            {version ? <span className="opacity-70">· v{version}</span> : null}
          </a>
        </Button>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {downloads.map((d) => (
          <li key={d.key}>
            <a
              href={d.url}
              rel="noopener"
              className="border-border bg-card hover:border-primary/50 flex items-center gap-3 rounded-xl border p-4 text-sm transition-colors"
            >
              {d.key.startsWith("mac") ? (
                <Apple
                  className="text-muted-foreground size-5"
                  aria-hidden="true"
                />
              ) : (
                <Monitor
                  className="text-muted-foreground size-5"
                  aria-hidden="true"
                />
              )}
              <span className="flex-1">
                <span className="block font-medium">{d.label}</span>
                <span className="text-muted-foreground block text-xs">
                  {d.detail}
                </span>
              </span>
              <Download
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
