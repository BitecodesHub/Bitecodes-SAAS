import "server-only";

import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/server/auth/dal";
import { isCustomerRole } from "@/lib/server/auth/roles";

/**
 * Skips the sign-in form for somebody who is genuinely already signed in.
 *
 * The word doing the work is *genuinely*. `proxy` cannot make this decision:
 * it sees only whether a cookie exists, and an expired, revoked or
 * epoch-invalidated cookie still exists. Redirecting on presence sent people
 * with dead sessions to a dashboard that refused them, whose 401 offered "Sign
 * in", which redirected them back — a loop that only clearing cookies escaped.
 *
 * Here the session is validated against the database first, so a dead cookie
 * simply falls through and the form renders, which is the one thing that person
 * actually needs.
 *
 * The cost is one indexed lookup on a page nobody loads in a hot path.
 */
export async function redirectIfSignedIn(): Promise<void> {
  const session = await getAdminSession();
  if (!session) return;
  redirect(isCustomerRole(session.role) ? "/app" : "/admin");
}
