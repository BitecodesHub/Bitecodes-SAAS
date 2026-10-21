"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarClock,
  FileText,
  Loader2,
  Mail,
  MailPlus,
  Send,
  StickyNote,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadStage,
} from "@/lib/leads/display";
import {
  addLeadNoteAction,
  assignLeadAction,
  enrollLeadAction,
  replyToLeadAction,
  setLeadNextActionAction,
  setLeadOwnerNotesAction,
  setLeadStageAction,
} from "@/lib/server/leads/actions";

/**
 * Actions for one lead: stage, owner, next action, reply, notes, and the
 * inbound follow-up sequence.
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
  stage: LeadStage;
  email: string | null;
  name: string | null;
  assignedToId: string | null;
  team: TeamMember[];
  canEmail: boolean;
  /** Pre-filled subject, derived from the lead on the server. */
  defaultSubject: string;
  readOnly: boolean;
  nextAction: string | null;
  /** YYYY-MM-DD for the date input. */
  nextActionDate: string;
  ownerNotes: string;
  consentMarketing: boolean;
  enrolled: boolean;
}

export function LeadDetailPanel({
  kind,
  id,
  stage,
  email,
  name,
  assignedToId,
  team,
  canEmail,
  defaultSubject,
  readOnly,
  nextAction,
  nextActionDate,
  ownerNotes,
  consentMarketing,
  enrolled,
}: LeadDetailPanelProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [action, setAction] = useState(nextAction ?? "");
  const [actionDate, setActionDate] = useState(nextActionDate);
  const [privateNotes, setPrivateNotes] = useState(ownerNotes);

  const notify = useCallback(
    (ok: boolean, title: string, description?: string) => {
      toast({ title, description, variant: ok ? "success" : "error" });
    },
    [toast],
  );

  const changeStage = useCallback(
    (next: string) => {
      if (!next || next === stage) return;
      startTransition(async () => {
        const result = await setLeadStageAction(kind, [id], next);
        notify(
          result.ok,
          result.ok
            ? `Moved to ${LEAD_STAGE_LABELS[next as LeadStage]}`
            : "Could not change the stage",
          result.ok ? undefined : result.error,
        );
      });
    },
    [kind, id, stage, notify],
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

  const saveNextAction = useCallback(() => {
    startTransition(async () => {
      const result = await setLeadNextActionAction(
        kind,
        id,
        action,
        actionDate,
      );
      notify(
        result.ok,
        result.ok ? "Next action saved" : "Could not save the next action",
        result.ok ? undefined : result.error,
      );
    });
  }, [kind, id, action, actionDate, notify]);

  const saveOwnerNotes = useCallback(() => {
    startTransition(async () => {
      const result = await setLeadOwnerNotesAction(kind, id, privateNotes);
      notify(
        result.ok,
        result.ok ? "Owner notes saved" : "Could not save notes",
        result.ok ? undefined : result.error,
      );
    });
  }, [kind, id, privateNotes, notify]);

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

  const enroll = useCallback(() => {
    startTransition(async () => {
      const result = await enrollLeadAction(kind, id);
      notify(
        result.ok,
        result.ok
          ? result.data.alreadyEnrolled
            ? "Already in the follow-up sequence"
            : "Follow-up sequence started"
          : "Could not start the sequence",
        result.ok ? undefined : result.error,
      );
    });
  }, [kind, id, notify]);

  if (readOnly) {
    return (
      <aside className="space-y-4">
        <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Read-only record</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This came from a staff-owned form or booking. It appears here so the
            enquiry is not missed, but it stays under the product that owns it —
            editing it from the CRM would risk changing a customer&apos;s
            records.
          </p>
        </section>
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Pipeline</h2>

        <div className="space-y-1.5">
          <Label htmlFor="lead-stage">Stage</Label>
          <Select
            id="lead-stage"
            defaultValue={stage}
            disabled={pending}
            onChange={(event) => changeStage(event.target.value)}
          >
            {LEAD_STAGES.map((entry) => (
              <option key={entry} value={entry}>
                {LEAD_STAGE_LABELS[entry]}
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

        <div className="grid gap-2 pt-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/proposals/new?lead=${kind}:${id}`}>
              <FileText className="size-4" />
              Create proposal
            </Link>
          </Button>
          {consentMarketing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || enrolled}
              onClick={enroll}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MailPlus className="size-4" />
              )}
              {enrolled ? "In follow-up sequence" : "Start follow-up sequence"}
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              No marketing opt-in, so automated follow-up is unavailable.
            </p>
          )}
        </div>
      </section>

      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="size-4" />
          Next action
        </h2>
        <Input
          value={action}
          aria-label="Next action"
          placeholder="Send the scoped proposal"
          onChange={(event) => setAction(event.target.value)}
        />
        <div className="flex gap-2">
          <Input
            type="date"
            value={actionDate}
            aria-label="Next action date"
            onChange={(event) => setActionDate(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={saveNextAction}
          >
            Save
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          A dated next step is what separates a pipeline from a list.
        </p>
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

      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Mail className="size-4" />
          Owner notes
        </h2>
        <Textarea
          value={privateNotes}
          rows={5}
          aria-label="Owner notes"
          placeholder="Context that is not part of the client-visible timeline."
          onChange={(event) => setPrivateNotes(event.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={saveOwnerNotes}
        >
          Save notes
        </Button>
      </section>
    </aside>
  );
}
