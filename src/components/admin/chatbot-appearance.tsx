"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { updateChatbotAction } from "@/lib/server/chatbot/actions";
import type { ChatbotAppearance } from "@/lib/server/db/types";
import {
  APPEARANCE_LIMITS,
  CHATBOT_APPEARANCE_DEFAULTS,
} from "@/lib/chatbot/appearance";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

/**
 * Appearance editor for one chatbot, with a live preview of the widget.
 *
 * Every control here is read by the deployed widget. `language` and `timezone`
 * exist in the contract but have no translation or time policy behind them, so
 * they are deliberately absent rather than offered as controls that do nothing.
 *
 * The preview is built from the values literally embedded in
 * `src/app/widget.js/route.ts` (see `WIDGET`), not from values that make the
 * result look good. An editor whose preview flatters the outcome would have the
 * operator shipping a brand colour that never appears on their site.
 *
 * Display modes are part of the embed contract: bubble is a floating launcher,
 * popup opens centred on arrival, fullscreen fills the viewport, and embedded
 * mounts into `data-container` (or the script's parent). See the widget route
 * for the full embed API.
 */

/** The subset this editor owns. A full `ChatbotAppearance` satisfies it. */
export type EditableAppearance = Pick<
  ChatbotAppearance,
  | "theme"
  | "emoji"
  | "avatar"
  | "logo"
  | "primaryColor"
  | "secondaryColor"
  | "position"
  | "size"
  | "displayMode"
  | "welcomeMessage"
  | "placeholder"
  | "typingAnimation"
  | "branding"
  | "launcherLabel"
  | "starterPrompts"
  | "suggestedQuestions"
>;

const KEYS = [
  "theme",
  "emoji",
  "avatar",
  "logo",
  "primaryColor",
  "secondaryColor",
  "position",
  "size",
  "displayMode",
  "welcomeMessage",
  "placeholder",
  "typingAnimation",
  "branding",
  "launcherLabel",
  "starterPrompts",
  "suggestedQuestions",
] as const satisfies readonly (keyof EditableAppearance)[];

/**
 * Prompts are edited as one-per-line text. Parsing on every keystroke keeps the
 * draft a plain string (so a trailing newline is not swallowed) while the saved
 * value is the filtered list the server accepts.
 */
