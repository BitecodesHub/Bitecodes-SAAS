import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect, unauthorized } from "next/navigation";
import {
  requireAdminSession,
  getCurrentAdminUser,
} from "@/lib/server/auth/dal";
import { capabilitiesFor, isCustomerRole } from "@/lib/server/auth/roles";
import { logoutAction } from "@/lib/server/auth/actions";
import { AdminShell, SIDEBAR_COOKIE } from "@/components/admin/admin-shell";

/**
 * The admin panel layout.
 *
 * Authorises before rendering anything, but note that a layout is **not** a
 * sufficient auth boundary on its own: Next does not re-run layouts on every
 * client-side navigation, and a Server Action can be invoked without any layout
 * rendering at all. Every page and action therefore repeats its own check
 * through the data-access layer. The check here exists so that a signed-out
 * visitor never sees the shell, not to protect the pages inside it.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Bitecodes Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();

  // A customer would be refused by every page in here anyway, because none of
  // the capabilities they hold appears on one — so this changes no permission.
  // What it changes is the answer: a redirect to their own dashboard, rather
  // than a 403 that reads as "you have broken something" to somebody who most
  // likely just followed a stale bookmark or a link in an old email.
  if (isCustomerRole(session.role)) redirect("/app");

  const user = await getCurrentAdminUser();

  if (!user) {
    // The session validated but the account has since vanished. Rendering the
    // shell with no identity would be worse than treating it as signed out.
    unauthorized();
  }

  // Read here so the sidebar renders at its saved width on the first paint,
  // rather than flashing expanded and then collapsing after hydration.
  const cookieStore = await cookies();
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AdminShell
      user={user}
      capabilities={[...capabilitiesFor(session.role)]}
      logout={logoutAction}
      defaultCollapsed={collapsed}
    >
      {children}
    </AdminShell>
  );
}
