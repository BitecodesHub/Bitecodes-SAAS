"use client";

import { useState, useSyncExternalStore } from "react";
import { Apple, CheckCircle2, Download, Monitor, Settings } from "lucide-react";
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

/** macOS deep link to System Settings → Privacy & Security. */
const MAC_PRIVACY_SETTINGS =
  "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension";

function MacSteps() {
  return (
    <ol className="space-y-3 text-[15px] leading-[1.6]">
      <li>
        <strong>Open the downloaded file</strong> and drag{" "}
        <strong>Notes</strong> into
        <strong> Applications</strong>.
      </li>
      <li>
        <strong>Open Notes</strong> from Applications. macOS says it could not
        verify the developer — click <strong>Done</strong>.
      </li>
      <li>
        Open <strong>System Settings → Privacy &amp; Security</strong>, scroll
        down and click <strong>Open Anyway</strong> next to “Notes”, then
        confirm.
        <div className="mt-2">
          <Button asChild variant="outline">
            <a href={MAC_PRIVACY_SETTINGS}>
              <Settings className="size-4" aria-hidden="true" /> Open Privacy
              &amp; Security
            </a>
          </Button>
        </div>
      </li>
      <li>
        Click <strong>Sign in with Bitecodes</strong> in Notes. You only do
        steps 2–3 once.
      </li>
    </ol>
  );
}

function WindowsSteps() {
  return (
    <ol className="space-y-3 text-[15px] leading-[1.6]">
      <li>
        <strong>Run the downloaded installer.</strong> If Windows shows “Windows
        protected your PC”, click <strong>More info</strong>, then{" "}
        <strong>Run anyway</strong>.
      </li>
      <li>
        Notes installs for your user account and opens automatically — no admin
        rights needed.
      </li>
      <li>
        Click <strong>Sign in with Bitecodes</strong>. You can find Notes later
        in the Start menu.
      </li>
    </ol>
  );
}

export function NotesDownloads({
  downloads,
  version,
}: {
  downloads: NotesDownload[];
  version: string | null;
}) {
  // OS is unknown on the server; read it on the client without a hydration
  // mismatch (the server snapshot is null) and without an effect re-render.
  const os = useSyncExternalStore(noopSubscribe, detectOs, () => null);
  const [started, setStarted] = useState<"mac" | "windows" | null>(null);

  if (downloads.length === 0) {
    return (
      <p className="bg-surface-2 text-muted-foreground rounded-[18px] p-4 text-[14px] leading-[1.6]">
        Downloads are being prepared. Check back shortly.
      </p>
    );
  }

  const platformOf = (d: NotesDownload) =>
    d.key.startsWith("mac") ? "mac" : "windows";
  const primary =
    os === "mac"
      ? (downloads.find((d) => d.key === "macArm64") ??
        downloads.find((d) => d.key === "macX64"))
      : os === "windows"
        ? (downloads.find((d) => d.key === "winX64") ??
          downloads.find((d) => d.key === "winArm64"))
        : null;

  return (
    <div className="space-y-4">
      {primary && (
        <Button asChild size="lg">
          <a
            href={primary.url}
            rel="noopener"
            onClick={() => setStarted(platformOf(primary))}
          >
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
              onClick={() => setStarted(platformOf(d))}
              className="bg-surface-2 hover:bg-background flex items-center gap-3 rounded-[18px] p-4 text-[15px] transition-colors"
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
                <span className="text-muted-foreground block text-[13px]">
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

      {started && (
        <section
          role="status"
          aria-live="polite"
          className="bg-primary/5 rounded-[24px] p-6"
        >
          <h3 className="flex items-center gap-2 text-[16px] font-semibold">
            <CheckCircle2 className="text-primary size-5" aria-hidden="true" />
            Your download has started — here is how to open Notes
          </h3>
          <div className="mt-3">
            {started === "mac" ? <MacSteps /> : <WindowsSteps />}
          </div>
          <p className="text-muted-foreground mt-4 text-[13px] leading-[1.6]">
            Why the warning? Notes is not yet signed with a paid Apple /
            Microsoft developer certificate, so your computer cannot check who
            made it. The download comes straight from Bitecodes’ official
            release page.
          </p>
        </section>
      )}
    </div>
  );
}
