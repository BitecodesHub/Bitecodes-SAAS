"use client";

import { useState } from "react";
import { Apple, Check, Download, Lock, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NotesDownloadResponse } from "@/app/api/downloads/notes/route";

type Status = "idle" | "checking" | "unlocked" | "error";

type Urls = NonNullable<NotesDownloadResponse["urls"]>;

/**
 * Password gate for the installers. One password unlocks every platform; it
 * is verified server-side (`/api/downloads/notes`) and the download URLs
 * never appear in the page source, only in the response to a correct
 * attempt.
 */
export function NotesDownloads() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [urls, setUrls] = useState<Urls | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "checking") return;
    setStatus("checking");
    setMessage("");

    let body: NotesDownloadResponse;
    try {
      const response = await fetch("/api/downloads/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      body = (await response.json()) as NotesDownloadResponse;
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Check your connection and try again.");
      return;
    }

    if (body.ok && body.urls) {
      setUrls(body.urls);
      setStatus("unlocked");
      return;
    }

    setStatus("error");
    setMessage(
      body.message ?? "That password is not right. Check it and try again.",
    );
  }

  return (
    <div>
      {status === "unlocked" && urls ? (
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check className="text-primary size-4" />
          Unlocked — pick your platform below.
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <label
            htmlFor="notes-download-password"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Lock className="text-primary size-4" />
            Access password
          </label>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            Notes is in early access. Enter the password you were given, or ask
            us for one — it takes a minute. One password unlocks every platform.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Input
              id="notes-download-password"
              type="password"
              name="password"
              autoComplete="off"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter access password"
              aria-invalid={status === "error"}
              aria-describedby={
                status === "error" ? "notes-download-error" : undefined
              }
              className="sm:max-w-xs"
            />
            <Button
              type="submit"
              disabled={status === "checking" || password.length === 0}
            >
              <Lock className="size-4" />
              {status === "checking" ? "Checking…" : "Unlock downloads"}
            </Button>
          </div>
          {status === "error" && (
            <p
              id="notes-download-error"
              role="alert"
              className="text-destructive mt-2 text-sm"
            >
              {message}
            </p>
          )}
        </form>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                <Monitor className="size-4.5" />
              </span>
              <div>
                <h3 className="font-semibold">Windows</h3>
                <p className="text-muted-foreground text-xs">
                  Version 1.1.0 · ~104 MB · Windows 10 and 11
                </p>
              </div>
            </div>
            <Badge>Available now</Badge>
          </div>
          {urls ? (
            <Button asChild className="mt-6">
              <a href={urls.windows} rel="nofollow">
                <Download className="size-4" />
                Download for Windows
              </a>
            </Button>
          ) : (
            <p className="text-muted-foreground mt-6 text-sm leading-relaxed">
              Installer (.exe). Unlock above to download.
            </p>
          )}
        </div>

        <div className="border-border bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                <Apple className="size-4.5" />
              </span>
              <div>
                <h3 className="font-semibold">macOS</h3>
                <p className="text-muted-foreground text-xs">
                  Version 1.1.0 · Apple silicon (~232 MB) or Intel (~239 MB)
                </p>
              </div>
            </div>
            <Badge>Available now</Badge>
          </div>
          {urls ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <a href={urls.macArm64} rel="nofollow">
                  <Download className="size-4" />
                  Apple silicon (M-series)
                </a>
              </Button>
              <Button asChild variant="secondary">
                <a href={urls.macIntel} rel="nofollow">
                  <Download className="size-4" />
                  Intel
                </a>
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground mt-6 text-sm leading-relaxed">
              Disk images (.dmg) for both Apple silicon and Intel. Unlock above
              to download.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
