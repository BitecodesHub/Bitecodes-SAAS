import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { requireCapability } from "@/lib/server/auth/dal";
import { listDesktopLogs, LOG_RETENTION_DAYS } from "@/lib/server/desktop/logs";
import type {
  DesktopProviderId,
  DesktopRequestKind,
} from "@/lib/server/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Desktop prompt log" };
export const dynamic = "force-dynamic";

const PROVIDERS: DesktopProviderId[] = [
  "nvidia",
  "openrouter",
  "groq",
  "bedrock",
];
const KINDS: DesktopRequestKind[] = [
  "chat",
  "screenshot",
  "solution",
  "debug",
  "other",
];
const STATUS_LABEL = {
  ok: "answered",
  error: "failed",
  cancelled: "cancelled",
} as const;

/**
 * Every desktop request, newest first, with timestamps, the user, the full
 * prompt and answer, and which provider/model actually answered (plus every
 * provider tried on the way). Rows expire after the retention window.
 */
export default async function DesktopLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    provider?: string;
    kind?: string;
    before?: string;
    user?: string;
  }>;
}) {
  await requireCapability("view_desktop_prompts");
  const sp = await searchParams;
  const status =
    sp.status === "ok" || sp.status === "error" || sp.status === "cancelled"
      ? sp.status
      : undefined;
  const kind = KINDS.includes(sp.kind as DesktopRequestKind)
    ? (sp.kind as DesktopRequestKind)
    : undefined;
  const provider = PROVIDERS.includes(sp.provider as DesktopProviderId)
    ? (sp.provider as DesktopProviderId)
    : undefined;
  const { rows, nextBefore } = await listDesktopLogs({
    search: sp.q,
    status,
    provider,
    kind,
    before: sp.before,
    userId: sp.user,
    limit: 50,
  });

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      q: sp.q,
      status,
      provider,
      kind,
      user: sp.user,
      ...extra,
    }))
      if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/desktop"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Desktop app
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Prompt log</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Every request from the desktop app. Screenshots themselves are not
          stored, only that one was sent. Entries are kept for{" "}
          {LOG_RETENTION_DAYS} days.
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-2"
        action="/admin/desktop/logs"
      >
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search prompts and answers"
          className="w-72"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="ok">Answered</option>
          <option value="error">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          name="kind"
          defaultValue={kind ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          aria-label="Request type"
        >
          <option value="">All types</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          name="provider"
          defaultValue={provider ?? ""}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          aria-label="Provider"
        >
          <option value="">All providers</option>
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {sp.user && <input type="hidden" name="user" value={sp.user} />}
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {(sp.q || status || provider || kind || sp.user) && (
          <Button asChild variant="ghost">
            <Link href="/admin/desktop/logs">Clear</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No requests yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="bg-card rounded-lg border">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
                  <time
                    dateTime={r.createdAt.toISOString()}
                    className="text-muted-foreground w-44 shrink-0 tabular-nums"
                  >
                    {r.createdAt.toLocaleString("en-AU", {
                      dateStyle: "medium",
                      timeStyle: "medium",
                    })}
                  </time>
                  <Link
                    href={qs({ user: r.userId, before: undefined })}
                    className="font-medium hover:underline"
                  >
                    {r.userEmail ?? r.userName ?? r.userId}
                  </Link>
                  <Badge
                    variant={r.status === "ok" ? "secondary" : "muted"}
                    className={r.status === "error" ? "text-red-600" : ""}
                  >
                    {STATUS_LABEL[r.status]}
                  </Badge>
                  {r.kind && r.kind !== "screenshot" && (
                    <Badge variant="outline">{r.kind}</Badge>
                  )}
                  {r.hadImage && (
                    <Badge variant="outline">
                      <ImageIcon className="mr-1 size-3" aria-hidden="true" />
                      {r.imageCount > 1
                        ? `${r.imageCount} screenshots`
                        : "screenshot"}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    {r.provider ? `${r.provider} · ${r.model}` : "—"} ·{" "}
                    {(r.latencyMs / 1000).toFixed(1)}s
                    {r.ttftMs != null
                      ? ` · first token ${(r.ttftMs / 1000).toFixed(1)}s`
                      : ""}
                    {r.promptTokens != null
                      ? ` · ${r.promptTokens}+${r.completionTokens ?? 0} tok`
                      : ""}
                  </span>
                  {r.client && (
                    <span className="text-muted-foreground text-xs">
                      {r.client}
                    </span>
                  )}
                  <span className="text-muted-foreground w-full truncate">
                    {r.prompt.slice(0, 160)}
                  </span>
                </summary>
                <div className="space-y-4 border-t p-4 text-sm">
                  <section>
                    <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Prompt
                    </h3>
                    <pre className="bg-muted/40 max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                      {r.prompt}
                    </pre>
                  </section>
                  <section>
                    <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Answer
                    </h3>
                    <pre className="bg-muted/40 max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                      {r.response || "—"}
                    </pre>
                  </section>
                  {r.error && (
                    <p className="text-xs text-red-600">Error: {r.error}</p>
                  )}
                  {r.attempted.length > 0 && (
                    <section>
                      <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                        Providers tried
                      </h3>
                      <ol className="list-decimal space-y-0.5 pl-5 text-xs">
                        {r.attempted.map((a, i) => (
                          <li key={i}>
                            <span className="font-medium">
                              {a.provider} · {a.model}
                            </span>{" "}
                            — {a.outcome}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {nextBefore && (
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href={qs({ before: nextBefore })}>Older</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
