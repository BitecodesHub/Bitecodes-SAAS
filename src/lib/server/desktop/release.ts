import "server-only";

import { desktopProviders } from "@/lib/server/db/collections";
import type { DesktopReleaseDoc } from "@/lib/server/db/types";

/**
 * The Notes desktop app's update feed. The operator publishes the newest
 * version, per-platform download links and (optionally) a minimum version;
 * the app checks it and offers the download, or blocks use below the minimum.
 * Hosted here because the app's source repository is private and builds are
 * unsigned (macOS will not auto-install unsigned updates).
 */

export const RELEASE_ID = "__release__" as const;

export type DownloadKey = keyof DesktopReleaseDoc["downloads"];

export interface DesktopRelease {
  latestVersion: string;
  minimumVersion: string;
  notes: string;
  downloads: DesktopReleaseDoc["downloads"];
}

const EMPTY: DesktopRelease = {
  latestVersion: "",
  minimumVersion: "",
  notes: "",
  downloads: { macArm64: "", macX64: "", winX64: "", winArm64: "" },
};

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

export function isVersion(v: string): boolean {
  return VERSION.test(v);
}

/** -1 / 0 / 1, for "1.2.10" vs "1.2.9" style versions. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function httpsOrEmpty(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.toString()
      : "";
  } catch {
    return "";
  }
}

/**
 * The published release, used until an operator publishes one in the admin
 * panel (which then takes over). Installers live on the public
 * BitecodesHub/notes-releases GitHub releases (installers only, no source).
 */
const RELEASES =
  "https://github.com/BitecodesHub/notes-releases/releases/download";
// Mac builds are 1.8.2 (fixed code signature); Windows stays on the tested
// 1.8.1 installers. latestVersion stays 1.8.1 so neither platform is told to
// "update" to a build it cannot download.
export const BUILT_IN_RELEASE: DesktopRelease = {
  latestVersion: "1.8.1",
  minimumVersion: "",
  notes:
    "Clearer messages when the Bitecodes model is briefly unavailable, plus everything in 1.8: sign in with Bitecodes, screenshot explanations, chat and voice.",
  downloads: {
    macArm64: `${RELEASES}/v1.8.2/Notes-1.8.2-arm64.dmg`,
    macX64: `${RELEASES}/v1.8.2/Notes-1.8.2.dmg`,
    winX64: `${RELEASES}/v1.8.1/Notes-Setup-1.8.1-x64.exe`,
    winArm64: `${RELEASES}/v1.8.1/Notes-Setup-1.8.1-arm64.exe`,
  },
};

export async function getRelease(): Promise<DesktopRelease> {
  const doc = await (await desktopProviders()).findOne({ _id: RELEASE_ID });
  if (!doc || doc.kind !== "release")
    return {
      ...BUILT_IN_RELEASE,
      downloads: { ...BUILT_IN_RELEASE.downloads },
    };
  const r = doc as DesktopReleaseDoc;
  return {
    latestVersion: r.latestVersion,
    minimumVersion: r.minimumVersion,
    notes: r.notes,
    downloads: { ...EMPTY.downloads, ...r.downloads },
  };
}

export async function setRelease(
  input: DesktopRelease,
): Promise<DesktopRelease> {
  const clean: DesktopRelease = {
    latestVersion: isVersion(input.latestVersion) ? input.latestVersion : "",
    minimumVersion: isVersion(input.minimumVersion) ? input.minimumVersion : "",
    notes: String(input.notes ?? "").slice(0, 2000),
    downloads: {
      macArm64: httpsOrEmpty(input.downloads.macArm64),
      macX64: httpsOrEmpty(input.downloads.macX64),
      winX64: httpsOrEmpty(input.downloads.winX64),
      winArm64: httpsOrEmpty(input.downloads.winArm64),
    },
  };
  const now = new Date();
  await (
    await desktopProviders()
  ).updateOne(
    { _id: RELEASE_ID },
    {
      $set: { kind: "release", ...clean, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return clean;
}

export function downloadKey(
  platform: string,
  arch: string,
): DownloadKey | null {
  if (platform === "darwin") return arch === "arm64" ? "macArm64" : "macX64";
  if (platform === "win32") return arch === "arm64" ? "winArm64" : "winX64";
  return null;
}