function parsePrompts(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Geometry and colours copied verbatim out of `widget.js/route.ts`. Changing a
 * number here without changing it there makes the preview a fiction, so they
 * are grouped and named after the widget's own CSS classes.
 */
const WIDGET = {
  bubble: 56,
  panelW: 360,
  panelH: 520,
  /** `host.style` — the launcher is pinned 20px off the bottom-right corner. */
  offset: 20,
  /** `.panel{bottom:70px}` — the panel sits above the bubble. */
  panelGap: 70,
  accent: "#4f46e5",
  /** `.hd` text, hardcoded and not derived from any setting. */
  headerText: "Chat with us",
  greeting: "Hi! How can I help you today?",
  placeholder: "Ask a question…",
  light: {
    panelBg: "#ffffff",
    fg: "#111111",
    botBg: "#f1f1f4",
    footBorder: "#eeeeee",
    inputBg: "transparent",
    inputBorder: "#dddddd",
  },
  dark: {
    panelBg: "#15151b",
    fg: "#eeeeee",
    botBg: "#26262e",
    footBorder: "#26262e",
    inputBg: "#0f0f14",
    inputBorder: "#33333d",
  },
} as const;

/**
 * Only `regular` is real. Compact and large are this editor's proposal for what
 * the sizes should mean, and are labelled as such in the UI rather than being
 * presented as fact.
 */
const SIZES: Record<
  EditableAppearance["size"],
  { bubble: number; w: number; h: number }
> = {
  compact: { bubble: 48, w: 320, h: 440 },
  regular: { bubble: WIDGET.bubble, w: WIDGET.panelW, h: WIDGET.panelH },
  large: { bubble: 64, w: 420, h: 620 },
};

/** Height of the fake host page in the preview, in CSS pixels. */
const FRAME_H = 640;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

interface Draft extends Omit<
  EditableAppearance,
  "avatar" | "logo" | "emoji" | "starterPrompts" | "suggestedQuestions"
> {
  /** Empty string rather than null, because that is what an `<input>` holds. */
  avatar: string;
  logo: string;
  emoji: string;
  /** One prompt per line. */
  starterPrompts: string;
  suggestedQuestions: string;
}

function toDraft(a: EditableAppearance): Draft {
  return {
    ...a,
    avatar: a.avatar ?? "",
    logo: a.logo ?? "",
    emoji: a.emoji ?? "",
    launcherLabel: a.launcherLabel ?? "",
    starterPrompts: (a.starterPrompts ?? []).join("\n"),
    suggestedQuestions: (a.suggestedQuestions ?? []).join("\n"),
  };
}

function fromDraft(d: Draft): EditableAppearance {
  return {
    ...d,
    emoji: d.emoji.trim() || null,
    avatar: d.avatar.trim() || null,
    logo: d.logo.trim() || null,
    primaryColor: d.primaryColor.trim(),
    secondaryColor: d.secondaryColor.trim(),
    welcomeMessage: d.welcomeMessage.trim(),
    placeholder: d.placeholder.trim(),
    launcherLabel: d.launcherLabel.trim() || "Open chat",
    starterPrompts: parsePrompts(d.starterPrompts),
    suggestedQuestions: parsePrompts(d.suggestedQuestions),
  };
}

/** Why a prompt list cannot be saved yet, or null when it is valid. */
function promptProblem(value: string): string | null {
  const lines = parsePrompts(value);
  if (lines.length > APPEARANCE_LIMITS.prompts) {
    return `Use at most ${APPEARANCE_LIMITS.prompts} prompts — the extras would not be saved.`;
  }
  if (lines.some((line) => line.length > APPEARANCE_LIMITS.promptLength)) {
    return `Keep each prompt to ${APPEARANCE_LIMITS.promptLength} characters or fewer.`;
  }
  return null;
}

/**
 * An image URL safe to drop into `background-image`. Anything that could close
 * the `url()` or the quoting is rejected outright rather than escaped, and only
 * http(s) and inline images are allowed — a `javascript:` or relative-to-admin
 * URL in a preview is not worth the surface.
 */
function safeImageUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /["'()\\\s]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return value;
    if (url.protocol === "data:" && value.startsWith("data:image/"))
      return value;
    return null;
  } catch {
    return null;
  }
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Module-level so the subscription is stable across renders. */
function subscribeSystemDark(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readSystemDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function ChatbotAppearanceEditor({
  chatbotId,
  appearance,
  name,
}: {
  chatbotId: string;
  appearance: EditableAppearance;
  /** The bot's display name, which the widget uses as its header title. */
  name?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  /** Last known server state; the diff baseline, so we only send what changed. */
  const [saved, setSaved] = useState<EditableAppearance>(() =>
    fromDraft(toDraft(appearance)),
  );
  const [draft, setDraft] = useState<Draft>(() => toDraft(appearance));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // Mirrors the widget's `@media(prefers-color-scheme:dark)` so theme "auto"
  // previews as what this operator's own OS would give a visitor. Subscribed
  // rather than read into state so there is no render-then-correct flash.
  const systemDark = useSyncExternalStore(
    subscribeSystemDark,
    readSystemDark,
    () => false,
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setConfirmDiscard(false);
    setConfirmReset(false);
  }

  const primaryValid = HEX.test(draft.primaryColor.trim());
  const secondaryValid = HEX.test(draft.secondaryColor.trim());
  const colorsValid = primaryValid && secondaryValid;
  const starterProblem = promptProblem(draft.starterPrompts);
  const suggestedProblem = promptProblem(draft.suggestedQuestions);
  const promptsValid = !starterProblem && !suggestedProblem;
  const valid = colorsValid && promptsValid;

  const patch = useMemo(() => {
    const next = fromDraft(draft);
    const out: Partial<EditableAppearance> = {};
    for (const key of KEYS) {
      const before = saved[key];
      const after = next[key];
      // Arrays are rebuilt by `fromDraft` on every render, so identity would
      // report a change that did not happen and make Discard unavailable.
      const changed =
        Array.isArray(before) && Array.isArray(after)
          ? before.length !== after.length ||
            before.some((value, index) => value !== after[index])
          : before !== after;
      if (changed) {
        // A per-key assignment keeps each value's own type; the index write is
        // the only way to build a Partial in a loop without a cast per branch.
        (out as Record<string, unknown>)[key] = after;
      }
    }
    return out;
  }, [draft, saved]);

  const dirty = Object.keys(patch).length > 0;

  // Guard reloads and closing the tab. In-app Next.js navigation cannot be
  // intercepted here, which is why Discard is explicit and saving is one click.
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function save() {
    if (!dirty || !valid) return;
    start(async () => {
      const next = fromDraft(draft);
      // Only the changed keys. `updateChatbot` merges the partial onto the stored
      // appearance, so sending the whole object would overwrite fields another
      // tab may have just changed.
      const result = await updateChatbotAction(chatbotId, {
        appearance: patch,
      });
      if (result.ok) {
        setSaved(next);
        toast({ title: "Appearance saved", variant: "success" });
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

  function discard() {
    setDraft(toDraft(saved));
    setConfirmDiscard(false);
    setConfirmReset(false);
  }

  function resetToDefaults() {
    setDraft(toDraft(CHATBOT_APPEARANCE_DEFAULTS));
    setConfirmReset(false);
    setConfirmDiscard(false);
  }

  // The preview's effective configuration, exactly as the widget computes it
  // from the same values.
  const view = {
    theme: draft.theme,
    displayMode: draft.displayMode,
    position: draft.position,
    size: draft.size,
    emoji: draft.emoji.trim() || "💬",
    accent: primaryValid ? draft.primaryColor.trim() : WIDGET.accent,
    secondary: secondaryValid ? draft.secondaryColor.trim() : WIDGET.accent,
    header: name?.trim() || WIDGET.headerText,
    welcome: draft.welcomeMessage.trim() || WIDGET.greeting,
    placeholder: draft.placeholder.trim() || WIDGET.placeholder,
    typing: draft.typingAnimation,
    branding: draft.branding,
    avatar: safeImageUrl(draft.avatar),
    logo: safeImageUrl(draft.logo),
    launcherLabel: draft.launcherLabel.trim() || "Open chat",
    starter: parsePrompts(draft.starterPrompts).slice(0, 4),
    suggested: parsePrompts(draft.suggestedQuestions).slice(0, 4),
  };

  const dims = SIZES[view.size];
  const dark = view.theme === "dark" || (view.theme === "auto" && systemDark);
  const skin = dark ? WIDGET.dark : WIDGET.light;
  // The real panel is `max-height:calc(100vh - 120px)`, so a taller size is
  // shrunk rather than clipped. The frame stands in for the viewport.
  const panelH = Math.min(dims.h, FRAME_H - 120);
  /** Popup centres, fullscreen and embedded fill the frame, bubble is anchored. */
  const fills =
    view.displayMode === "fullscreen" || view.displayMode === "embedded";
  const centred = view.displayMode !== "bubble";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0 space-y-6">
        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Colours</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Type a hex value or pick one. Only <code>#rgb</code> and{" "}
            <code>#rrggbb</code> are accepted — anything else would break the
            widget&apos;s CSS, so it is refused rather than saved.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ColorField
              id="ap-primary"
              label="Primary colour"
              value={draft.primaryColor}
              valid={primaryValid}
              fallback={saved.primaryColor}
              onChange={(v) => set("primaryColor", v)}
            />
            <ColorField
              id="ap-secondary"
              label="Secondary colour"
              value={draft.secondaryColor}
              valid={secondaryValid}
              fallback={saved.secondaryColor}
              onChange={(v) => set("secondaryColor", v)}
            />
          </div>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Layout</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ap-theme">Theme</Label>
              <Select
                id="ap-theme"
                value={draft.theme}
                onChange={(e) => set("theme", e.target.value as Draft["theme"])}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (follow visitor)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-emoji">Launcher emoji</Label>
              <Input
                id="ap-emoji"
                value={draft.emoji}
                maxLength={16}
                onChange={(e) => set("emoji", e.target.value)}
                placeholder="💬"
                aria-describedby="ap-emoji-help"
              />
              <p id="ap-emoji-help" className="text-muted-foreground text-xs">
                One visible emoji. Leave blank for the default chat icon. Markup
                and control characters are refused by the server.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-launcher-label">Launcher name</Label>
              <Input
                id="ap-launcher-label"
                value={draft.launcherLabel}
                maxLength={APPEARANCE_LIMITS.launcherLabel}
                onChange={(e) => set("launcherLabel", e.target.value)}
                placeholder="Open chat"
                aria-describedby="ap-launcher-label-help"
              />
              <p
                id="ap-launcher-label-help"
                className="text-muted-foreground text-xs"
              >
                Read by screen readers as the button&apos;s name. It is never
                shown as visible text.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-position">Position</Label>
              <Select
                id="ap-position"
                value={draft.position}
                onChange={(e) =>
                  set("position", e.target.value as Draft["position"])
                }
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-size">Size</Label>
              <Select
                id="ap-size"
                value={draft.size}
                onChange={(e) => set("size", e.target.value as Draft["size"])}
              >
                <option value="compact">
                  Compact — {SIZES.compact.w}×{SIZES.compact.h}
                </option>
                <option value="regular">
                  Regular — {SIZES.regular.w}×{SIZES.regular.h}
                </option>
                <option value="large">
                  Large — {SIZES.large.w}×{SIZES.large.h}
                </option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-mode">Display mode</Label>
              <Select
                id="ap-mode"
                value={draft.displayMode}
                onChange={(e) =>
                  set("displayMode", e.target.value as Draft["displayMode"])
                }
              >
                <option value="bubble">Bubble — floating launcher</option>
                <option value="popup">
                  Popup — opens on arrival, no launcher
                </option>
                <option value="fullscreen">
                  Fullscreen — fills the viewport
                </option>
                <option value="embedded">
                  Embedded — mounts in a container on the page
                </option>
              </Select>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Popup and fullscreen open as soon as the page loads. Embedded
                needs a host element with a height; point the script at it with{" "}
                <code>data-container=&quot;#chat&quot;</code>, or place the
                script inside the element to use its parent. A single page can
                override the mode with <code>data-mode=&quot;…&quot;</code>.
              </p>
            </div>
          </div>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Wording</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ap-welcome">Welcome message</Label>
              <Input
                id="ap-welcome"
                value={draft.welcomeMessage}
                maxLength={300}
                onChange={(e) => set("welcomeMessage", e.target.value)}
                placeholder={WIDGET.greeting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-placeholder">Input placeholder</Label>
              <Input
                id="ap-placeholder"
                value={draft.placeholder}
                maxLength={APPEARANCE_LIMITS.placeholder}
                onChange={(e) => set("placeholder", e.target.value)}
                placeholder={WIDGET.placeholder}
              />
            </div>
          </div>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Quick replies</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Buttons a visitor can click instead of typing. Text is shown
            literally — markup is never interpreted.
          </p>
          <div className="mt-4 space-y-4">
            <PromptListField
              id="ap-starter"
              label="Starter prompts"
              hint="Shown with the welcome message, before the first question."
              value={draft.starterPrompts}
              problem={starterProblem}
              onChange={(value) => set("starterPrompts", value)}
              placeholder={"What do you sell?\nHow much does it cost?"}
            />
            <PromptListField
              id="ap-suggested"
              label="Suggested questions"
              hint="Shown after each answer to keep a conversation going. Also used with the welcome message when no starter prompts are set."
              value={draft.suggestedQuestions}
              problem={suggestedProblem}
              onChange={(value) => set("suggestedQuestions", value)}
              placeholder={"Do you offer refunds?\nHow do I contact support?"}
            />
          </div>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Images</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Absolute <code>https://</code> URLs. The preview skips anything it
            cannot load safely.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ap-avatar">Avatar URL</Label>
              <Input
                id="ap-avatar"
                type="url"
                inputMode="url"
                value={draft.avatar}
                onChange={(e) => set("avatar", e.target.value)}
                placeholder="https://example.com/avatar.png"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-logo">Logo URL</Label>
              <Input
                id="ap-logo"
                type="url"
                inputMode="url"
                value={draft.logo}
                onChange={(e) => set("logo", e.target.value)}
                placeholder="https://example.com/logo.svg"
              />
            </div>
          </div>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Behaviour</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Checkbox
                id="ap-typing"
                label="Show a typing animation while the answer is being written"
                checked={draft.typingAnimation}
                onChange={(e) => set("typingAnimation", e.target.checked)}
              />
            </div>
            <div className="space-y-1.5">
              <Checkbox
                id="ap-branding"
                label="Show “Powered by Bitecodes” in the panel"
                checked={draft.branding}
                onChange={(e) => set("branding", e.target.checked)}
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending || !dirty || !valid}>
            {pending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save appearance
          </Button>

          {confirmDiscard ? (
            <>
              <Button variant="outline" onClick={discard} disabled={pending}>
                Confirm discard
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmDiscard(false)}
                disabled={pending}
              >
                Keep editing
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirmDiscard(true)}
              disabled={pending || !dirty}
            >
              <RotateCcw className="size-4" />
              Discard changes
            </Button>
          )}

          {confirmReset ? (
            <>
              <Button
                variant="outline"
                onClick={resetToDefaults}
                disabled={pending}
              >
                Confirm reset
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmReset(false)}
                disabled={pending}
              >
                Keep editing
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirmReset(true)}
              disabled={pending}
            >
              Reset to defaults
            </Button>
          )}

          <p className="text-muted-foreground text-xs">
            {!colorsValid
              ? "Fix the hex value before saving."
              : !promptsValid
                ? "Fix the quick replies before saving."
                : dirty
                  ? `${Object.keys(patch).length} change${
                      Object.keys(patch).length === 1 ? "" : "s"
                    } to send — only these fields are written.`
                  : "No unsaved changes."}
          </p>
        </div>
      </div>

      {/* Preview column. Sticky on a wide screen so it stays beside the field
          being edited; it is the whole reason to have two columns. */}
      <div className="w-full lg:sticky lg:top-6 lg:w-[440px]">
        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Preview</h2>
          </div>

          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            {fills
              ? `${view.displayMode} mode fills the frame; the bubble size setting still controls typography.`
              : `${dims.w}×${panelH} panel, ${dims.bubble}px launcher, ${view.position}, ${dark ? "dark" : "light"} skin, ${view.displayMode} mode.`}{" "}
            The frame below is {FRAME_H}px tall, so the panel is capped the same
            way the real one is by <code>max-height:calc(100vh - 120px)</code>.
            Launcher name:{" "}
            <span className="font-medium">{view.launcherLabel}</span>.
          </p>

          <div
            aria-hidden="true"
            className="border-border bg-muted/40 relative mt-3 overflow-hidden rounded-xl border"
            style={{ height: FRAME_H }}
          >
            {view.displayMode === "popup" && (
              <div className="absolute inset-0 bg-black/40" />
            )}

            <div
              className="absolute"
              style={
                centred
                  ? { inset: 0, display: "grid", placeItems: "center" }
                  : {
                      bottom: WIDGET.offset,
                      [view.position === "bottom-left" ? "left" : "right"]:
                        WIDGET.offset,
                    }
              }
            >
              <div
                style={{
                  position:
                    view.displayMode === "bubble" ? "absolute" : "static",
                  bottom: WIDGET.panelGap,
                  [view.position === "bottom-left" ? "left" : "right"]: 0,
                  width: fills ? "100%" : Math.min(dims.w, 400),
                  height: fills ? FRAME_H : panelH,
                  background: skin.panelBg,
                  color: skin.fg,
                  // .panel{border-radius:16px}
                  borderRadius: fills ? 0 : 16,
                  boxShadow: "0 12px 40px rgba(0,0,0,.28)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  fontFamily:
                    "system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
                }}
              >
                {/* .hd{padding:14px 16px;font-weight:600} */}
                <div
                  style={{
                    padding: "14px 16px",
                    background: view.accent,
                    color: "#fff",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  {view.logo && (
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        flex: "0 0 auto",
                        borderRadius: 4,
                        backgroundImage: `url("${view.logo}")`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                      }}
                    />
                  )}
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 15,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {view.header}
                  </span>
                  {/* .close — hidden for embedded, which has nowhere to reopen. */}
                  {view.displayMode !== "embedded" && (
                    <span
                      style={{
                        fontSize: 22,
                        lineHeight: 1,
                        padding: "0 4px",
                        opacity: 0.9,
                      }}
                    >
                      ×
                    </span>
                  )}
                </div>

                {/* .log{flex:1;padding:14px;gap:10px} */}
                <div
                  style={{
                    flex: 1,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    overflow: "hidden",
                  }}
                >
                  <PreviewMessage
                    who="bot"
                    text={view.welcome}
                    skin={skin}
                    accent={view.accent}
                    avatar={view.avatar}
                  />
                  {(view.starter.length > 0 || view.suggested.length > 0) && (
                    <PreviewChips
                      items={
                        view.starter.length > 0 ? view.starter : view.suggested
                      }
                      skin={skin}
                      accent={view.accent}
                    />
                  )}
                  <PreviewMessage
                    who="user"
                    text="Do you offer refunds?"
                    skin={skin}
                    accent={view.accent}
                    avatar={null}
                  />
                  {view.typing ? (
                    <PreviewMessage
                      who="bot"
                      text="• • •"
                      skin={skin}
                      accent={view.accent}
                      avatar={view.avatar}
                    />
                  ) : (
                    <PreviewMessage
                      who="bot"
                      text="Yes — within 14 days of purchase."
                      skin={skin}
                      accent={view.accent}
                      avatar={view.avatar}
                    />
                  )}
                  {view.suggested.length > 0 && view.starter.length > 0 && (
                    <PreviewChips
                      items={view.suggested}
                      skin={skin}
                      accent={view.accent}
                    />
                  )}
                </div>

                {view.branding && (
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      opacity: 0.6,
                      paddingBottom: 6,
                    }}
                  >
                    Powered by Bitecodes
                  </p>
                )}

                {/* .ft{gap:8px;padding:12px;border-top:1px solid} */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: 12,
                    borderTop: `1px solid ${skin.footBorder}`,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      border: `1px solid ${skin.inputBorder}`,
                      background: skin.inputBg,
                      borderRadius: 10,
                      fontSize: 14,
                      opacity: 0.6,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {view.placeholder}
                  </span>
                  <span
                    style={{
                      background: view.accent,
                      color: "#fff",
                      borderRadius: 10,
                      padding: "0 14px",
                      fontSize: 14,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    Send
                  </span>
                </div>
              </div>

              {view.displayMode === "bubble" && (
                <div
                  style={{
                    width: dims.bubble,
                    height: dims.bubble,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${view.accent}, ${view.secondary})`,
                    color: "#fff",
                    fontSize: 24,
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
                  }}
                >
                  {view.emoji}
                </div>
              )}
            </div>
          </div>

          {!primaryValid && (
            <p className="mt-3 text-xs text-amber-600">
              Showing {WIDGET.accent} — the primary colour you typed is not a
              valid hex value.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * One prompt per line. The textarea keeps the raw string so a trailing newline
 * survives typing; validation reports what the server would refuse before the
 * operator presses Save.
 */
function PromptListField({
  id,
  label,
  hint,
  value,
  problem,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  problem: string | null;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        rows={4}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(problem)}
        aria-describedby={`${id}-help`}
        className={problem ? "border-destructive" : undefined}
      />
      <p id={`${id}-help`} className="text-muted-foreground text-xs">
        {hint} One per line, up to {APPEARANCE_LIMITS.prompts}, and{" "}
        {APPEARANCE_LIMITS.promptLength} characters each.
      </p>
      {problem && <p className="text-destructive text-xs">{problem}</p>}
    </div>
  );
}

/** The widget's `.suggestions` row: text-only chips, not interactive here. */
function PreviewChips({
  items,
  skin,
  accent,
}: {
  items: string[];
  skin: typeof WIDGET.light | typeof WIDGET.dark;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            border: `1px solid ${accent}`,
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 12,
            lineHeight: 1.3,
            color: skin.fg,
            maxWidth: "100%",
            overflowWrap: "anywhere",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

/**
 * A hex colour with both a picker and a text box, because designers paste hex
 * and the native picker cannot be pasted into. The picker needs a well-formed
 * 7-character value at all times, so it falls back to the last saved colour
 * while the text box holds something half-typed.
 */
function ColorField({
  id,
  label,
  value,
  valid,
  fallback,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  valid: boolean;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const swatch = valid
    ? value.trim()
    : HEX.test(fallback)
      ? fallback
      : "#4f46e5";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          id={`${id}-picker`}
          aria-label={`${label} picker`}
          value={swatch.length === 4 ? expand(swatch) : swatch}
          onChange={(e) => onChange(e.target.value)}
          className="border-input size-11 shrink-0 cursor-pointer rounded-xl border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          spellCheck={false}
          maxLength={7}
          aria-invalid={!valid}
          aria-describedby={valid ? undefined : `${id}-error`}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#4f46e5"
          className={valid ? "font-mono" : "border-destructive font-mono"}
        />
      </div>
      {!valid && (
        <p id={`${id}-error`} className="text-destructive text-xs">
          Not a hex colour. Use #rgb or #rrggbb — this will not be saved.
        </p>
      )}
    </div>
  );
}

/** `#abc` → `#aabbcc`, which is the only form `<input type="color">` accepts. */
function expand(hex: string): string {
  return `#${hex
    .slice(1)
    .split("")
    .map((c) => c + c)
    .join("")}`;
}

/** `.msg` plus `.user`/`.bot`, at the widget's own metrics. */
function PreviewMessage({
  who,
  text,
  skin,
  accent,
  avatar,
}: {
  who: "user" | "bot";
  text: string;
  skin: typeof WIDGET.light | typeof WIDGET.dark;
  accent: string;
  avatar: string | null;
}) {
  const isUser = who === "user";
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "flex-end",
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
      }}
    >
      {!isUser && avatar && (
        <span
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: "50%",
            backgroundImage: `url("${avatar}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <span
        style={{
          padding: "9px 12px",
          borderRadius: 12,
          fontSize: 14,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          background: isUser ? accent : skin.botBg,
          color: isUser ? "#fff" : skin.fg,
        }}
      >
        {text}
      </span>
    </div>
  );
}
