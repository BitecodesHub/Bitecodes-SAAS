"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bug,
  CornerDownRight,
  Loader2,
  Mail,
  Palette,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { updateFormAction } from "@/lib/server/forms/actions";
import type { FormAppearance } from "@/lib/server/db/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

/**
 * Settings editor for one form — everything `updateFormAction` accepts that the
 * field builder does not already own.
 *
 * One save for the whole panel rather than a save per section: the action takes a
 * partial and merges, so a single call is both fewer round trips and fewer ways
 * for the panel to end up half-applied. The trade is that one bad value blocks
 * the others, which is why every problem is named inline before the save button
 * is reachable rather than surfaced as one server error afterwards.
 *
 * Client-side validation here is a courtesy, never the boundary — the action
 * re-validates and re-authorises. It exists because two of these fields fail
 * *silently* when they are wrong: a mistyped notify address simply never
 * receives mail, and a malformed redirect strands the visitor on a dead page.
 * Neither produces an error anyone sees, so they have to be caught before save.
 */

/** Mirrors the repository defaults; duplicated because that module is server-only. */
const DEFAULT_THANK_YOU = "Thanks — we have received your message.";
const DEFAULT_BUTTON_TEXT = "Send";
const DEFAULT_PRIMARY_COLOR = "#4f46e5";

