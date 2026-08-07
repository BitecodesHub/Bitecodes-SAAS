"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Copy,
  KeyRound,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  X,
} from "lucide-react";
import { normalizeDomainPattern } from "@/lib/chatbot/domains";
import {
  rotatePublicTokenAction,
  setChatbotStatusAction,
  updateChatbotAction,
} from "@/lib/server/chatbot/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/** A model the operator may pick. Resolved server-side; never fetched here. */
export interface SelectableModel {
  key: string;
  label: string;
  provider: string;
}

export interface ChatbotSettingsProps {
  chatbotId: string;
  name: string;
  description: string | null;
  websiteName: string | null;
  allowedDomains: string[];
  /** null means "follow the platform default model". */
  modelKey: string | null;
  systemPrompt: string;
  status: "active" | "paused";
  models: SelectableModel[];
}

/** Field limits mirror the server schema so the browser refuses over-long input
 *  rather than the action rejecting a whole save the operator cannot see into. */
const LIMITS = {
  name: 80,
  description: 500,
  websiteName: 120,
  domain: 120,
  domains: 50,
  systemPrompt: 8000,
} as const;

/** Sentinel for the "platform default" option — a `<select>` cannot hold null. */
const PLATFORM_DEFAULT = "";

interface Draft {
  name: string;
  description: string;
  websiteName: string;
  domains: string[];
  modelKey: string;
  systemPrompt: string;
}

/** The exact patch shape the action accepts, tracked from the action itself so
 *  a schema change here becomes a type error rather than a silent no-op. */
type ChatbotPatch = Parameters<typeof updateChatbotAction>[1];

/**
 * Fields the operator changed, and nothing else.
 *
 * A whole-object save would let two operators editing different fields
 * overwrite each other, and would rewrite `updatedAt` on every visit. Empty
 * strings become null for the nullable columns so "cleared" is stored as
 * absence rather than as a blank value.
 */
function buildPatch(baseline: Draft, draft: Draft): ChatbotPatch {
  const patch: ChatbotPatch = {};

  if (draft.name.trim() !== baseline.name.trim())
    patch.name = draft.name.trim();

  if (draft.description.trim() !== baseline.description.trim())
    patch.description = draft.description.trim() || null;

  if (draft.websiteName.trim() !== baseline.websiteName.trim())
    patch.websiteName = draft.websiteName.trim() || null;

  if (draft.domains.join("\n") !== baseline.domains.join("\n"))
    patch.allowedDomains = draft.domains;

  if (draft.modelKey !== baseline.modelKey)
    patch.modelKey =
      draft.modelKey === PLATFORM_DEFAULT ? null : draft.modelKey;

  if (draft.systemPrompt.trim() !== baseline.systemPrompt.trim())
    patch.systemPrompt = draft.systemPrompt.trim();

  return patch;
}

/** A hostname with at least one dot; the wildcard prefix is checked separately. */
const HOST =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Advisory copy of the loopback rule. The authoritative one lives in
 * `isOriginAllowed` (src/lib/chatbot/domains.ts) and is not exported for the
 * browser; this exists only so an operator typing `localhost` is told why it is
 * unnecessary instead of quietly filling a slot with a redundant entry.
 */
function isLoopbackEntry(raw: string): boolean {
  const host = normalizeDomainPattern(raw).replace(/^\*\./, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    // Normalisation strips a trailing `:port`, which mangles the IPv6 loopback
    // literals, so those are matched against the raw text instead.
    /::1/.test(raw)
  );
}

/** Returns an operator-facing reason the entry cannot be added, or null. */
function domainError(
  raw: string,
  stored: string,
  existing: string[],
): string | null {
  if (!stored) return "Enter a domain, such as example.com.";
  if (isLoopbackEntry(raw))
    return "Loopback addresses are already allowed — you do not need to add this.";
  if (stored.length > LIMITS.domain)
    return `Keep it under ${LIMITS.domain} characters.`;
  const base = stored.startsWith("*.") ? stored.slice(2) : stored;
  if (!HOST.test(base))
    return "That does not look like a domain. Use example.com or *.example.com.";
  if (existing.includes(stored)) return "That domain is already on the list.";
  if (existing.length >= LIMITS.domains)
    return `A chatbot can allow at most ${LIMITS.domains} domains.`;
  return null;
}

