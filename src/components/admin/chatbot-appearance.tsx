"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RotateCcw, Save } from "lucide-react";
import { updateChatbotAction } from "@/lib/server/chatbot/actions";
import type { ChatbotAppearance } from "@/lib/server/db/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Appearance editor for one chatbot, with a live preview of the widget.
 *
 * The twelve fields below are the whole of `ChatbotAppearance` that a customer
 * can reasonably choose. `language`, `timezone`, `suggestedQuestions` and
 * `starterPrompts` are deliberately left out: nothing reads them yet either,
 * and a list editor for prompts that go nowhere is a bigger lie than a colour
 * picker that goes nowhere.
 *
 * The preview is built from the values literally embedded in
 * `src/app/widget.js/route.ts` (see `WIDGET`), not from values that make the
 * result look good. Today the shipped widget honours NONE of these settings —
 * it hardcodes its CSS and there is no public config endpoint for chatbots to
 * fetch appearance from — so every control carries its own warning and the
 * preview can be flipped to "Deployed widget" to show what a visitor actually
 * gets. An editor whose preview flatters the outcome would have the operator
 * shipping a brand colour that never appears on their site.
 */

/** The subset this editor owns. A full `ChatbotAppearance` satisfies it. */
export type EditableAppearance = Pick<
  ChatbotAppearance,
  | "theme"
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
>;

const KEYS = [
  "theme",
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
] as const satisfies readonly (keyof EditableAppearance)[];

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
  large: { bubble: 64, w: 400, h: 600 },
};

/** Height of the fake host page in the preview, in CSS pixels. */
const FRAME_H = 640;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * What the deployed widget ignores, per field. Written from reading
 * `widget.js/route.ts`, and phrased as what the visitor gets instead so the
 * operator can decide whether the setting is worth filling in yet.
 */
const WARNINGS: Record<keyof EditableAppearance, string> = {
  theme:
    "The widget only follows the visitor's own OS setting (prefers-color-scheme). A forced light or dark is stored and ignored.",
  avatar: "The widget renders no avatar, on any message.",
  logo: `The widget renders no logo. Its header is the fixed text “${WIDGET.headerText}”.`,
  primaryColor: `The widget hardcodes ${WIDGET.accent} for the bubble, header, visitor message and Send button.`,
  secondaryColor:
    "Nothing in the product reads this yet — not the widget, not the chat API. It is stored only.",
  position: `The widget is pinned bottom-right (bottom:${WIDGET.offset}px;right:${WIDGET.offset}px).`,
  size: `The widget has one size: a ${WIDGET.panelW}×${WIDGET.panelH} panel and a ${WIDGET.bubble}px bubble, i.e. “regular”.`,
  displayMode:
    "Only bubble exists. Popup, fullscreen and embedded have no implementation at all.",
  welcomeMessage: `The widget greets every visitor with the fixed “${WIDGET.greeting}”.`,
  placeholder: `The widget input is hardcoded to “${WIDGET.placeholder}”.`,
  typingAnimation:
    "The widget shows no typing indicator; the answer streams straight into an empty bubble.",
  branding: "The widget renders no “Powered by” row whether this is on or off.",
};

interface Draft extends Omit<EditableAppearance, "avatar" | "logo"> {
  /** Empty string rather than null, because that is what an `<input>` holds. */
  avatar: string;
  logo: string;
}

function toDraft(a: EditableAppearance): Draft {
  return { ...a, avatar: a.avatar ?? "", logo: a.logo ?? "" };
}

