import type { Metadata } from "next";
import { forbidden, unauthorized } from "next/navigation";
import {
  getCurrentAdminUser,
  requireAdminSession,
} from "@/lib/server/auth/dal";
import { can } from "@/lib/server/auth/roles";
import { logoutAction } from "@/lib/server/auth/actions";
import { AppShell } from "@/components/account/app-shell";

/**
 * The customer dashboard layout.
 *
 * Authorises before rendering anything, but a layout is **not** a sufficient
 * auth boundary on its own: Next does not re-run layouts on every client-side
 * navigation, and a Server Action can be invoked with no layout rendering at
 * all. Every page and action therefore repeats its own check through the
 * data-access layer. The check here exists so a signed-out visitor never sees
 * the shell.
 *
 * The capability asserted is `manage_chatbots`, which every account that belongs
 * in this area holds — customers by their role, staff by theirs. It is not the
 * gate on the pages inside; those assert their own.
 *
 * Lives in a `(dash)` route group so that `unauthorized.tsx` and `forbidden.tsx`
 * sit in the segment ABOVE it. A boundary file beside a layout does not catch
 * that layout's own interrupt — the same reason the admin panel's boundaries
 * live outside its `(panel)` group. Placed alongside, `unauthorized()` fell
 * through to Next's built-in 401, which is a bare status message with no way
 * back to the sign-in page.
 */
export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s — Bitecodes" },
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();

  // An editor or viewer has no product permissions at all, so this area would
  // render an empty shell over pages that each refuse them. Saying so once, in
  // the right status code, beats seven identical 403s.
  if (!can(session.role, "manage_chatbots")) forbidden();

  const user = await getCurrentAdminUser();
  if (!user) {
    // The session validated but the account has since vanished. Rendering the
    // shell with no identity would be worse than treating it as signed out.
    unauthorized();
  }

  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      logout={logoutAction}
    >
      {children}
    </AppShell>
  );
}
