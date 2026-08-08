"use server";

import { z } from "zod";
import {
  revalidateProduct,
  revalidateProductRecord,
} from "@/lib/server/revalidate-product";
import { assertCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import {
  createForm,
  deleteForm,
  getForm,
  listSubmissions,
  rotatePublicToken,
  setFormStatus,
  setSubmissionStatus,
  updateForm,
} from "@/lib/server/forms/repository";
import { formFieldsSchema } from "@/lib/forms/fields";
import { isNavigableHttpUrl } from "@/lib/navigable-url";

/**
 * Server Actions for form management.
 *
 * Server Actions rather than route handlers so Next's Origin/Host check gives
 * CSRF protection for free. Every action re-authorises with `manage_forms`, and
 * the owner scope is always the acting session's user id — never a value the
 * client supplies.
 */

export type FormActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  allowedDomains: z.array(z.string().trim().max(120)).max(50).optional(),
  notifyEmails: z.array(z.string().trim().max(254)).max(10).optional(),
});

export async function createFormAction(input: {
  name: string;
  allowedDomains?: string[];
  notifyEmails?: string[];
}): Promise<FormActionResult<{ formId: string; publicToken: string }>> {
  const session = await assertCapability("manage_forms");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Give the form a name of at least 2 characters.");
  }

  const created = await createForm({
    ownerId: session.userId,
    name: parsed.data.name,
    allowedDomains: parsed.data.allowedDomains ?? [],
    notifyEmails: parsed.data.notifyEmails ?? [],
  });

  await recordAudit({
    action: AUDIT_ACTIONS.formCreated,
    actorId: session.userId,
    target: { type: "form", id: created.formId },
    detail: { name: parsed.data.name },
  });

  revalidateProduct("forms");
  return { ok: true, data: created };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  allowedDomains: z.array(z.string().trim().max(120)).max(50).optional(),
  notifyEmails: z.array(z.string().trim().max(254)).max(10).optional(),
  honeypotEnabled: z.boolean().optional(),
  redirectUrl: z
    .union([
      z
        .string()
        .trim()
        .max(500)
        // `.url()` alone is not enough: it accepts javascript:, data: and
        // vbscript:. See src/lib/navigable-url.ts — this value ends up in
        // `location.href`, on our own origin for the hosted page.
        .refine(isNavigableHttpUrl, "Use a full http:// or https:// address."),
      z.literal(""),
    ])
    .nullable()
    .optional(),
  thankYouMessage: z.string().trim().min(1).max(500).optional(),
  appearance: z
    .object({
      theme: z.enum(["light", "dark", "auto"]).optional(),
      primaryColor: z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour such as #4f46e5.")
        .optional(),
      buttonText: z.string().trim().min(1).max(40).optional(),
    })
    .optional(),
});

export async function updateFormAction(
  formId: string,
  input: z.input<typeof updateSchema>,
): Promise<FormActionResult> {
  const session = await assertCapability("manage_forms");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the values.");
  }

  const ok = await updateForm(session.userId, formId, {
    ...parsed.data,
    redirectUrl:
      parsed.data.redirectUrl === "" ? null : parsed.data.redirectUrl,
  });
  if (!ok) return fail("That form no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.formUpdated,
    actorId: session.userId,
    target: { type: "form", id: formId },
  });
  revalidateProduct("forms");
  revalidateProductRecord("forms", formId);
  return { ok: true };
}

/** Replaces the field list. Validated with the same schema the builder uses. */
export async function updateFieldsAction(
  formId: string,
  fields: unknown,
): Promise<FormActionResult> {
  const session = await assertCapability("manage_forms");
  const parsed = formFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the fields.");
  }
  if (parsed.data.length === 0) {
    return fail("A form needs at least one field.");
  }

  const ok = await updateForm(session.userId, formId, {
    fields: parsed.data,
  });
  if (!ok) return fail("That form no longer exists.");

  await recordAudit({
    action: AUDIT_ACTIONS.formUpdated,
    actorId: session.userId,
    target: { type: "form", id: formId },
    detail: { fields: parsed.data.length },
  });
  revalidateProductRecord("forms", formId);
  return { ok: true };
}

export async function setFormStatusAction(
  formId: string,
  status: "active" | "paused",
): Promise<FormActionResult> {
  const session = await assertCapability("manage_forms");
  const ok = await setFormStatus(session.userId, formId, status);
  if (!ok) return fail("That form no longer exists.");
  await recordAudit({
    action: AUDIT_ACTIONS.formUpdated,
    actorId: session.userId,
    target: { type: "form", id: formId },
    detail: { status },
  });
  revalidateProduct("forms");
  return { ok: true };
}

export async function rotateFormTokenAction(
  formId: string,
): Promise<FormActionResult<{ publicToken: string }>> {
  const session = await assertCapability("manage_forms");
  const token = await rotatePublicToken(session.userId, formId);
  if (!token) return fail("That form no longer exists.");
  revalidateProductRecord("forms", formId);
  return { ok: true, data: { publicToken: token } };
}

export async function deleteFormAction(
  formId: string,
): Promise<FormActionResult> {
  const session = await assertCapability("manage_forms");
  const ok = await deleteForm(session.userId, formId);
  if (!ok) return fail("That form no longer exists.");
  await recordAudit({
    action: AUDIT_ACTIONS.formDeleted,
    actorId: session.userId,
    target: { type: "form", id: formId },
  });
  revalidateProduct("forms");
  return { ok: true };
}

export async function setSubmissionStatusAction(
  formId: string,
  submissionId: string,
  status: "new" | "spam" | "archived",
): Promise<FormActionResult> {
  const session = await assertCapability("manage_forms");
  const ok = await setSubmissionStatus(session.userId, submissionId, status);
  if (!ok) return fail("That submission no longer exists.");
  await recordAudit({
    action: AUDIT_ACTIONS.formSubmissionStatusChanged,
    actorId: session.userId,
    target: { type: "form_submission", id: submissionId },
    detail: { status },
  });
  revalidateProductRecord("forms", formId);
  return { ok: true };
}

/**
 * Builds a CSV of a form's submissions. Returned as text for the client to
 * download, so no file is written server-side.
 */
export async function exportSubmissionsCsvAction(
  formId: string,
): Promise<FormActionResult<{ csv: string; filename: string }>> {
  const session = await assertCapability("manage_forms");
  const form = await getForm(session.userId, formId);
  if (!form) return fail("That form no longer exists.");

  const submissions = await listSubmissions(session.userId, formId, {
    limit: 1_000,
  });
  const columns = form.fields.map((f) => f.name);
  const header = ["submitted_at", "status", ...columns];

  const escape = (value: unknown): string => {
    const text = value === undefined || value === null ? "" : String(value);
    // Prefix a quote on formula-leading cells: a raw `=`/`+`/`-`/`@` would be
    // executed by Excel when the export is opened (CSV injection).
    const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const rows = submissions.map((s) =>
    [s.createdAt.toISOString(), s.status, ...columns.map((c) => s.data[c])]
      .map(escape)
      .join(","),
  );

  return {
    ok: true,
    data: {
      csv: [header.map(escape).join(","), ...rows].join("\n"),
      filename: `${form.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-submissions.csv`,
    },
  };
}
