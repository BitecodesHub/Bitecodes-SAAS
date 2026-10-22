import type { ChatbotAppearance } from "@/lib/server/db/types";

/**
 * The public appearance contract, shared by the widget, the public config
 * endpoint, the admin editor, and the server action that writes it.
 *
 * Two rules keep old embeds working as this grows:
 *
 * 1. Every field has a deterministic default. A document written before a field
 *    existed normalizes to the same shape as one written today, so the widget
 *    never has to branch on "missing" and an operator's stored colours survive.
 * 2. Unknown fields are ignored, never rejected. The endpoint can therefore add
 *    a field for a newer widget while older cached scripts keep running.
 *
 * `language` and `timezone` are reserved: the contract has a place for them, but
 * the product has no translation or time policy wired to them yet, so the admin
 * editor deliberately does not offer controls for them.
 */
export const CHATBOT_APPEARANCE_VERSION = 2;

export const CHATBOT_APPEARANCE_DEFAULTS: ChatbotAppearance = {
  theme: "auto",
  emoji: "💬",
  avatar: null,
  logo: null,
  primaryColor: "#4f46e5",
  secondaryColor: "#0ea5e9",
  position: "bottom-right",
  size: "regular",
  displayMode: "bubble",
  welcomeMessage: "Hi! How can I help you today?",
  placeholder: "Ask a question…",
  typingAnimation: true,
  branding: true,
  launcherLabel: "Open chat",
  language: "en",
  timezone: "UTC",
  suggestedQuestions: [],
  starterPrompts: [],
};

export const APPEARANCE_LIMITS = {
  emoji: 16,
  welcomeMessage: 300,
  placeholder: 120,
  launcherLabel: 60,
  prompts: 4,
  promptLength: 120,
  imageUrl: 2_000,
} as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const THEMES = new Set<ChatbotAppearance["theme"]>(["light", "dark", "auto"]);
const POSITIONS = new Set<ChatbotAppearance["position"]>([
  "bottom-right",
  "bottom-left",
]);
const SIZES = new Set<ChatbotAppearance["size"]>([
  "compact",
  "regular",
  "large",
]);
const MODES = new Set<ChatbotAppearance["displayMode"]>([
  "bubble",
  "popup",
  "fullscreen",
  "embedded",
]);

function text(
  value: unknown,
  fallback: string,
  max: number,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (
    (!allowEmpty && !trimmed) ||
    trimmed.length > max ||
    CONTROL.test(trimmed)
  ) {
    return fallback;
  }
  return trimmed;
}

function emoji(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return CHATBOT_APPEARANCE_DEFAULTS.emoji;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    trimmed.length > APPEARANCE_LIMITS.emoji ||
    CONTROL.test(trimmed) ||
    !EMOJI.test(trimmed)
  ) {
    return CHATBOT_APPEARANCE_DEFAULTS.emoji;
  }
  return trimmed;
}

function image(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > APPEARANCE_LIMITS.imageUrl) return null;
  try {
    const { protocol } = new URL(trimmed);
    if (protocol === "http:" || protocol === "https:") return trimmed;
    if (protocol === "data:" && trimmed.startsWith("data:image/"))
      return trimmed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Prompts are rendered with `textContent` and submitted as a chat message, so
 * markup in them is displayed literally rather than executed. They are still
 * bounded: a 100,000-character chip is a layout attack on every visitor.
 * Entries that fail the bounds are dropped rather than replaced, because
 * inventing a prompt the operator did not write would be worse than omitting it.
 */
export function normalizePrompts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (
      !trimmed ||
      trimmed.length > APPEARANCE_LIMITS.promptLength ||
      CONTROL.test(trimmed)
    ) {
      continue;
    }
    out.push(trimmed);
    if (out.length === APPEARANCE_LIMITS.prompts) break;
  }
  return out;
}

/**
 * Returns a complete, safe appearance from anything a legacy document or a
 * hand-edited config might contain. Invalid individual fields fall back to the
 * default instead of poisoning the whole object, which is what makes this an
 * upgrade path rather than a validation gate.
 */
export function normalizeAppearance(
  value: Partial<ChatbotAppearance> | null | undefined,
): ChatbotAppearance {
  const input = (value ?? {}) as Partial<
    Record<keyof ChatbotAppearance, unknown>
  >;
  const d = CHATBOT_APPEARANCE_DEFAULTS;

  return {
    theme: THEMES.has(input.theme as ChatbotAppearance["theme"])
      ? (input.theme as ChatbotAppearance["theme"])
      : d.theme,
    emoji: emoji(input.emoji),
    avatar: image(input.avatar),
    logo: image(input.logo),
    primaryColor:
      typeof input.primaryColor === "string" &&
      HEX.test(input.primaryColor.trim())
        ? input.primaryColor.trim()
        : d.primaryColor,
    secondaryColor:
      typeof input.secondaryColor === "string" &&
      HEX.test(input.secondaryColor.trim())
        ? input.secondaryColor.trim()
        : d.secondaryColor,
    position: POSITIONS.has(input.position as ChatbotAppearance["position"])
      ? (input.position as ChatbotAppearance["position"])
      : d.position,
    size: SIZES.has(input.size as ChatbotAppearance["size"])
      ? (input.size as ChatbotAppearance["size"])
      : d.size,
    displayMode: MODES.has(
      input.displayMode as ChatbotAppearance["displayMode"],
    )
      ? (input.displayMode as ChatbotAppearance["displayMode"])
      : d.displayMode,
    welcomeMessage: text(
      input.welcomeMessage,
      d.welcomeMessage,
      APPEARANCE_LIMITS.welcomeMessage,
    ),
    placeholder: text(
      input.placeholder,
      d.placeholder,
      APPEARANCE_LIMITS.placeholder,
    ),
    typingAnimation:
      typeof input.typingAnimation === "boolean"
        ? input.typingAnimation
        : d.typingAnimation,
    branding: typeof input.branding === "boolean" ? input.branding : d.branding,
    launcherLabel: text(
      input.launcherLabel,
      d.launcherLabel,
      APPEARANCE_LIMITS.launcherLabel,
    ),
    language: text(input.language, d.language, 16),
    timezone: text(input.timezone, d.timezone, 64),
    suggestedQuestions: normalizePrompts(input.suggestedQuestions),
    starterPrompts: normalizePrompts(input.starterPrompts),
  };
}
