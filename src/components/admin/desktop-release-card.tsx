"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Save } from "lucide-react";
import { saveDesktopReleaseAction } from "@/lib/server/desktop/admin-actions";
import type { DesktopRelease, DownloadKey } from "@/lib/server/desktop/release";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DOWNLOADS: { key: DownloadKey; label: string }[] = [
  { key: "macArm64", label: "macOS · Apple Silicon (.dmg)" },
  { key: "macX64", label: "macOS · Intel (.dmg)" },
  { key: "winX64", label: "Windows · x64 (.exe)" },
  { key: "winArm64", label: "Windows · ARM (.exe)" },
];

export function DesktopReleaseCard({ release }: { release: DesktopRelease }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [r, setR] = useState(release);

  const save = () =>
    start(async () => {
      const res = await saveDesktopReleaseAction(r);
      toast(
        res.ok
          ? { title: res.message ?? "Saved", variant: "success" }
          : {
              title: "Could not save",
              description: res.error,
              variant: "error",
            },
      );
      if (res.ok) router.refresh();
    });

  return (
    <section
      className="bg-card rounded-lg border p-5"
      aria-labelledby="release-heading"
    >
      <h2
        id="release-heading"
        className="flex items-center gap-2 font-semibold"
      >
        <Download className="size-4" aria-hidden="true" /> App updates
      </h2>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
        The app checks this on launch and every 6 hours. Newer than the
        user&apos;s build → they see an “Update available” banner with the
        download for their platform. Below the minimum → the app is blocked
        until they update. Leave a field empty to switch it off.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rel-latest">Latest version</Label>
          <Input
            id="rel-latest"
            placeholder="1.8.0"
            value={r.latestVersion}
            onChange={(e) =>
              setR({ ...r, latestVersion: e.target.value.trim() })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rel-min">Minimum version (force update)</Label>
          <Input
            id="rel-min"
            placeholder="optional"
            value={r.minimumVersion}
            onChange={(e) =>
              setR({ ...r, minimumVersion: e.target.value.trim() })
            }
          />
        </div>
        {DOWNLOADS.map((d) => (
          <div key={d.key} className="space-y-1.5">
            <Label htmlFor={`rel-${d.key}`}>{d.label}</Label>
            <Input
              id={`rel-${d.key}`}
              placeholder="https://…"
              spellCheck={false}
              value={r.downloads[d.key]}
              onChange={(e) =>
                setR({
                  ...r,
                  downloads: { ...r.downloads, [d.key]: e.target.value.trim() },
                })
              }
            />
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rel-notes">What&apos;s new (shown in the app)</Label>
          <textarea
            id="rel-notes"
            rows={3}
            maxLength={2000}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={r.notes}
            onChange={(e) => setR({ ...r, notes: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          Publish
        </Button>
      </div>
    </section>
  );
}
