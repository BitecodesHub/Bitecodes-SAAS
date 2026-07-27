import "server-only";

import { cache } from "react";
import { forbidden, unauthorized } from "next/navigation";
import { ObjectId } from "mongodb";
import { adminUsers } from "@/lib/server/db/collections";
import type { AdminRole } from "@/lib/server/db/types";
import { readAdminSession } from "@/lib/server/auth/session";
import { can, type Capability } from "@/lib/server/auth/roles";

/**
 * The admin data-access layer.
 *
 * Every admin page, Server Action, and route handler authorises through here.
 * The point of a single choke-point is that adding a new admin screen cannot
 * accidentally ship without an auth check — there is no other way to learn who
 * the current user is.
 *
 * `proxy.ts` also checks for a session cookie, but that is only an optimistic
 * pre-filter to avoid rendering the shell for signed-out visitors. It reads the
 * cookie's *presence*, never its validity, so it is not a security boundary.
 * These functions are.
 *
 * Wrapped in React's `cache` so a page that authorises in the layout, the page,
 * and three leaf components performs one database round trip per request rather
 * than five.
 */

export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  twoFactorEnabled: boolean;
}

/** The current session, or null. Use when signed-out is a valid state. */
export const getAdminSession = cache(async () => readAdminSession());

/**
 * Requires a signed-in admin.
 *
 * Calls `unauthorized()` rather than `redirect()`, so Next renders
 * `admin/unauthorized.tsx` with a real 401 status. A redirect to the sign-in
 * page would return 200 for a page the caller was not allowed to see, which
 * misleads both crawlers and any API client.
 */
export const requireAdminSession = cache(async () => {
  const session = await getAdminSession();
  if (!session) unauthorized();
  return session;
});

/**
 * Requires a capability. Renders `admin/forbidden.tsx` with a 403 when the user
 * is signed in but not permitted — deliberately distinct from 401, so an
 * operator sees "you cannot do this" rather than "sign in again".
 */
export async function requireCapability(capability: Capability) {
  const session = await requireAdminSession();
  if (!can(session.role, capability)) forbidden();
  return session;
}

/** True when the current user holds a capability. For conditional UI. */
export async function hasCapability(capability: Capability): Promise<boolean> {
  const session = await getAdminSession();
  return session ? can(session.role, capability) : false;
}

/**
 * The signed-in user as a DTO.
 *
 * Explicitly projected rather than returning the document: `passwordHash` and
 * `totpSecret` live on the same record, and a whole-document return would be one
 * careless `JSON.stringify` away from serialising them into a client component's
 * props.
 */
export const getCurrentAdminUser = cache(
  async (): Promise<AdminUserDto | null> => {
    const session = await getAdminSession();
    if (!session) return null;

    try {
      const users = await adminUsers();
      const user = await users.findOne(
        { _id: new ObjectId(session.userId) },
        { projection: { email: 1, name: 1, role: 1, totpEnabledAt: 1 } },
      );
      if (!user) return null;

      return {
        id: session.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        twoFactorEnabled: Boolean(user.totpEnabledAt),
      };
    } catch {
      return null;
    }
  },
);

/**
 * Asserts a capability inside a Server Action.
 *
 * Throws instead of calling `forbidden()`: an interrupt inside an action would
 * try to render an error page in place of returning a result the form can show.
 * Server Actions are public endpoints — the fact that the button was hidden in
 * the UI is not a check.
 */
export async function assertCapability(capability: Capability): Promise<{
  userId: string;
  role: AdminRole;
}> {
  const session = await getAdminSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  if (!can(session.role, capability)) throw new Error("FORBIDDEN");
  return session;
}
