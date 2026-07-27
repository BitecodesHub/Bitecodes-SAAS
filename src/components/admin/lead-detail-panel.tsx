"use client";

import { useCallback, useState, useTransition } from "react";
import { Loader2, Send, StickyNote, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/leads/display";
import {
  addLeadNoteAction,
  assignLeadAction,
  replyToLeadAction,
  setLeadStatusAction,
} from "@/lib/server/leads/actions";
import type { LeadStatus } from "@/lib/server/db/types";

/**
 * Actions for one lead: stage, assignment, reply, notes.
 *
 * The reply box is the point of this panel. Answering from here rather than from
 * a mail client means the reply is logged against the lead, the stage advances,
 * and suppression is respected — none of which happens when an operator replies
 * out of band and forgets to record it.
 */

interface TeamMember {
  id: string;
  name: string;
}

interface LeadDetailPanelProps {
  kind: string;
  id: string;
  status: LeadStatus;
  email: string | null;
  name: string | null;
  assignedToId: string | null;
  team: TeamMember[];
  canEmail: boolean;
  /** Pre-filled subject, derived from the lead on the server. */
  defaultSubject: string;
}

export function LeadDetailPanel({
  kind,
  id,
  status,
  email,
  name,
  assignedToId,
  team,
  canEmail,
  defaultSubject,
}: LeadDetailPanelProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");

  const notify = useCallback(
    (ok: boolean, title: string, description?: string) => {
      toast({ title, description, variant: ok ? "success" : "error" });
    },
    [toast],
  );

  const changeStatus = useCallback(
    (next: string) => {
      if (!next || next === status) return;
      startTransition(async () => {
        const result = await setLeadStatusAction(kind, [id], next);
        notify(
          result.ok,
          result.ok
            ? `Moved to ${LEAD_STATUS_LABELS[next as LeadStatus]}`
            : "Could not change the stage",
          result.ok ? undefined : result.error,
        );
      });
    },
    [kind, id, status, notify],
  );

  const changeAssignee = useCallback(
    (next: string) => {
      startTransition(async () => {
        const result = await assignLeadAction(kind, id, next || null);
        notify(
          result.ok,
          result.ok ? "Assignment updated" : "Could not assign",
          result.ok ? undefined : result.error,
        );
      });
    },
    [kind, id, notify],
  );

  const sendReply = useCallback(() => {
    startTransition(async () => {
      const result = await replyToLeadAction(kind, id, subject, body);
      if (!result.ok) {
        notify(false, "Reply not sent", result.error);
        return;
      }
      setBody("");
      notify(
        true,
        "Reply queued",
        "It is logged against this lead and leaves within moments.",
      );
    });
  }, [kind, id, subject, body, notify]);

  const saveNote = useCallback(() => {
    if (note.trim().length === 0) return;
    startTransition(async () => {
      const result = await addLeadNoteAction(kind, id, note);
      if (result.ok) setNote("");
      notify(
        result.ok,
        result.ok ? "Note added" : "Could not add the note",
        result.ok ? undefined : result.error,
      );
    });
  }, [kind, id, note, notify]);

  return (
    <aside className="space-y-4">
      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Pipeline</h2>

        <div className="space-y-1.5">
          <Label htmlFor="lead-status">Stage</Label>
          <Select
            id="lead-status"
            defaultValue={status}
            disabled={pending}
            onChange={(event) => changeStatus(event.target.value)}
          >
            {LEAD_STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {LEAD_STATUS_LABELS[entry]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lead-assignee">Owner</Label>
          <Select
            id="lead-assignee"
            defaultValue={assignedToId ?? ""}
            disabled={pending}
            onChange={(event) => changeAssignee(event.target.value)}
          >
            <option value="">Unassigned</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <UserCheck className="size-3" />
            An owner makes it obvious who is answering.
          </p>
        </div>
      </section>

      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Reply</h2>

        {!email ? (
          <p className="text-muted-foreground text-sm">
            This lead left no email address, so there is nobody to reply to.
          </p>
        ) : !canEmail ? (
          <p className="text-muted-foreground text-sm">
            Your role cannot send email.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              To {name ? `${name} · ` : ""}
              {email}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="reply-subject">Subject</Label>
              <Input
                id="reply-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reply-body">Message</Label>
              <Textarea
                id="reply-body"
                rows={8}
                value={body}
                placeholder={`Hi ${name?.split(" ")[0] ?? "there"},\n\nThanks for getting in touch…`}
                onChange={(event) => setBody(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Leave a blank line between paragraphs. The reply is logged here
                and counts as contact.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={pending || body.trim().length < 10}
              onClick={sendReply}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Send reply
            </Button>
          </>
        )}
      </section>

      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Add a note</h2>
        <Textarea
          value={note}
          rows={4}
          aria-label="Note"
          placeholder="What was discussed, what happens next…"
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
