import type { AuditLogDoc } from "@/lib/server/db/types";

/**
 * Recent admin activity, from the audit log.
 *
 * Action keys are dotted identifiers (`email.approved`), which are precise but
 * unfriendly, so they are mapped to sentences here. An unmapped key falls back to
 * the raw identifier rather than being hidden: an action nobody labelled is still
 * something an operator needs to see.
 */

const ACTION_LABELS: Record<string, string> = {
  "auth.login.succeeded": "signed in",
  "auth.login.failed": "failed to sign in",
  "auth.login.locked": "was locked out after failed attempts",
  "auth.logout": "signed out",
  "auth.password.changed": "changed their password",
  "auth.2fa.enabled": "enabled two-factor authentication",
  "auth.2fa.disabled": "disabled two-factor authentication",
  "auth.session.revoked": "revoked a session",
  "settings.updated": "updated settings",
  "lead.status.changed": "changed a lead's status",
  "lead.note.added": "added a note to a lead",
  "lead.assigned": "assigned a lead",
  "lead.replied": "replied to a lead",
  "prospect.discovery.started": "started map discovery",
  "prospect.imported": "imported prospects",
  "prospect.tagged": "tagged prospects",
  "prospect.status.changed": "changed a prospect's status",
  "prospect.suppressed": "suppressed prospects",
  "email.approved": "approved outreach",
  "email.cancelled": "cancelled queued email",
  "email.template.updated": "updated an email template",
  "email.test.sent": "sent a test email",
  "email.sequence.enrolled": "enrolled prospects in a sequence",
  "email.suppression.added": "added a suppression",
  "email.suppression.removed": "removed a suppression",
  "blog.post.created": "created a post",
  "blog.post.updated": "updated a post",
  "blog.post.published": "published a post",
  "blog.post.unpublished": "unpublished a post",
  "blog.post.deleted": "deleted a post",
  "blog.ai.draft": "generated an AI draft",
  "job.retried": "retried a job",
  "job.cancelled": "cancelled a job",
  "user.invited": "invited a team member",
  "user.role.changed": "changed a team member's role",
  "user.disabled": "disabled an account",
  "user.enabled": "re-enabled an account",
  "chat.knowledge.updated": "updated the chatbot knowledge base",
  "chat.resolved": "resolved a chat question",
};

export function ActivityFeed({ entries }: { entries: AuditLogDoc[] }) {
  return (
    <section
      aria-labelledby="activity-heading"
      className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
    >
      <h2 id="activity-heading" className="font-semibold tracking-tight">
        Recent activity
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Every admin action is recorded.
      </p>

      {entries.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Nothing recorded yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {entries.map((entry, index) => (
            <li
              key={entry._id?.toHexString() ?? index}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <p className="min-w-0 leading-relaxed">
                <span className="font-medium">
                  {entry.actorEmail ?? "System"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
              </p>
              <time
                dateTime={entry.createdAt.toISOString()}
                className="text-muted-foreground shrink-0 text-xs [font-variant-numeric:tabular-nums]"
              >
                {formatRelative(entry.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Relative time, computed on the server.
 *
 * Server-rendered on purpose: this page is `force-dynamic`, so the value is
 * fresh on every load, and doing it here avoids a hydration mismatch between the
 * server's clock and the browser's.
 */
function formatRelative(date: Date, now = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;

  return date.toISOString().slice(0, 10);
}
