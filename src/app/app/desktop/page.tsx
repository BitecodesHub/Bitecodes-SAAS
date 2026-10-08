import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/server/auth/dal";
import { listDevices } from "@/lib/server/desktop/devices";
import { requestLocation } from "@/lib/server/desktop/http";
import { DesktopPairing } from "@/components/desktop/desktop-pairing";

export const metadata: Metadata = {
  title: "Connect desktop app",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/**
 * Where the desktop app sends the browser to sign in.
 *
 * Signed-out visitors are redirected to sign-in and brought straight back, so
 * every existing method (password, magic link, Google, 2FA) works unchanged.
 *
 * The code is TYPED by the user from their own app, never taken from the URL:
 * a pairing link someone else sends cannot be approved with one click (the
 * classic device-code phishing attack). Any ?code= from older builds is ignored.
 */
export default async function DesktopConnectPage() {
  const session = await getAdminSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/app/desktop")}`);

  const h = await headers();
  const here = requestLocation(new Request("http://local", { headers: h }));
  const devices = await listDevices(session.userId);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <DesktopPairing
        yourLocation={here}
        devices={devices.map((d) => ({
          id: d.id,
          label: d.label,
          createdAtIso: d.createdAt.toISOString(),
          lastUsedAtIso: d.lastUsedAt ? d.lastUsedAt.toISOString() : null,
        }))}
      />
    </main>
  );
}
