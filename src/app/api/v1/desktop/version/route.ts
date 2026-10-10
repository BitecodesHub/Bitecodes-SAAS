import {
  compareVersions,
  downloadKey,
  getRelease,
  isVersion,
} from "@/lib/server/desktop/release";
import { desktopJson, withDesktopErrors } from "@/lib/server/desktop/http";

/**
 * GET /api/v1/desktop/version?version=1.7.0&platform=darwin&arch=arm64
 *
 * Public (the app checks before sign-in). Says whether an update exists for
 * this build, whether it is required, and where to download it.
 */
export const dynamic = "force-dynamic";

export const GET = withDesktopErrors("version", async (request: Request) => {
  const url = new URL(request.url);
  const current = url.searchParams.get("version") ?? "";
  const platform = url.searchParams.get("platform") ?? "";
  const arch = url.searchParams.get("arch") ?? "";
  const release = await getRelease();
  const key = downloadKey(platform, arch);
  const downloadUrl = key ? release.downloads[key] || null : null;
  const valid = isVersion(current);
  const updateAvailable =
    valid &&
    isVersion(release.latestVersion) &&
    compareVersions(release.latestVersion, current) > 0;
  const updateRequired =
    valid &&
    isVersion(release.minimumVersion) &&
    compareVersions(current, release.minimumVersion) < 0;
  return desktopJson(
    {
      ok: true,
      latestVersion: release.latestVersion || null,
      minimumVersion: release.minimumVersion || null,
      notes: release.notes || null,
      updateAvailable,
      updateRequired,
      downloadUrl,
    },
    200,
    { "Cache-Control": "public, max-age=300" },
  );
});
