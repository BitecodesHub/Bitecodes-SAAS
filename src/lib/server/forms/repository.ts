import "server-only";

import { randomUUID } from "node:crypto";
import { forms, formSubmissions } from "@/lib/server/db/collections";
import type {
  FormAppearance,
  FormDoc,
  FormField,
  FormStatus,
  FormSubmissionDoc,
  FormSubmissionStatus,
} from "@/lib/server/db/types";
import { randomToken, sha256Hex } from "@/lib/server/crypto";
import { normalizeDomainPattern } from "@/lib/chatbot/domains";
import { defaultFields } from "@/lib/forms/fields";

/**
 * Tenant-scoped data access for forms and their submissions.
 *
 * Every owner-facing read and write is filtered by `ownerId`, so a customer can
 * only ever see or change their own forms — enforced in the query rather than
 * trusted from the caller. The one exception is the public embed path, which
 * resolves a form by id plus its public-token hash and never by owner, because
 * the visitor filling in the form is anonymous.
 */

export const DEFAULT_APPEARANCE: FormAppearance = {
  theme: "auto",
  primaryColor: "#4f46e5",
  buttonText: "Send",
};

export const DEFAULT_THANK_YOU = "Thanks — we have received your message.";

export interface CreateFormInput {
  ownerId: string;
  name: string;
  description?: string | null;
  allowedDomains?: string[];
  fields?: FormField[];
  notifyEmails?: string[];
  appearance?: Partial<FormAppearance>;
}

export interface FormCreated {
  formId: string;
  /** The plaintext public token — shown ONCE for the embed snippet. */
  publicToken: string;
}

function cleanDomains(domains: readonly string[] | undefined): string[] {
  if (!domains) return [];
  return [
    ...new Set(domains.map((d) => normalizeDomainPattern(d)).filter(Boolean)),
  ].slice(0, 50);
}

function cleanEmails(emails: readonly string[] | undefined): string[] {
  if (!emails) return [];
  return [
    ...new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@") && e.length <= 254),
    ),
  ].slice(0, 10);
}

/**
 * Creates a form and mints its public embed token. The token is returned once
 * and stored only as a hash — as with sessions, API keys, and chatbot tokens.
 */
