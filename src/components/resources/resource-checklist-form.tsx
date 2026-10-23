"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackConversion } from "@/lib/analytics-client";
import { captureAttribution } from "@/lib/attribution";
import {
  RESOURCE_FOLLOW_UP_CONSENT_TEXT,
  RESOURCE_NEWSLETTER_CONSENT_TEXT,
} from "@/lib/resources";

interface ChecklistResponse {
  ok: boolean;
  message?: string;
  checklist?: { title: string; items: string[] };
  resource?: { title: string; slug: string };
  newsletter?: string;
}

/**
 * The gated printable checklist.
 *
 * The guide around it stays ungated. This form exchanges an address for a
 * print-ready version and shows the result immediately; the email address is
 * never a condition of seeing the checklist after the request is accepted.
 */
export function ResourceChecklistForm({
  slug,
  resourceTitle,
  checklistTitle,
  itemCount,
}: {
  slug: string;
  resourceTitle: string;
  checklistTitle: string;
  itemCount: number;
}) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [followUp, setFollowUp] = React.useState(false);
  const [newsletter, setNewsletter] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [result, setResult] = React.useState<ChecklistResponse>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    try {
      const response = await fetch("/api/resources/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          email,
          name,
          followUp,
          newsletter,
          attribution: captureAttribution(),
        }),
      });
      const payload = (await response.json()) as ChecklistResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "The checklist is unavailable.");
      }
      setResult(payload);
      trackConversion("lead_magnet", `/resources/${slug}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The checklist is unavailable.",
      );
    } finally {
      setPending(false);
    }
  }

  function printChecklist() {
    const checklist = result?.checklist;
    if (!checklist) return;
    const popup = window.open("", "_blank", "width=860,height=900");
    if (!popup) return;
    popup.opener = null;

    // A tiny self-contained document prints the checklist without the site
    // header, consent form, or any layout that would waste a page.
    const items = checklist.items
      .map((item) => `<li><span class="box"></span>${escapeHtml(item)}</li>`)
      .join("");
    popup.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(checklist.title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; margin: 40px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p { color: #555; margin: 0 0 24px; font-size: 13px; }
  ol { padding-left: 0; list-style: none; }
  li { margin-bottom: 10px; padding-left: 0; }
  .box { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #333; margin-right: 8px; vertical-align: -2px; border-radius: 3px; }
  @page { margin: 18mm; }
</style>
</head>
<body>
<h1>${escapeHtml(checklist.title)}</h1>
<p>${escapeHtml(resourceTitle)} · ${checklist.items.length} items · Bitecodes</p>
<ol>${items}</ol>
</body>
</html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  if (result?.checklist) {
    return (
      <section
        aria-live="polite"
        className="bg-surface-2 rounded-[24px] p-6 sm:p-7"
        data-track="resource-checklist-unlocked"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-[19px] font-semibold tracking-[-0.01em]">
              {result.checklist.title}
            </h3>
            <p className="text-muted-foreground mt-1 text-[14px] leading-[1.55]">
              {result.checklist.items.length} items. Print it or keep this page
              open while you work through them.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={printChecklist}
            data-track="resource-checklist-print"
          >
            <Printer className="size-4" />
            Print checklist
          </Button>
        </div>
        <ul className="mt-5 space-y-3">
          {result.checklist.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 text-[15px] leading-[1.6]"
            >
              <span className="bg-background mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[7px]">
                <Check className="text-primary size-3.5" />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {result.newsletter === "unavailable" ? (
          <p className="text-muted-foreground mt-5 text-[13px] leading-[1.6]">
            Newsletter sign-up is not available right now. Your checklist is
            above and nothing else is required.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-surface-2 rounded-[24px] p-6 sm:p-7"
      data-track-form="resource-checklist"
    >
      <h3 className="text-[19px] font-semibold tracking-[-0.01em]">
        {checklistTitle}
      </h3>
      <p className="text-muted-foreground mt-2 text-[15px] leading-[1.6]">
        A print-ready version of this guide, with {itemCount} items to tick off.
        The guide above stays free to read; the checklist is the part we ask an
        address for.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`resource-email-${slug}`}>Email</Label>
          <Input
            id={`resource-email-${slug}`}
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <Label htmlFor={`resource-name-${slug}`}>Name (optional)</Label>
          <Input
            id={`resource-name-${slug}`}
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2"
            placeholder="Your name"
          />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <Checkbox
          id={`resource-follow-up-${slug}`}
          checked={followUp}
          onChange={(event) => setFollowUp(event.target.checked)}
          label={RESOURCE_FOLLOW_UP_CONSENT_TEXT}
        />
        <Checkbox
          id={`resource-newsletter-${slug}`}
          checked={newsletter}
          onChange={(event) => setNewsletter(event.target.checked)}
          label={RESOURCE_NEWSLETTER_CONSENT_TEXT}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive mt-5 rounded-[16px] px-4 py-3 text-[14px] leading-[1.5]"
        >
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        className="mt-6"
        data-track="resource-checklist-submit"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Preparing…
          </>
        ) : (
          "Get the printable checklist"
        )}
      </Button>
      <p className="text-muted-foreground mt-3 text-[13px] leading-[1.6]">
        We use the address to record this request and, only if you tick the box,
        to follow up. The checklist is shown on this page. Read the{" "}
        <Link
          href="/privacy"
          className="text-primary underline underline-offset-2"
        >
          privacy policy
        </Link>
        .
      </p>
    </form>
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!,
  );
}
