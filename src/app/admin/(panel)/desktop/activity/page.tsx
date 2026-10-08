import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import {
  desktopUsageByUser,
  EVENT_RETENTION_DAYS,
  listAllDevices,
  listDesktopEvents,
} from "@/lib/server/desktop/events";
import type { DesktopEventType } from "@/lib/server/db/types";
import { DesktopRevokeButton } from "@/components/admin/desktop-revoke-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Desktop users & activity" };
export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<DesktopEventType, string> = {
  pair_started: "Sign-in started",
  pair_approved: "Sign-in approved",
  pair_denied: "Sign-in denied",
  signed_in: "Signed in",
  signed_out: "Signed out",
  revoked_by_user: "Disconnected by user",
  revoked_by_admin: "Disconnected by admin",
  token_rejected: "Rejected token used",
};
const EVENT_TYPES = Object.keys(EVENT_LABEL) as DesktopEventType[];
const WARN: DesktopEventType[] = [
  "pair_denied",
  "revoked_by_admin",
  "token_rejected",
];

const fmt = (d: Date | null) =>
  d
    ? d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })
    : "—";
const n = (v: number) => v.toLocaleString("en-AU");

/**
 * Who uses the desktop app and how: per-user usage (30 days), every connected
 * device (with disconnect), and the full sign-in / sign-out / revocation
 * timeline. Prompts and answers are in the prompt log.
 */
