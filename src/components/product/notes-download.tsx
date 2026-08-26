"use client";

import { useState } from "react";
import { Check, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NotesDownloadResponse } from "@/app/api/downloads/notes/route";

type Status = "idle" | "checking" | "unlocked" | "error";

/**
 * Password gate for the Windows installer. The password is verified
 * server-side (`/api/downloads/notes`); the installer URL never appears in
 * the page source, only in the response to a correct attempt.
 */
export function NotesDownloadForm() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

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

    if (body.ok && body.url) {
      setDownloadUrl(body.url);
      setStatus("unlocked");
      // Start the download immediately; the button below stays as a retry.
      window.location.assign(body.url);
      return;
    }

    setStatus("error");
    setMessage(
      body.message ?? "That password is not right. Check it and try again.",
    );
  }

  if (status === "unlocked") {
    return (
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check className="text-primary size-4" />
          Unlocked — your download is starting.
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          If it does not start on its own, use the button below. Installer is
          about 104 MB.
        </p>
        <Button asChild className="mt-4">
          <a href={downloadUrl} rel="nofollow">
            <Download className="size-4" />
            Download Notes 1.1.0 for Windows
          </a>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label
        htmlFor="notes-download-password"
        className="flex items-center gap-2 text-sm font-medium"
      >
        <Lock className="text-primary size-4" />
        Access password
      </label>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
        Notes is in early access. Enter the password you were given, or ask us
        for one — it takes a minute.
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
          <Download className="size-4" />
          {status === "checking" ? "Checking…" : "Download for Windows"}
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
  );
}
