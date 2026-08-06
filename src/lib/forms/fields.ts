import { z } from "zod";
import type { FormField, FormFieldType } from "@/lib/server/db/types";

/**
 * Form field definitions and the submission validator built from them.
 *
 * Pure and framework-free: the same module validates definitions in the admin
 * UI, renders the widget, and validates untrusted public submissions on the
 * server. Because the type set is closed and the generated schema is `strict`,
 * a submission can never introduce a key the form owner did not define — which
 * is what stops an embedded form from becoming an open write endpoint.
 */

export const FIELD_TYPES = [
  "text",
  "email",
  "textarea",
  "select",
  "checkbox",
  "number",
  "phone",
  "hidden",
] as const;

/** Trap field. A bot fills it; a human never sees it. Mirrors `contact.ts`. */
export const HONEYPOT_FIELD = "_website";

/** Reserved submission keys the widget uses for transport, not for data. */
export const RESERVED_FIELD_NAMES = new Set([
  "_token",
  HONEYPOT_FIELD,
  "__proto__",
  "constructor",
  "prototype",
]);

export const MAX_FIELDS = 40;
const MAX_TEXT_LENGTH = 5_000;
const MAX_TEXTAREA_LENGTH = 20_000;

/** A field name must be a safe, stable key: lowercase, no dots or `$`. */
const fieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Use lowercase letters, numbers, and underscores, starting with a letter.",
  )
  .refine((name) => !RESERVED_FIELD_NAMES.has(name), {
    message: "That field name is reserved.",
  });

/** One field definition, as the admin UI submits it. */
export const formFieldSchema = z
  .object({
    id: z.string().trim().min(1).max(60),
    type: z.enum(FIELD_TYPES),
    name: fieldNameSchema,
    label: z.string().trim().min(1).max(120),
    placeholder: z.string().trim().max(160).nullable(),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(120)).max(50),
    maxLength: z.number().int().min(1).max(MAX_TEXTAREA_LENGTH).nullable(),
  })
  .refine((field) => field.type !== "select" || field.options.length > 0, {
    message: "A select field needs at least one option.",
    path: ["options"],
  });

/** The whole field list: bounded, with unique names. */
export const formFieldsSchema = z
  .array(formFieldSchema)
  .max(MAX_FIELDS)
  .refine(
    (fields) => new Set(fields.map((f) => f.name)).size === fields.length,
    { message: "Field names must be unique." },
  );

/** Default starter fields for a new form — the shape most people want. */
export function defaultFields(): FormField[] {
  return [
    {
      id: "f_name",
      type: "text",
      name: "name",
      label: "Your name",
      placeholder: "Jane Doe",
      required: true,
      options: [],
      maxLength: 120,
    },
    {
      id: "f_email",
      type: "email",
      name: "email",
      label: "Email address",
      placeholder: "jane@example.com",
      required: true,
      options: [],
      maxLength: 254,
    },
    {
      id: "f_message",
      type: "textarea",
      name: "message",
      label: "Message",
      placeholder: "How can we help?",
      required: true,
      options: [],
      maxLength: 4_000,
    },
  ];
}

/** The value schema for one field, before required/optional is applied. */
function valueSchemaFor(field: FormField): z.ZodTypeAny {
  const cap = (fallback: number) =>
    Math.min(field.maxLength ?? fallback, fallback);

  switch (field.type) {
    case "email":
      return z.string().trim().toLowerCase().email().max(254);
    case "number":
      // Coerced: an HTML form always sends strings.
      return z.coerce.number().finite();
    case "checkbox":
      // Unchecked boxes arrive as "false"/absent; checked as "true"/"on".
      return z
        .union([z.boolean(), z.enum(["true", "false", "on", "off", "1", "0"])])
        .transform((v) =>
          typeof v === "boolean" ? v : v === "true" || v === "on" || v === "1",
        );
    case "select":
      // Constrained to the owner's own options — never free text.
      return z.enum(field.options as [string, ...string[]]);
    case "phone":
      return z
        .string()
        .trim()
        .max(32)
        .regex(/^[+()\d\s-]{6,32}$/, "Enter a valid phone number.");
    case "textarea":
      return z.string().trim().max(cap(MAX_TEXTAREA_LENGTH));
    case "text":
    case "hidden":
    default:
      return z.string().trim().max(cap(MAX_TEXT_LENGTH));
  }
}

/**
 * Builds the strict validator for one form's submissions.
 *
 * `strict()` is the important part: unknown keys are rejected rather than
 * silently stored, so a caller cannot smuggle extra data into a submission.
 * The honeypot and transport token are handled by the caller before this runs.
 */
export function buildSubmissionSchema(
  fields: readonly FormField[],
): z.ZodType<Record<string, string | number | boolean>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    const base = valueSchemaFor(field);
    if (field.required) {
      // A required checkbox must actually be ticked; others just need a value.
      shape[field.name] =
        field.type === "checkbox"
          ? base.refine((v) => v === true, {
              message: `${field.label} is required.`,
            })
          : base.refine((v) => v !== "" && v !== undefined && v !== null, {
              message: `${field.label} is required.`,
            });
    } else {
      shape[field.name] = base.optional().or(z.literal(""));
    }
  }

  return z.object(shape).strict() as unknown as z.ZodType<
    Record<string, string | number | boolean>
  >;
}

/** Human label for a field type, for the builder UI. */
export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Short text",
  email: "Email",
  textarea: "Long text",
  select: "Dropdown",
  checkbox: "Checkbox",
  number: "Number",
  phone: "Phone",
  hidden: "Hidden",
};