export async function createForm(input: CreateFormInput): Promise<FormCreated> {
  const collection = await forms();
  const now = new Date();
  const formId = randomUUID();
  const publicToken = `fm_pub_${randomToken(24)}`;

  const doc: Omit<FormDoc, "_id"> = {
    formId,
    ownerId: input.ownerId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: "active",
    allowedDomains: cleanDomains(input.allowedDomains),
    fields: input.fields ?? defaultFields(),
    appearance: { ...DEFAULT_APPEARANCE, ...input.appearance },
    publicTokenHash: sha256Hex(publicToken),
    notifyEmails: cleanEmails(input.notifyEmails),
    honeypotEnabled: true,
    redirectUrl: null,
    thankYouMessage: DEFAULT_THANK_YOU,
    submissionCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(doc as FormDoc);
  return { formId, publicToken };
}

export async function listForms(ownerId: string): Promise<FormDoc[]> {
  const collection = await forms();
  return collection
    .find({ ownerId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
}

export async function getForm(
  ownerId: string,
  formId: string,
): Promise<FormDoc | null> {
  const collection = await forms();
  return collection.findOne({ ownerId, formId });
}

/**
 * Resolves a form for the PUBLIC embed path: by id + public-token hash, and
 * only when active. Never scoped by owner, and never returns a paused form.
 */
export async function getFormForPublic(
  formId: string,
  publicToken: string,
): Promise<FormDoc | null> {
  if (!publicToken || publicToken.length > 200) return null;
  const collection = await forms();
  return collection.findOne({
    formId,
    publicTokenHash: sha256Hex(publicToken),
    status: "active",
  });
}

export type UpdatableFormFields = Partial<
  Pick<
    FormDoc,
    | "name"
    | "description"
    | "allowedDomains"
    | "fields"
    | "notifyEmails"
    | "honeypotEnabled"
    | "redirectUrl"
    | "thankYouMessage"
  >
> & {
  /** A partial appearance is merged onto the stored value. */
  appearance?: Partial<FormAppearance>;
};

export async function updateForm(
  ownerId: string,
  formId: string,
  patch: UpdatableFormFields,
): Promise<boolean> {
  const collection = await forms();
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.description !== undefined)
    set.description = patch.description?.trim() || null;
  if (patch.allowedDomains !== undefined)
    set.allowedDomains = cleanDomains(patch.allowedDomains);
  if (patch.notifyEmails !== undefined)
    set.notifyEmails = cleanEmails(patch.notifyEmails);
  if (patch.fields !== undefined) set.fields = patch.fields;
  if (patch.honeypotEnabled !== undefined)
    set.honeypotEnabled = patch.honeypotEnabled;
  if (patch.redirectUrl !== undefined)
    set.redirectUrl = patch.redirectUrl?.trim() || null;
  if (patch.thankYouMessage !== undefined)
    set.thankYouMessage = patch.thankYouMessage.trim() || DEFAULT_THANK_YOU;
  if (patch.appearance !== undefined) {
    // Merge onto the existing appearance so a partial update drops nothing.
    const existing = await collection.findOne(
      { ownerId, formId },
      { projection: { appearance: 1 } },
    );
    if (!existing) return false;
    set.appearance = { ...existing.appearance, ...patch.appearance };
  }

  const result = await collection.updateOne({ ownerId, formId }, { $set: set });
  return result.matchedCount === 1;
}

export async function setFormStatus(
  ownerId: string,
  formId: string,
  status: FormStatus,
): Promise<boolean> {
  const collection = await forms();
  const result = await collection.updateOne(
    { ownerId, formId },
    { $set: { status, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

/** Rotates the public token, invalidating any embed using the old one. */
export async function rotatePublicToken(
  ownerId: string,
  formId: string,
): Promise<string | null> {
  const collection = await forms();
  const publicToken = `fm_pub_${randomToken(24)}`;
  const result = await collection.updateOne(
    { ownerId, formId },
    {
      $set: { publicTokenHash: sha256Hex(publicToken), updatedAt: new Date() },
    },
  );
  return result.matchedCount === 1 ? publicToken : null;
}

/** Deletes a form and every submission it collected. */
export async function deleteForm(
  ownerId: string,
  formId: string,
): Promise<boolean> {
  const collection = await forms();
  const result = await collection.deleteOne({ ownerId, formId });
  if (result.deletedCount !== 1) return false;

  const submissions = await formSubmissions();
  await submissions.deleteMany({ ownerId, formId });
  return true;
}

// --- Submissions ------------------------------------------------------------

export interface RecordSubmissionInput {
  ownerId: string;
  formId: string;
  data: FormSubmissionDoc["data"];
  meta: FormSubmissionDoc["meta"];
  status?: FormSubmissionStatus;
  now?: Date;
}

/** Stores a submission and bumps the form's counter. Returns the id. */
export async function recordSubmission(
  input: RecordSubmissionInput,
): Promise<string> {
  const submissions = await formSubmissions();
  const submissionId = randomUUID();

  await submissions.insertOne({
    submissionId,
    formId: input.formId,
    ownerId: input.ownerId,
    data: input.data,
    meta: input.meta,
    status: input.status ?? "new",
    createdAt: input.now ?? new Date(),
  } as FormSubmissionDoc);

  const collection = await forms();
  await collection.updateOne(
    { formId: input.formId },
    { $inc: { submissionCount: 1 } },
  );

  return submissionId;
}

export async function listSubmissions(
  ownerId: string,
  formId: string,
  options: { limit?: number; status?: FormSubmissionStatus } = {},
): Promise<FormSubmissionDoc[]> {
  const submissions = await formSubmissions();
  return submissions
    .find({
      ownerId,
      formId,
      ...(options.status ? { status: options.status } : {}),
    })
    .sort({ createdAt: -1 })
    .limit(Math.min(1_000, Math.max(1, options.limit ?? 100)))
    .toArray();
}

export async function setSubmissionStatus(
  ownerId: string,
  submissionId: string,
  status: FormSubmissionStatus,
): Promise<boolean> {
  const submissions = await formSubmissions();
  const result = await submissions.updateOne(
    { ownerId, submissionId },
    { $set: { status } },
  );
  return result.matchedCount === 1;
}

export async function countSubmissions(
  ownerId: string,
  formId: string,
): Promise<number> {
  const submissions = await formSubmissions();
  return submissions.countDocuments({ ownerId, formId });
}
