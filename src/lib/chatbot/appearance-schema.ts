import { z } from "zod";
import { APPEARANCE_LIMITS } from "@/lib/chatbot/appearance";

/**
 * Validation for an appearance PATCH from the admin editor.
 *
 * The editor sends only the fields the operator changed, so every key is
 * optional. Unknown keys are stripped by `z.object`; fields must therefore be
 * declared here to be saved, which is the bug that silently discarded an entire
 * appearance patch before this schema existed.
 */

const noControl = (value: string) => !/[\u0000-\u001f\u007f]/u.test(value);

const hexColour = z
  .string()
  .trim()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    "Use a hex colour such as #4f46e5.",
  );

/**
 * Restricted to http(s) and `data:image/…`. Both values become an `<img src>`
 * on a customer's page, and a `javascript:` URL there is a script vector.
 * Empty is allowed because clearing the field must be possible.
 */
const imageUrl = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .max(APPEARANCE_LIMITS.imageUrl)
    .refine((value) => {
      try {
        const { protocol } = new URL(value);
        if (protocol === "http:" || protocol === "https:") return true;
        return protocol === "data:" && value.startsWith("data:image/");
      } catch {
        return false;
      }
    }, "Use an https:// image URL."),
]);

/**
 * One visible emoji, or empty for the built-in icon. Extended_Pictographic
 * covers ordinary emoji and Regional_Indicator covers flag sequences; markup,
 * quotes, backticks and control characters are refused. The widget still draws
 * this with `textContent`, so this is defence in depth rather than the only
 * guard.
 */
const emoji = z
  .union([z.literal(""), z.string().trim().max(APPEARANCE_LIMITS.emoji)])
  .refine(
    (value) =>
      value === "" ||
      (noControl(value) &&
        !/[<>"'`]/u.test(value) &&
        /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(value)),
    "Use one visible emoji without markup or control characters.",
  );

const prompt = z
  .string()
  .trim()
  .min(1, "A prompt cannot be empty.")
  .max(
    APPEARANCE_LIMITS.promptLength,
    `Keep each prompt to ${APPEARANCE_LIMITS.promptLength} characters or fewer.`,
  )
  .refine(noControl, "Remove control characters from prompts.");

const prompts = z
  .array(prompt)
  .max(
    APPEARANCE_LIMITS.prompts,
    `Use at most ${APPEARANCE_LIMITS.prompts} prompts.`,
  );

export const appearancePatchSchema = z
  .object({
    theme: z.enum(["light", "dark", "auto"]),
    emoji: emoji.nullable(),
    avatar: imageUrl.nullable(),
    logo: imageUrl.nullable(),
    primaryColor: hexColour,
    secondaryColor: hexColour,
    position: z.enum(["bottom-right", "bottom-left"]),
    size: z.enum(["compact", "regular", "large"]),
    displayMode: z.enum(["bubble", "popup", "fullscreen", "embedded"]),
    welcomeMessage: z.string().trim().max(APPEARANCE_LIMITS.welcomeMessage),
    placeholder: z.string().trim().max(APPEARANCE_LIMITS.placeholder),
    typingAnimation: z.boolean(),
    branding: z.boolean(),
    launcherLabel: z
      .string()
      .trim()
      .max(APPEARANCE_LIMITS.launcherLabel)
      .refine(noControl, "Remove control characters from the launcher label."),
    suggestedQuestions: prompts,
    starterPrompts: prompts,
  })
  .partial();

export type AppearancePatch = z.infer<typeof appearancePatchSchema>;