const THEMES: ReadonlyArray<{ value: FormAppearance["theme"]; label: string }> =
  [
    { value: "auto", label: "Match the visitor's system" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Deliberately conservative: it must not reject an address the mail provider
 * would have delivered, so it only insists on `local@domain.tld` with no spaces.
 * The server's own cleaner keeps anything containing an `@`, which is why this
 * check has to live here to be worth anything.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Splits a comma- or newline-separated list, tolerating both and trailing separators. */
function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Same normalisation the server applies to allowlist entries, reproduced so the
 * operator can see what will actually be stored before they store it. Keep in
 * step with `normalizeDomainPattern` in src/lib/chatbot/domains.ts.
 */
function normalizeDomain(pattern: string): string {
  return pattern
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

/** A host we can plausibly match: labels, dots, and at most a leading `*.`. */
function looksLikeDomain(normalized: string): boolean {
  // `*` alone means "any site" and is honoured by the matcher, so the editor
  // must accept it too rather than refusing a value the product supports.
  if (normalized === "*") return true;
  if (!/^(\*\.)?[a-z0-9.-]+$/.test(normalized)) return false;
  const host = normalized.replace(/^\*\./, "");
  // A single label only makes sense for loopback, which is allowed anyway.
  return host.includes(".") || host === "localhost";
}

/** True only for an absolute http(s) URL — the one shape the renderer can follow. */
function isFollowableUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export interface FormSettingsInitial {
  name: string;
  description: string | null;
  allowedDomains: string[];
  notifyEmails: string[];
  honeypotEnabled: boolean;
  redirectUrl: string | null;
  thankYouMessage: string;
  appearance: FormAppearance;
}

export function FormSettings({
  formId,
  initial,
}: {
  formId: string;
  initial: FormSettingsInitial;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [domains, setDomains] = useState(initial.allowedDomains.join("\n"));
  const [notify, setNotify] = useState(initial.notifyEmails.join("\n"));
  const [honeypot, setHoneypot] = useState(initial.honeypotEnabled);
  /**
   * Explicit acknowledgement required before the honeypot can be switched off.
   * Turning it off is not reversible for the spam it lets through in the
   * meantime — each one is stored and billed — so it gets a confirmation step.
   */
  const [honeypotAck, setHoneypotAck] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState(initial.redirectUrl ?? "");
  const [thankYou, setThankYou] = useState(initial.thankYouMessage);
  const [theme, setTheme] = useState<FormAppearance["theme"]>(
    initial.appearance.theme,
  );
  const [primaryColor, setPrimaryColor] = useState(
    initial.appearance.primaryColor,
  );
  const [buttonText, setButtonText] = useState(initial.appearance.buttonText);

  const domainList = useMemo(
    () => splitList(domains).map(normalizeDomain).filter(Boolean),
    [domains],
  );
  const badDomains = useMemo(
    () => domainList.filter((d) => !looksLikeDomain(d)),
    [domainList],
  );
  const emailList = useMemo(
    () => splitList(notify).map((e) => e.toLowerCase()),
    [notify],
  );
  const badEmails = useMemo(
    () => emailList.filter((e) => !EMAIL_SHAPE.test(e)),
    [emailList],
  );

  const trimmedName = name.trim();
  const trimmedRedirect = redirectUrl.trim();
  const redirectBroken =
    trimmedRedirect !== "" && !isFollowableUrl(trimmedRedirect);
  const colorBroken = !HEX_COLOR.test(primaryColor.trim());

  const blockers: string[] = [];
  if (trimmedName.length < 2)
    blockers.push("Name needs at least 2 characters.");
  if (description.trim().length > 500)
    blockers.push("Description is over 500 characters.");
  if (badDomains.length > 0)
    blockers.push(`Not a domain: ${badDomains.join(", ")}.`);
  if (domainList.length > 50) blockers.push("At most 50 domains.");
  if (badEmails.length > 0)
    blockers.push(`Not an email address: ${badEmails.join(", ")}.`);
  if (emailList.length > 10) blockers.push("At most 10 notify addresses.");
  if (redirectBroken)
    blockers.push("Redirect must be a full http(s) URL, or empty.");
  if (thankYou.trim().length < 1)
    blockers.push("Thank-you message cannot be empty.");
  if (thankYou.trim().length > 500)
    blockers.push("Thank-you message is over 500 characters.");
  if (colorBroken) blockers.push("Primary colour must be a hex like #4f46e5.");
  if (buttonText.trim().length < 1)
    blockers.push("Button text cannot be empty.");
  if (buttonText.trim().length > 40)
    blockers.push("Button text is over 40 characters.");
  if (!honeypot && initial.honeypotEnabled && !honeypotAck)
    blockers.push("Confirm you want the spam trap switched off.");

  function save() {
    if (blockers.length > 0) return;
    start(async () => {
      const result = await updateFormAction(formId, {
        name: trimmedName,
        description: description.trim() || null,
        allowedDomains: domainList,
        notifyEmails: emailList,
        honeypotEnabled: honeypot,
        // Empty means "no redirect, show the thank-you message" — sent as null
        // rather than omitted, so clearing an old redirect actually clears it.
        redirectUrl: trimmedRedirect || null,
        thankYouMessage: thankYou.trim(),
        appearance: {
          theme,
          primaryColor: primaryColor.trim().toLowerCase(),
          buttonText: buttonText.trim(),
        },
      });
      if (result.ok) {
        toast({ title: "Settings saved", variant: "success" });
        setHoneypotAck(false);
        router.refresh();
      } else {
        toast({
          title: "Could not save",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Settings2 className="text-primary size-4" />
          Basics
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          The name identifies the form in this panel and in the subject line of
          every notification email. The description is internal only.
        </p>
        <div className="mt-4 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fs-name">Name</Label>
            <Input
              id="fs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fs-description">Description</Label>
            <Textarea
              id="fs-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="min-h-20"
              placeholder="What this form is for, for whoever inherits it."
            />
          </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="text-primary size-4" />
          Allowed domains
          <Badge variant="muted">security boundary</Badge>
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          A submission is accepted only when the browser&apos;s{" "}
          <code className="text-foreground/90">Origin</code> matches an entry
          here. The list fails closed: with nothing listed, nothing on the
          public internet can post to this form, so the embed will appear to do
          nothing until you add the site it lives on.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="fs-domains">
            One per line — commas are accepted too
          </Label>
          <Textarea
            id="fs-domains"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            className="min-h-24 font-mono text-sm"
            placeholder={"example.com\n*.example.com"}
            aria-describedby="fs-domains-help"
          />
          <p
            id="fs-domains-help"
            className="text-muted-foreground text-xs leading-relaxed"
          >
            Scheme, port and path are stripped, and a leading <code>www.</code>{" "}
            is tolerated on either side, so{" "}
            <code>https://example.com/contact</code> is stored as{" "}
            <code>example.com</code>. <code>*.example.com</code> matches any
            subdomain but <em>not</em> the bare <code>example.com</code> — list
            the apex as well if you need both, the same way a TLS wildcard
            behaves. A bare <code>*</code> allows every site — useful while
            testing, but the public token is visible in your page source, so the
            domain list is the only thing stopping a stranger submitting to your
            form and spending your credits.
          </p>
        </div>
        {badDomains.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              These are not hostnames and would never match:{" "}
              {badDomains.join(", ")}
            </span>
          </p>
        )}
        {domainList.length > 0 && badDomains.length === 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            Will be stored as: {domainList.join(", ")}
          </p>
        )}
        <p className="border-border bg-muted/40 mt-3 rounded-xl border p-3 text-xs leading-relaxed">
          <strong className="font-medium">Local development is exempt.</strong>{" "}
          <code>localhost</code>, <code>127.0.0.1</code>, <code>[::1]</code> and
          anything under the reserved <code>.localhost</code> TLD are always
          allowed, on any port, whatever this list says. You never need to add
          them while integrating, and — more usefully — you never need to
          remember to take them out again before going live.
        </p>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Mail className="text-primary size-4" />
          Submission notifications
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Everyone listed gets an email containing the submitted values and the
          remaining credit balance. They also get the one-per-day warning when
          the form runs out of credits and starts turning visitors away. Leave
          it empty to receive nothing and rely on this dashboard.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="fs-notify">Notify addresses (up to 10)</Label>
          <Textarea
            id="fs-notify"
            value={notify}
            onChange={(e) => setNotify(e.target.value)}
            className="min-h-20 font-mono text-sm"
            placeholder={"you@example.com\nsales@example.com"}
            aria-describedby="fs-notify-help"
          />
          <p
            id="fs-notify-help"
            className="text-muted-foreground text-xs leading-relaxed"
          >
            A wrong address here fails <strong>silently</strong>. Nothing
            bounces back into the product, no error appears on this page, and
            the submission itself still succeeds and is still billed — the lead
            just sits in the dashboard with nobody told about it. Check the
            spelling of every address before saving.
          </p>
        </div>
        {badEmails.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              These would never receive a notification: {badEmails.join(", ")}
            </span>
          </p>
        )}
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Bug className="text-primary size-4" />
          Spam trap
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          The form renders one extra field that is hidden from people and
          invisible to assistive technology, but present in the HTML. A human
          never fills it in; automated scrapers fill in everything they find.
          Any submission arriving with that field non-empty is answered with a
          normal success response — so the bot has no signal to retry or adapt —
          while nothing is stored, nobody is emailed, and{" "}
          <strong>no credit is spent</strong>.
        </p>
        <div className="mt-4">
          <Switch
            id="fs-honeypot"
            checked={honeypot}
            onChange={(e) => {
              setHoneypot(e.target.checked);
              if (e.target.checked) setHoneypotAck(false);
            }}
            label="Trap hidden-field submissions"
            description={
              honeypot
                ? "On. Recommended — it is the cheapest filter you have."
                : "Off. Every bot submission will be stored and will cost a credit."
            }
          />
        </div>
        {!honeypot && initial.honeypotEnabled && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Switching the trap off cannot undo itself: spam that gets in
                while it is off is stored, emailed, and billed like any other
                submission. Turn it off only if a legitimate integration is
                posting the hidden field by mistake.
              </span>
            </p>
            <label
              htmlFor="fs-honeypot-ack"
              className="mt-2 flex items-center gap-2 text-sm font-medium"
            >
              <input
                id="fs-honeypot-ack"
                type="checkbox"
                checked={honeypotAck}
                onChange={(e) => setHoneypotAck(e.target.checked)}
              />
              I understand, switch the trap off
            </label>
          </div>
        )}
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CornerDownRight className="text-primary size-4" />
          After submitting
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          With a redirect set, the visitor is sent there the moment the
          submission is accepted and never sees the thank-you message. Leave the
          redirect empty to keep them on the page with the message instead.
        </p>
        <div className="mt-4 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fs-redirect">Redirect URL (optional)</Label>
            <Input
              id="fs-redirect"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://example.com/thank-you"
              inputMode="url"
              aria-invalid={redirectBroken}
              aria-describedby="fs-redirect-help"
            />
            <p
              id="fs-redirect-help"
              className="text-muted-foreground text-xs leading-relaxed"
            >
              Must be a complete <code>https://</code> (or <code>http://</code>)
              address. The visitor&apos;s browser follows this literally: a
              relative path such as <code>/thanks</code> is resolved against
              whichever site the embed is on, and a typo lands them on a page
              that does not exist — after their data was accepted, so they
              cannot tell whether it worked.
            </p>
          </div>
          {redirectBroken && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                Not a full http(s) URL. Add the scheme, or clear the field to
                use the thank-you message.
              </span>
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fs-thanks">Thank-you message</Label>
            <Textarea
              id="fs-thanks"
              value={thankYou}
              onChange={(e) => setThankYou(e.target.value)}
              maxLength={500}
              className="min-h-20"
            />
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted-foreground text-xs">
                Shown in place of the form when there is no redirect.
              </p>
              {thankYou.trim() !== DEFAULT_THANK_YOU && (
                <button
                  type="button"
                  onClick={() => setThankYou(DEFAULT_THANK_YOU)}
                  className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                >
                  Reset to default
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Palette className="text-primary size-4" />
          Appearance
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Applies to both the script embed and the hosted page. Changes take
          effect on the next page load — no need to update the snippet.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="fs-theme">Theme</Label>
            <select
              id="fs-theme"
              value={theme}
              onChange={(e) =>
                setTheme(e.target.value as FormAppearance["theme"])
              }
              className="border-border bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fs-color">Primary colour</Label>
            <div className="flex items-center gap-2">
              {/* The swatch and the text box edit one value: the picker is quick,
                  the text box is how a brand hex actually arrives from a client. */}
              <input
                type="color"
                aria-label="Pick primary colour"
                value={
                  HEX_COLOR.test(primaryColor.trim())
                    ? primaryColor.trim()
                    : DEFAULT_PRIMARY_COLOR
                }
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="border-border size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input
                id="fs-color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder={DEFAULT_PRIMARY_COLOR}
                aria-invalid={colorBroken}
                className="h-9 font-mono"
              />
            </div>
            {colorBroken && (
              <p className="text-xs text-amber-600">
                Six-digit hex only, such as {DEFAULT_PRIMARY_COLOR}.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fs-button">Submit button text</Label>
            <Input
              id="fs-button"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              maxLength={40}
              placeholder={DEFAULT_BUTTON_TEXT}
              className="h-9"
            />
          </div>
        </div>
      </section>

      <div className="space-y-2">
        {blockers.length > 0 && (
          <ul
            role="status"
            className="text-muted-foreground list-inside list-disc space-y-0.5 text-xs"
          >
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        <Button onClick={save} disabled={pending || blockers.length > 0}>
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}