/**
 * Everything about one chatbot that is not its knowledge base: identity, the
 * domain allowlist, the model, the persona, plus the two controls that take it
 * off the air.
 *
 * Props are the current stored values and are re-read on every render, so the
 * baseline for "what changed" moves forward after `router.refresh()` without
 * this component holding a stale copy.
 */
export function ChatbotSettings({
  chatbotId,
  name,
  description,
  websiteName,
  allowedDomains,
  modelKey,
  systemPrompt,
  status,
  models,
}: ChatbotSettingsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const baseline: Draft = {
    name,
    description: description ?? "",
    websiteName: websiteName ?? "",
    domains: allowedDomains,
    modelKey: modelKey ?? PLATFORM_DEFAULT,
    systemPrompt,
  };

  const [draft, setDraft] = useState<Draft>(baseline);
  const [domainInput, setDomainInput] = useState("");
  const [domainMessage, setDomainMessage] = useState<string | null>(null);

  /** Both dangerous controls confirm in place; neither fires on first click. */
  const [confirmPause, setConfirmPause] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  /** Shown once after a rotation — only the hash is stored, so this is the
   *  only moment the plaintext token exists anywhere the operator can see. */
  const [rotatedToken, setRotatedToken] = useState<string | null>(null);

  const patch = buildPatch(baseline, draft);
  const dirty = Object.keys(patch).length > 0;
  const nameTooShort = draft.name.trim().length < 2;
  const previewDomain = normalizeDomainPattern(domainInput);
  /** A stored model the admin has since disabled still has to be displayable,
   *  otherwise the picker would silently reassign the bot to something else. */
  const modelMissing =
    draft.modelKey !== PLATFORM_DEFAULT &&
    !models.some((m) => m.key === draft.modelKey);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function addDomain() {
    const stored = normalizeDomainPattern(domainInput);
    const error = domainError(domainInput, stored, draft.domains);
    if (error) {
      setDomainMessage(error);
      return;
    }
    set("domains", [...draft.domains, stored]);
    setDomainInput("");
    setDomainMessage(null);
  }

  function removeDomain(target: string) {
    set(
      "domains",
      draft.domains.filter((d) => d !== target),
    );
    setDomainMessage(null);
  }

  function save() {
    if (!dirty || nameTooShort) return;
    start(async () => {
      const result = await updateChatbotAction(chatbotId, patch);
      if (result.ok) {
        toast({ title: "Settings saved", variant: "success" });
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

  function setStatus(next: "active" | "paused") {
    start(async () => {
      const result = await setChatbotStatusAction(chatbotId, next);
      if (result.ok) {
        setConfirmPause(false);
        toast({
          title: next === "paused" ? "Chatbot paused" : "Chatbot live again",
          description:
            next === "paused"
              ? "The widget stops answering until you resume it."
              : undefined,
          variant: "success",
        });
        router.refresh();
      } else {
        toast({
          title: "Could not change status",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function rotate() {
    start(async () => {
      const result = await rotatePublicTokenAction(chatbotId);
      if (result.ok) {
        setRotatedToken(result.data.publicToken);
        setConfirmRotate(false);
        toast({
          title: "New token issued",
          description: "Every embed using the old token has stopped working.",
          variant: "success",
        });
        router.refresh();
      } else {
        toast({
          title: "Could not rotate",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    toast({ title: "Copied", variant: "success" });
  }

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sliders className="text-primary size-4" />
          Settings
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Nothing here is saved until you choose Save changes.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cs-name">Name</Label>
            <Input
              id="cs-name"
              value={draft.name}
              maxLength={LIMITS.name}
              onChange={(e) => set("name", e.target.value)}
              aria-describedby="cs-name-help"
              aria-invalid={nameTooShort}
            />
            <p id="cs-name-help" className="text-muted-foreground text-xs">
              {nameTooShort
                ? "At least 2 characters. Only you see this name."
                : "Internal label. Visitors never see it."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-website">Website name</Label>
            <Input
              id="cs-website"
              value={draft.websiteName}
              maxLength={LIMITS.websiteName}
              onChange={(e) => set("websiteName", e.target.value)}
              placeholder="Acme Ltd"
              aria-describedby="cs-website-help"
            />
            <p id="cs-website-help" className="text-muted-foreground text-xs">
              The business the assistant speaks for.
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor="cs-description">Description</Label>
          <Input
            id="cs-description"
            value={draft.description}
            maxLength={LIMITS.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Answers pre-sales questions on the pricing page"
            aria-describedby="cs-description-help"
          />
          <p id="cs-description-help" className="text-muted-foreground text-xs">
            A note to your future self about what this bot is for.
          </p>
        </div>

        {/* --- Allowed domains: the widget's security boundary --------------- */}
        <div className="border-border mt-5 rounded-xl border p-4">
          <Label htmlFor="cs-domain">Allowed domains</Label>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            The widget only answers when the page asking is served from one of
            these hosts. Everything else is refused, so this is the control that
            stops another site spending your credits.
          </p>

          <div className="mt-3 flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <Input
                id="cs-domain"
                value={domainInput}
                maxLength={LIMITS.domain + 40}
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  setDomainMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDomain();
                  }
                }}
                placeholder="example.com or *.example.com"
                aria-describedby="cs-domain-help"
                aria-invalid={domainMessage !== null}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addDomain}
              disabled={!domainInput.trim()}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>

          <p id="cs-domain-help" className="mt-2 text-xs leading-relaxed">
            {domainMessage ? (
              <span className="text-destructive">{domainMessage}</span>
            ) : previewDomain && previewDomain !== domainInput.trim() ? (
              <span className="text-muted-foreground">
                Will be stored as{" "}
                <code className="text-foreground">{previewDomain}</code> — the
                scheme, port and path are dropped because only the host is
                checked.
              </span>
            ) : domainInput.trim() ? (
              <span className="text-muted-foreground">
                Not on the list yet — choose Add.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Stored exactly as shown below.
              </span>
            )}
          </p>

          {draft.domains.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {draft.domains.map((domain) => (
                <li key={domain}>
                  <Badge variant="outline" className="pr-1.5 font-mono">
                    {domain}
                    <button
                      type="button"
                      onClick={() => removeDomain(domain)}
                      aria-label={`Remove ${domain} from the allowlist`}
                      className="text-muted-foreground hover:text-destructive rounded-full p-0.5"
                    >
                      <X className="size-3.5" />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-600">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              With no domains listed the widget answers nowhere on the public
              internet. Add the site you are embedding it on.
            </p>
          )}

          <ul className="text-muted-foreground mt-3 space-y-1 text-xs leading-relaxed">
            <li>
              <code className="text-foreground">*.example.com</code> covers
              subdomains such as app.example.com, but not example.com itself —
              list the apex too if you serve pages there.
            </li>
            <li>
              A leading <code className="text-foreground">www.</code> is
              tolerated either way, so example.com also matches www.example.com.
            </li>
            <li>
              localhost and other loopback addresses are always allowed, on any
              port, so you can integrate locally without adding them here — and
              without leaving a development host on a live allowlist.
            </li>
          </ul>
        </div>

        {/* --- Model ------------------------------------------------------- */}
        <div className="mt-5 space-y-1.5">
          <Label htmlFor="cs-model">Model</Label>
          <select
            id="cs-model"
            value={draft.modelKey}
            onChange={(e) => set("modelKey", e.target.value)}
            aria-describedby="cs-model-help"
            className="border-border bg-background h-9 w-full max-w-md rounded-md border px-3 text-sm"
          >
            <option value={PLATFORM_DEFAULT}>
              Platform default (recommended)
            </option>
            {models.map((model) => (
              <option key={model.key} value={model.key}>
                {model.label} · {model.provider}
              </option>
            ))}
            {modelMissing && (
              <option value={draft.modelKey}>
                {draft.modelKey} (no longer offered)
              </option>
            )}
          </select>
          <p
            id="cs-model-help"
            className="text-muted-foreground text-xs leading-relaxed"
          >
            {modelMissing
              ? "This bot is pinned to a model that is no longer offered. Pick another, or switch to the platform default."
              : "The platform default tracks whichever model we currently recommend, so it improves without you changing anything. Pin a specific one only if you have a reason to."}
          </p>
        </div>

        {/* --- Persona ------------------------------------------------------ */}
        <div className="mt-5 space-y-1.5">
          <Label htmlFor="cs-prompt">System prompt</Label>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This sets who the assistant is — its tone, its role, what it offers
            to do next. It is not where facts belong: the assistant is
            separately instructed to answer only from the knowledge base and to
            say it does not know rather than invent an answer, and that
            instruction wins. Anything factual you put here can be contradicted
            by the knowledge base, so put it in the knowledge base instead.
          </p>
          <Textarea
            id="cs-prompt"
            value={draft.systemPrompt}
            maxLength={LIMITS.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            rows={8}
            placeholder="You are the support assistant for Acme. Be warm, brief, and offer to pass anything you cannot answer to a person."
            aria-describedby="cs-prompt-help"
          />
          <p id="cs-prompt-help" className="text-muted-foreground text-xs">
            {draft.systemPrompt.trim()
              ? `${draft.systemPrompt.length.toLocaleString()} of ${LIMITS.systemPrompt.toLocaleString()} characters.`
              : "Left empty, the assistant falls back to a plain, generic helper persona."}
          </p>
        </div>

        {/* Sticky so Save stays in reach at the bottom of a long prompt rather
            than sitting below it, off screen. */}
        <div className="border-border bg-card/95 sticky bottom-0 -mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 border-t px-5 pt-4 backdrop-blur">
          <p className="text-muted-foreground text-xs" role="status">
            {nameTooShort
              ? "A name is required."
              : dirty
                ? `Unsaved: ${Object.keys(patch).length} change${
                    Object.keys(patch).length === 1 ? "" : "s"
                  }.`
                : "No changes."}
          </p>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(baseline);
                  setDomainInput("");
                  setDomainMessage(null);
                }}
                disabled={pending}
              >
                <RotateCcw className="size-4" />
                Discard
              </Button>
            )}
            <Button
              type="button"
              onClick={save}
              disabled={pending || !dirty || nameTooShort}
            >
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>
      </section>

      {/* --- Dangerous, and deliberately separated ------------------------- */}
      <section className="bg-card rounded-2xl border border-amber-300 p-5 shadow-[var(--shadow-soft)] dark:border-amber-900">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="size-4 text-amber-600" />
          Taking it off the air
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Both of these affect the live widget the moment you confirm them.
        </p>

        <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              {status === "active" ? "Pause the chatbot" : "Resume the chatbot"}
              <Badge variant={status === "active" ? "secondary" : "muted"}>
                {status}
              </Badge>
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {status === "active"
                ? "While paused the widget stops answering visitors. Settings and knowledge are kept, and the embed does not need changing."
                : "Visitors can talk to it again straight away, using the embed already on your site."}
            </p>
          </div>
          {status === "active" ? (
            confirmPause ? (
              <span className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus("paused")}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Pause className="size-4" />
                  )}
                  Yes, pause it
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmPause(false)}
                >
                  Keep it live
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmPause(true)}
              >
                <Pause className="size-4" />
                Pause
              </Button>
            )
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStatus("active")}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Activate
            </Button>
          )}
        </div>

        <div className="border-border mt-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="size-4" />
                Rotate the public token
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                Issues a new token and invalidates the old one, so every embed
                already deployed stops working until you paste the new snippet.
                Do this if the token leaked somewhere it should not have.
              </p>
            </div>
            {confirmRotate ? (
              <span className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={rotate}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Yes, break existing embeds
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmRotate(false)}
                >
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmRotate(true)}
              >
                <RefreshCw className="size-4" />
                Rotate token
              </Button>
            )}
          </div>

          {rotatedToken && (
            <div
              role="status"
              className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
            >
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                Copy this now. Only a hash is stored, so it cannot be shown
                again — if you lose it you must rotate once more.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="border-border bg-background min-w-0 flex-1 overflow-x-auto rounded-lg border px-3 py-2 font-mono text-xs">
                  {rotatedToken}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copy(rotatedToken)}
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
