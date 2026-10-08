import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/server/auth/dal";
import {
  findPendingPairing,
  listDevices,
  normalizeUserCode,
} from "@/lib/server/desktop/devices";
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
 * Lives outside the (dash) group so it renders as a focused standalone card.
 */
export default async function DesktopConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const userCode = normalizeUserCode(code ?? "");
  const session = await getAdminSession();
  if (!session) {
    const back = userCode
      ? `/app/desktop?code=${encodeURIComponent(userCode)}`
      : "/app/desktop";
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const [pending, devices] = await Promise.all([
    userCode ? findPendingPairing(userCode) : Promise.resolve(null),
    listDevices(session.userId),
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <DesktopPairing
        requestedCode={userCode}
        pending={
          pending ? { label: pending.label, userCode: pending.userCode } : null
        }
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