function fromDraft(d: Draft): EditableAppearance {
  return {
    ...d,
    avatar: d.avatar.trim() || null,
    logo: d.logo.trim() || null,
    primaryColor: d.primaryColor.trim(),
    secondaryColor: d.secondaryColor.trim(),
    welcomeMessage: d.welcomeMessage.trim(),
    placeholder: d.placeholder.trim(),
  };
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
}: {
  chatbotId: string;
  appearance: EditableAppearance;
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
  const [showDeployed, setShowDeployed] = useState(false);
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
  }

  const primaryValid = HEX.test(draft.primaryColor.trim());
  const secondaryValid = HEX.test(draft.secondaryColor.trim());
  const colorsValid = primaryValid && secondaryValid;

  const patch = useMemo(() => {
    const next = fromDraft(draft);
    const out: Partial<EditableAppearance> = {};
    for (const key of KEYS) {
      if (next[key] !== saved[key]) {
        // A per-key assignment keeps each value's own type; the index write is
        // the only way to build a Partial in a loop without a cast per branch.
        (out as Record<string, unknown>)[key] = next[key];
      }
    }
    return out;
  }, [draft, saved]);

  const dirty = Object.keys(patch).length > 0;

  function save() {
    if (!dirty || !colorsValid) return;
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
  }

  // The preview's effective configuration. In "deployed" mode every setting is
  // replaced by the widget's own literal, which is the point of the toggle.
  const view = showDeployed
    ? {
        theme: "auto" as EditableAppearance["theme"],
        displayMode: "bubble" as EditableAppearance["displayMode"],
        position: "bottom-right" as EditableAppearance["position"],
        size: "regular" as EditableAppearance["size"],
        accent: WIDGET.accent,
        header: WIDGET.headerText,
        welcome: WIDGET.greeting,
        placeholder: WIDGET.placeholder,
        typing: false,
        branding: false,
        avatar: null as string | null,
        logo: null as string | null,
      }
    : {
        theme: draft.theme,
        displayMode: draft.displayMode,
        position: draft.position,
        size: draft.size,
        accent: primaryValid ? draft.primaryColor.trim() : WIDGET.accent,
        header: WIDGET.headerText,
        welcome: draft.welcomeMessage.trim() || WIDGET.greeting,
        placeholder: draft.placeholder.trim() || WIDGET.placeholder,
        typing: draft.typingAnimation,
        branding: draft.branding,
        avatar: safeImageUrl(draft.avatar),
        logo: safeImageUrl(draft.logo),
      };

  const dims = SIZES[view.size];
  const dark = view.theme === "dark" || (view.theme === "auto" && systemDark);
  const skin = dark ? WIDGET.dark : WIDGET.light;
  // The real panel is `max-height:calc(100vh - 120px)`, so a taller size is
  // shrunk rather than clipped. The frame stands in for the viewport.
  const panelH = Math.min(dims.h, FRAME_H - 120);
  /** Every non-bubble mode is centred in the frame; only bubble is corner-anchored. */
  const centred = view.displayMode !== "bubble";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="space-y-6">
        <section
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" />
            None of this reaches the widget yet
          </p>
          <p className="mt-2">
            <code>widget.js</code> embeds its styling literally, and there is no
            public config endpoint for a chatbot to fetch appearance from —
            forms have <code>/api/forms/[formId]/config</code>, chatbots have no
            equivalent. Values you save here are stored on the chatbot and
            served to nothing. Each control says what a visitor gets instead.
          </p>
        </section>

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
              warning={WARNINGS.primaryColor}
            />
            <ColorField
              id="ap-secondary"
              label="Secondary colour"
              value={draft.secondaryColor}
              valid={secondaryValid}
              fallback={saved.secondaryColor}
              onChange={(v) => set("secondaryColor", v)}
              warning={WARNINGS.secondaryColor}
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
              <FieldWarning text={WARNINGS.theme} />
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
              <FieldWarning text={WARNINGS.position} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-size">Size</Label>
              <Select
                id="ap-size"
                value={draft.size}
                onChange={(e) => set("size", e.target.value as Draft["size"])}
              >
                <option value="compact">
                  Compact — {SIZES.compact.w}×{SIZES.compact.h} (proposed)
                </option>
                <option value="regular">
                  Regular — {SIZES.regular.w}×{SIZES.regular.h} (shipped)
                </option>
                <option value="large">
                  Large — {SIZES.large.w}×{SIZES.large.h} (proposed)
                </option>
              </Select>
              <FieldWarning text={WARNINGS.size} />
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
                <option value="bubble">Bubble (shipped)</option>
                <option value="popup">Popup (not built)</option>
                <option value="fullscreen">Fullscreen (not built)</option>
                <option value="embedded">Embedded (not built)</option>
              </Select>
              <FieldWarning text={WARNINGS.displayMode} />
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
              <FieldWarning text={WARNINGS.welcomeMessage} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-placeholder">Input placeholder</Label>
              <Input
                id="ap-placeholder"
                value={draft.placeholder}
                maxLength={100}
                onChange={(e) => set("placeholder", e.target.value)}
                placeholder={WIDGET.placeholder}
              />
              <FieldWarning text={WARNINGS.placeholder} />
            </div>
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
              <FieldWarning text={WARNINGS.avatar} />
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
              <FieldWarning text={WARNINGS.logo} />
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
              <FieldWarning text={WARNINGS.typingAnimation} indent />
            </div>
            <div className="space-y-1.5">
              <Checkbox
                id="ap-branding"
                label="Show “Powered by Bitecodes” in the panel"
                checked={draft.branding}
                onChange={(e) => set("branding", e.target.checked)}
              />
              <FieldWarning text={WARNINGS.branding} indent />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending || !dirty || !colorsValid}>
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

          <p className="text-muted-foreground text-xs">
            {!colorsValid
              ? "Fix the hex value before saving."
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
      <div className="lg:sticky lg:top-6 lg:w-[440px]">
        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Preview</h2>
            <Badge variant={showDeployed ? "muted" : "default"}>
              {showDeployed ? "Deployed widget" : "Your settings"}
            </Badge>
          </div>

          <div className="mt-3">
            <Checkbox
              id="ap-preview-deployed"
              label="Show what a visitor gets today (ignores every setting)"
              checked={showDeployed}
              onChange={(e) => setShowDeployed(e.target.checked)}
            />
          </div>

          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            {showDeployed
              ? `Exactly what widget.js renders: ${WIDGET.accent}, ${WIDGET.panelW}×${WIDGET.panelH}, bottom-right, OS theme, no avatar, no logo, no branding.`
              : `${dims.w}×${panelH} panel, ${dims.bubble}px bubble, ${view.position}, ${dark ? "dark" : "light"} skin, ${view.displayMode} mode.`}{" "}
            The frame below is {FRAME_H}px tall, so the panel is capped the same
            way the real one is by <code>max-height:calc(100vh - 120px)</code>.
          </p>

          <div
            aria-hidden="true"
            className="border-border bg-muted/40 relative mt-3 overflow-hidden rounded-xl border"
            style={{ height: FRAME_H }}
          >
            {view.displayMode !== "bubble" && (
              <p className="absolute top-0 right-0 left-0 z-10 bg-amber-500 px-2 py-1 text-center text-[11px] font-medium text-amber-950">
                {view.displayMode} is not implemented in widget.js
              </p>
            )}

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
                  width:
                    view.displayMode === "fullscreen"
                      ? "100%"
                      : Math.min(dims.w, 400),
                  height: view.displayMode === "fullscreen" ? FRAME_H : panelH,
                  background: skin.panelBg,
                  color: skin.fg,
                  // .panel{border-radius:16px}
                  borderRadius: view.displayMode === "fullscreen" ? 0 : 16,
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
                    gap: 10,
                  }}
                >
                  {view.logo && (
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        backgroundImage: `url("${view.logo}")`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                      }}
                    />
                  )}
                  <span style={{ fontSize: 15 }}>{view.header}</span>
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
                    background: view.accent,
                    color: "#fff",
                    fontSize: 24,
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
                  }}
                >
                  💬
                </div>
              )}
            </div>
          </div>

          {!showDeployed && !primaryValid && (
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

function FieldWarning({ text, indent }: { text: string; indent?: boolean }) {
  return (
    <p
      className={`text-xs leading-relaxed text-amber-600 dark:text-amber-500 ${
        indent ? "pl-7" : ""
      }`}
    >
      {text}
    </p>
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
  warning,
}: {
  id: string;
  label: string;
  value: string;
  valid: boolean;
  fallback: string;
  onChange: (value: string) => void;
  warning: string;
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
      <FieldWarning text={warning} />
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
