"use client";

import { useCallback, useState, useTransition } from "react";
import {
  Check,
  Copy,
  FileText,
  Loader2,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  PROSPECT_PIPELINE,
  PROSPECT_STATUS_LABELS,
} from "@/lib/prospecting/display";
import {
  addProspectNoteAction,
  createReportLinkAction,
  enrichProspectsAction,
  setProspectEmailAction,
  setProspectStatusAction,
  tagProspectsAction,
} from "@/lib/server/prospecting/actions";
import type { ProspectDoc, ProspectStatus } from "@/lib/server/db/types";

/**
 * The per-customer action column.
 *
 * Everything an operator does to one prospect, in the order they do it: confirm
 * the address to write to, move the stage, get the personalised report link,
 * leave a note. The panel refreshes the page after each change rather than
 * mutating local state, so what is on screen always matches the database — with
 * background enrichment running, optimistic UI here would routinely lie.
 */

interface ProspectDetailPanelProps {
  prospectId: string;
  email: string | null;
  emailSource: ProspectDoc["emailSource"];
  status: ProspectStatus;
  canReport: boolean;
  contactCount: number;
  lastContactedAt: string | null;
  tags: string[];
}

const EMAIL_SOURCE_LABELS: Record<string, string> = {
  provider: "from the map data",
  website: "found on their website",
  manual: "entered by hand",
};

export function ProspectDetailPanel({
  prospectId,
  email,
  emailSource,
  status,
  canReport,
  contactCount,
  lastContactedAt,
  tags,
}: ProspectDetailPanelProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [emailValue, setEmailValue] = useState(email ?? "");
  const [note, setNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const notify = useCallback(
    (ok: boolean, title: string, description?: string) => {
      toast({
        title,
        description,
        variant: ok ? "success" : "error",
      });
    },
    [toast],
  );

  const saveEmail = useCallback(() => {
    startTransition(async () => {
      const result = await setProspectEmailAction(prospectId, emailValue);
      notify(
        result.ok,
        result.ok ? "Email saved" : "Could not save the email",
        result.ok ? undefined : result.error,
      );
    });
  }, [prospectId, emailValue, notify]);

  const changeStatus = useCallback(
    (next: string) => {
      if (!next || next === status) return;
      startTransition(async () => {
        const result = await setProspectStatusAction([prospectId], next);
        notify(
          result.ok,
          result.ok
            ? `Moved to ${PROSPECT_STATUS_LABELS[next as ProspectStatus]}`
            : "Could not change the stage",
          result.ok ? undefined : result.error,
        );
      });
    },
    [prospectId, status, notify],
  );

  const recheck = useCallback(() => {
    startTransition(async () => {
      const result = await enrichProspectsAction([prospectId]);
      notify(
        result.ok,
        result.ok ? "Re-checking the website" : "Could not re-check",
        result.ok
          ? "The audit runs in the background; refresh in a moment."
          : result.error,
      );
    });
  }, [prospectId, notify]);

  const makeReport = useCallback(() => {
    startTransition(async () => {
      const result = await createReportLinkAction(prospectId);
      if (!result.ok) {
        notify(false, "Could not create the link", result.error);
        return;
      }
      setReportUrl(result.data.url);
      setCopied(false);
    });
  }, [prospectId, notify]);

  const copyReport = useCallback(async () => {
    if (!reportUrl) return;
    try {
      await navigator.clipboard.writeText(reportUrl);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the input below is selectable, so the
      // link is still obtainable without it.
      notify(false, "Could not copy", "Select the link and copy it manually.");
    }
  }, [reportUrl, notify]);

  const saveNote = useCallback(() => {
    if (note.trim().length === 0) return;
    startTransition(async () => {
      const result = await addProspectNoteAction(prospectId, note);
      if (result.ok) setNote("");
      notify(
        result.ok,
        result.ok ? "Note added" : "Could not add the note",
        result.ok ? undefined : result.error,
      );
    });
  }, [prospectId, note, notify]);

  const addTag = useCallback(() => {
    if (newTag.trim().length === 0) return;
    startTransition(async () => {
      const result = await tagProspectsAction([prospectId], [newTag]);
      if (result.ok) setNewTag("");
      notify(
        result.ok,
        result.ok ? "Tag added" : "Could not add the tag",
        result.ok ? undefined : result.error,
      );
    });
  }, [prospectId, newTag, notify]);

  return (
    <aside className="space-y-4">
      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Contact</h2>

        <div className="space-y-1.5">
          <Label htmlFor="prospect-email">Email address</Label>
          <Input
            id="prospect-email"
            type="email"
            value={emailValue}
            placeholder="Not known yet"
            onChange={(event) => setEmailValue(event.target.value)}
          />
          {email && emailSource && (
            <p className="text-muted-foreground text-xs">
              Currently {EMAIL_SOURCE_LABELS[emailSource] ?? emailSource}.
            </p>
          )}
          {!email && (
            <p className="text-muted-foreground text-xs">
              Without an address this customer cannot be emailed. Their phone
              number is in the header.
            </p>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || emailValue === (email ?? "")}
          onClick={saveEmail}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save email
        </Button>
      </section>

      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Pipeline</h2>

        <div className="space-y-1.5">
          <Label htmlFor="prospect-status">Stage</Label>
          <Select
            id="prospect-status"
            defaultValue={status}
            disabled={pending}
            onChange={(event) => changeStatus(event.target.value)}
          >
            {PROSPECT_PIPELINE.map((entry) => (
              <option key={entry} value={entry}>
                {PROSPECT_STATUS_LABELS[entry]}
              </option>
            ))}
          </Select>
        </div>

        <p className="text-muted-foreground text-xs">
          {contactCount === 0
            ? "Not contacted yet."
            : `Emailed ${contactCount} time${contactCount === 1 ? "" : "s"}${
                lastContactedAt
                  ? `, last on ${new Date(lastContactedAt).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}`
                  : ""
              }.`}
        </p>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={recheck}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Re-check website
        </Button>
      </section>

      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Personalised report</h2>
        <p className="text-muted-foreground text-xs leading-relaxed">
          A private page showing this business what the check found, with a way
          to reply. This link is what an outreach email should point at.
        </p>

        {reportUrl ? (
          <div className="space-y-2">
            <Input
              readOnly
              value={reportUrl}
              onFocus={(e) => e.target.select()}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={copyReport}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a href={reportUrl} target="_blank" rel="noopener noreferrer">
                  Preview
                </a>
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Expires in ninety days and is not indexable.
            </p>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={pending || !canReport}
            onClick={makeReport}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Create report link
          </Button>
        )}

        {!canReport && (
          <p className="text-muted-foreground text-xs">
            Available once the website check has produced a verdict.
          </p>
        )}
      </section>

      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Your tags</h2>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="muted">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">No tags yet.</p>
        )}
        <div className="flex gap-2">
          <Input
            value={newTag}
            placeholder="Add a tag"
            aria-label="Add a tag"
            onChange={(event) => setNewTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || newTag.trim().length === 0}
            onClick={addTag}
          >
            Add
          </Button>
        </div>
      </section>

      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Add a note</h2>
        <Textarea
          value={note}
          rows={4}
          placeholder="What was said, what to do next…"
          aria-label="Note"
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || note.trim().length === 0}
          onClick={saveNote}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <StickyNote className="size-4" />
          )}
          Save note
        </Button>
      </section>
    </aside>
  );
}
