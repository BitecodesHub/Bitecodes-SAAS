import type { Metadata } from "next";
import { requireCapability, getCurrentAdminUser } from "@/lib/server/auth/dal";
import { listAdminUsers } from "@/lib/server/auth/users";
import { TeamManager } from "@/components/admin/team-manager";

export const metadata: Metadata = { title: "Team" };

export const dynamic = "force-dynamic";

/**
 * Team accounts.
 *
 * `manage_users` is owner-only, so this is where an owner hires someone and
 * hands them exactly the access their job needs — an editor for content, an
 * admin for sales and marketing operations, a viewer for a read-only stake.
 */
export default async function TeamPage() {
  await requireCapability("manage_users");

  const [members, current] = await Promise.all([
    listAdminUsers(),
    getCurrentAdminUser(),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Add the people who work your leads, run outreach, or write content,
          and give each of them only the access their role needs. New accounts
          get a one-time password to change on first sign-in.
        </p>
      </header>

      <TeamManager members={members} currentUserId={current?.id ?? ""} />
    </div>
  );
}
