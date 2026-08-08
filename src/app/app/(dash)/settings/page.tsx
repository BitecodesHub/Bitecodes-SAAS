import type { Metadata } from "next";
import { ObjectId } from "mongodb";
import { requireAdminSession } from "@/lib/server/auth/dal";
import { listActiveSessions, SESSION_COOKIE } from "@/lib/server/auth/session";
import { adminUsers } from "@/lib/server/db/collections";
import { sha256Hex } from "@/lib/server/crypto";
import { cookies } from "next/headers";
import {
  AccountSettings,
  type SessionRow,
} from "@/components/account/account-settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AppSettingsPage() {
  const session = await requireAdminSession();

  const [user, sessions, cookieStore] = await Promise.all([
    (await adminUsers()).findOne(
      { _id: new ObjectId(session.userId) },
      // Explicitly projected. `passwordHash` and `totpSecret` live on the same
      // record and must never reach a client component's props.
      { projection: { name: 1, email: 1, company: 1 } },
    ),
    listActiveSessions(session.userId),
    cookies(),
  ]);

  // Which row is this browser. Compared by hash because the plaintext token is
  // never stored — the same comparison the session lookup itself makes.
  const currentHash = (() => {
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    return token ? sha256Hex(token) : null;
  })();

  const rows: SessionRow[] = sessions.map((row) => ({
    id: row._id?.toHexString() ?? "",
    userAgent: row.userAgent,
    createdAtIso: new Date(row.createdAt).toISOString(),
    lastSeenAtIso: new Date(row.lastSeenAt).toISOString(),
    // `listActiveSessions` projects the token hash away, so the comparison is
    // done on the document it did return: `_id` is stable, and the current
    // session is found by matching the hash against the one row that has it.
    current: false,
  }));

  // Resolved separately, because the projection above deliberately drops the
  // hash. One extra lookup, scoped to this user, rather than widening a
  // projection that exists to keep token hashes out of memory.
  if (currentHash) {
    const { adminSessions } = await import("@/lib/server/db/collections");
    const mine = await (
      await adminSessions()
    ).findOne(
      { tokenHash: currentHash, userId: session.userId },
      { projection: { _id: 1 } },
    );
    const id = mine?._id?.toHexString();
    if (id) {
      const match = rows.find((row) => row.id === id);
      if (match) match.current = true;
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your details, your password, and the devices you are signed in on.
        </p>
      </header>

      <AccountSettings
        name={user?.name ?? ""}
        company={user?.company ?? ""}
        email={user?.email ?? ""}
        sessions={rows}
      />
    </div>
  );
}