export default async function DesktopActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; user?: string; before?: string }>;
}) {
  await requireCapability("manage_settings");
  const sp = await searchParams;
  const type = EVENT_TYPES.includes(sp.type as DesktopEventType)
    ? (sp.type as DesktopEventType)
    : undefined;
  const [usage, devices, events] = await Promise.all([
    desktopUsageByUser(30),
    listAllDevices(),
    listDesktopEvents({ type, userId: sp.user, before: sp.before, limit: 50 }),
  ]);

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ type, user: sp.user, ...extra }))
      if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  const th =
    "text-muted-foreground px-3 py-2 text-left text-xs font-medium whitespace-nowrap";
  const td = "px-3 py-2 align-top whitespace-nowrap";

  return (
    <div className="space-y-8">
      <Link
        href="/admin/desktop"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Desktop app
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Users &amp; activity
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Usage per user, every connected device, and each sign-in, sign-out and
          disconnection. IP addresses are stored only as hashes. Activity is
          kept for {EVENT_RETENTION_DAYS} days.
        </p>
      </header>

      <section aria-labelledby="usage-heading" className="space-y-3">
        <h2 id="usage-heading" className="font-semibold">
          Usage by user · last 30 days
        </h2>
        {usage.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
            No desktop users yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className={th}>User</th>
                  <th className={`${th} text-right`}>Requests</th>
                  <th className={`${th} text-right`}>Failed</th>
                  <th className={`${th} text-right`}>Screenshots</th>
                  <th className={`${th} text-right`}>Tokens in / out</th>
                  <th className={`${th} text-right`}>Avg time</th>
                  <th className={`${th} text-right`}>Devices</th>
                  <th className={th}>Last active</th>
                  <th className={th}>
                    <span className="sr-only">Links</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.userId} className="border-t">
                    <td className={td}>
                      <div className="font-medium">{u.email ?? u.userId}</div>
                      {u.name && (
                        <div className="text-muted-foreground text-xs">
                          {u.name}
                        </div>
                      )}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {n(u.requests)}
                    </td>
                    <td
                      className={`${td} text-right tabular-nums ${u.errors ? "text-red-600" : ""}`}
                    >
                      {n(u.errors)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {n(u.screenshots)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {n(u.promptTokens)} / {n(u.completionTokens)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {u.requests
                        ? `${(u.avgLatencyMs / 1000).toFixed(1)}s`
                        : "—"}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {u.activeDevices}
                    </td>
                    <td className={`${td} text-muted-foreground`}>
                      {fmt(u.lastActiveAt)}
                    </td>
                    <td className={`${td} space-x-3 text-xs`}>
                      <Link
                        className="hover:underline"
                        href={`/admin/desktop/logs?user=${u.userId}`}
                      >
                        Prompts
                      </Link>
                      <Link
                        className="hover:underline"
                        href={qs({ user: u.userId, before: undefined })}
                      >
                        Activity
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="devices-heading" className="space-y-3">
        <h2 id="devices-heading" className="font-semibold">
          Connected devices ({devices.length})
        </h2>
        {devices.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
            No devices are connected.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className={th}>Device</th>
                  <th className={th}>User</th>
                  <th className={th}>App build</th>
                  <th className={th}>Connected</th>
                  <th className={th}>Last used</th>
                  <th className={th}>Expires</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className={`${td} font-medium`}>{d.label}</td>
                    <td className={td}>{d.userEmail ?? d.userId}</td>
                    <td className={`${td} text-muted-foreground text-xs`}>
                      {d.lastClient ?? "—"}
                    </td>
                    <td className={`${td} text-muted-foreground`}>
                      {fmt(d.createdAt)}
                    </td>
                    <td className={`${td} text-muted-foreground`}>
                      {fmt(d.lastUsedAt)}
                    </td>
                    <td className={`${td} text-muted-foreground`}>
                      {fmt(d.expiresAt)}
                    </td>
                    <td className={td}>
                      <DesktopRevokeButton
                        id={d.id}
                        label={d.label}
                        user={d.userEmail ?? d.userId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="events-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="events-heading" className="font-semibold">
            Activity timeline
          </h2>
          <form
            className="flex flex-wrap items-end gap-2"
            action="/admin/desktop/activity"
          >
            <select
              name="type"
              defaultValue={type ?? ""}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              aria-label="Event type"
            >
              <option value="">All events</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_LABEL[t]}
                </option>
              ))}
            </select>
            {sp.user && <input type="hidden" name="user" value={sp.user} />}
            <Button type="submit" variant="outline">
              Filter
            </Button>
            {(type || sp.user) && (
              <Button asChild variant="ghost">
                <Link href="/admin/desktop/activity">Clear</Link>
              </Button>
            )}
          </form>
        </div>
        {events.rows.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
            No activity yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className={th}>Time</th>
                  <th className={th}>Event</th>
                  <th className={th}>User</th>
                  <th className={th}>Device</th>
                  <th className={th}>App build</th>
                  <th className={th}>IP (hashed)</th>
                </tr>
              </thead>
              <tbody>
                {events.rows.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className={`${td} text-muted-foreground tabular-nums`}>
                      <time dateTime={e.createdAt.toISOString()}>
                        {e.createdAt.toLocaleString("en-AU", {
                          dateStyle: "medium",
                          timeStyle: "medium",
                        })}
                      </time>
                    </td>
                    <td className={td}>
                      <Badge
                        variant={WARN.includes(e.type) ? "muted" : "secondary"}
                        className={WARN.includes(e.type) ? "text-red-600" : ""}
                      >
                        {EVENT_LABEL[e.type]}
                      </Badge>
                      {e.actorEmail && (
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          by {e.actorEmail}
                        </div>
                      )}
                    </td>
                    <td className={td}>
                      {e.userId ? (
                        <Link
                          className="hover:underline"
                          href={qs({ user: e.userId, before: undefined })}
                        >
                          {e.userEmail ?? e.userId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={td}>{e.label ?? "—"}</td>
                    <td className={`${td} text-muted-foreground text-xs`}>
                      {e.client ?? "—"}
                    </td>
                    <td
                      className={`${td} text-muted-foreground font-mono text-xs`}
                    >
                      {e.ipHash ? e.ipHash.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {events.nextBefore && (
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href={qs({ before: events.nextBefore })}>Older</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
