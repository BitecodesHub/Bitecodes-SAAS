"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertCapability, getCurrentAdminUser } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { kickJobs } from "@/lib/server/jobs/worker";
import { renderEmail, type EmailBlock } from "@/lib/email/template";
import { OUTREACH_VARIABLES } from "@/lib/email/templates/outreach";
import {
  getTemplate,
  resetTemplate,
  updateTemplate,
} from "@/lib/server/email/templates";
import {
  approveMessages,
  cancelMessages,
  queueEmail,
} from "@/lib/server/email/send";
import { prepareBulkOutreach } from "@/lib/server/email/outreach";
import { enrollProspect, stopEnrollment } from "@/lib/server/email/sequences";
import {
  addSuppression,
  removeSuppression,
} from "@/lib/server/email/suppression";
import { getSettingsFresh } from "@/lib/server/settings";

/**
 * Server Actions for the email surface.
 *
 * The capability split is deliberate: reading and editing templates is
 * `manage_settings`, while anything that puts a message in front of a real person
 * is `send_email`. They are different kinds of mistake — a bad template can be
 * corrected, a sent email cannot be recalled.
 */

export type EmailActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: never } : { data: T }))
  | { ok: false; error: string };

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Block shape accepted from the editor.
 *
 * Validated rather than trusted even though it comes from our own admin UI: a
 * Server Action is a public endpoint, and a malformed block would render into a
 * customer-facing email.
 */
const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text: z.string().max(4_000) }),
  z.object({ type: z.literal("h2"), text: z.string().max(200) }),
  z.object({
    type: z.literal("ul"),
    items: z.array(z.string().max(500)).min(1).max(12),
  }),
  z.object({
    type: z.literal("cta"),
    label: z.string().min(1).max(60),
    url: z.string().min(1).max(500),
  }),
  z.object({ type: z.literal("signature"), text: z.string().max(300) }),
]);

const templateUpdateSchema = z.object({
  key: z.string().min(1).max(120),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(400),
  subject: z.string().trim().min(3).max(200),
  blocks: z.array(blockSchema).min(1).max(30),
  enabled: z.boolean(),
});

export async function updateTemplateAction(input: {
  key: string;
  name: string;
  description: string;
  subject: string;
  blocks: EmailBlock[];
  enabled: boolean;
}): Promise<EmailActionResult<{ unknownVariables: string[] }>> {
  const session = await assertCapability("manage_settings");

  const parsed = templateUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      "Check the template: a subject and at least one block are required.",
    );
  }

  const existing = await getTemplate(parsed.data.key);
  if (!existing) return failure("That template does not exist.");

  // A misspelled variable renders as an empty string, producing sentences like
  // "I could not find a website for ." in a stranger's inbox. Reported rather
  // than rejected, because a template may legitimately reference a variable a
  // future sender will supply.
  const rendered = renderEmail({
    subject: parsed.data.subject,
    blocks: parsed.data.blocks as EmailBlock[],
    variables: Object.fromEntries(
      OUTREACH_VARIABLES.map((entry) => [entry.name, entry.example]),
    ),
  });

  const saved = await updateTemplate(parsed.data.key, {
    name: parsed.data.name,
    description: parsed.data.description,
    subject: parsed.data.subject,
    blocks: parsed.data.blocks as EmailBlock[],
    enabled: parsed.data.enabled,
  });
  if (!saved) return failure("That template could not be saved.");

  await recordAudit({
    action: AUDIT_ACTIONS.emailTemplateUpdated,
    actorId: session.userId,
    target: { type: "email_template", id: parsed.data.key },
    detail: { enabled: parsed.data.enabled },
  });

  revalidatePath("/admin/email");
  revalidatePath(`/admin/email/templates/${parsed.data.key}`);

  return { ok: true, data: { unknownVariables: rendered.missing } };
}

export async function resetTemplateAction(
  key: string,
): Promise<EmailActionResult> {
  const session = await assertCapability("manage_settings");

  const restored = await resetTemplate(key);
  if (!restored) return failure("That template has no shipped default.");

  await recordAudit({
    action: AUDIT_ACTIONS.emailTemplateUpdated,
    actorId: session.userId,
    target: { type: "email_template", id: key },
    detail: { reset: true },
  });

  revalidatePath("/admin/email");
  revalidatePath(`/admin/email/templates/${key}`);
  return { ok: true };
}

/** Renders a template with example values, for the editor preview. */
export async function previewTemplateAction(input: {
  subject: string;
  blocks: EmailBlock[];
}): Promise<
  EmailActionResult<{
    subject: string;
    html: string;
    text: string;
    missing: string[];
  }>
> {
  await assertCapability("manage_settings");

  const parsed = z
    .object({
      subject: z.string().max(200),
      blocks: z.array(blockSchema).max(30),
    })
    .safeParse(input);
  if (!parsed.success) return failure("That template could not be rendered.");

  const settings = await getSettingsFresh();
  const rendered = renderEmail({
    subject: parsed.data.subject,
    blocks: parsed.data.blocks as EmailBlock[],
    variables: Object.fromEntries(
      OUTREACH_VARIABLES.map((entry) => [entry.name, entry.example]),
    ),
    shell: {
      // The real footer, so the preview shows what a recipient sees rather than
      // a tidier version of it.
      postalAddress: settings.contact.address.postal || null,
      unsubscribeUrl: "https://bitecodes.com/api/unsubscribe?t=example",
    },
  });

  return {
    ok: true,
    data: {
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      missing: rendered.missing,
    },
  };
}

const testSendSchema = z.object({
  key: z.string().min(1).max(120),
  to: z.string().trim().toLowerCase().email().max(254),
});

/**
 * Sends one template to a chosen address.
 *
 * Categorised as `transactional`, not `outreach`. That is not a technicality: an
 * outreach-category send would consume the daily cap, be subject to the consent
 * region guard, and appear in the outreach statistics — none of which should
 * happen because an operator checked their own wording.
 */
export async function sendTestEmailAction(input: {
  key: string;
  to: string;
}): Promise<EmailActionResult<{ status: string }>> {
  const session = await assertCapability("send_email");

  const parsed = testSendSchema.safeParse(input);
  if (!parsed.success) return failure("Enter a valid email address.");

  const template = await getTemplate(parsed.data.key);
  if (!template) return failure("That template does not exist.");

  const result = await queueEmail({
    to: parsed.data.to,
    subject: `[TEST] ${template.subject}`,
    blocks: template.blocks,
    variables: Object.fromEntries(
      OUTREACH_VARIABLES.map((entry) => [entry.name, entry.example]),
    ),
    category: "transactional",
    templateKey: template.key,
    skipApproval: true,
    track: false,
    footerNote:
      "This is a test send from the Bitecodes admin panel. Values shown are examples.",
  });

  if (result.status === "skipped") {
    return failure(
      result.detail ?? `Not sent (${result.skipReason ?? "refused"}).`,
    );
  }

  await recordAudit({
    action: AUDIT_ACTIONS.emailTestSent,
    actorId: session.userId,
    target: { type: "email_template", id: template.key },
    detail: { to: parsed.data.to },
  });

  after(() => kickJobs(15_000));
  return { ok: true, data: { status: result.status } };
}

// ---------------------------------------------------------------------------
// Approval queue
// ---------------------------------------------------------------------------

export async function approveMessagesAction(
  messageIds: string[],
): Promise<EmailActionResult<{ approved: number }>> {
  const session = await assertCapability("send_email");
  if (messageIds.length === 0) return failure("Select at least one message.");

  const approved = await approveMessages(messageIds, session.userId);

  await recordAudit({
    action: AUDIT_ACTIONS.emailApproved,
    actorId: session.userId,
    detail: { count: approved },
  });

  // Approved mail should leave promptly rather than waiting for the next tick.
  after(() => kickJobs(20_000));
  revalidatePath("/admin/email");
  return { ok: true, data: { approved } };
}

export async function cancelMessagesAction(
  messageIds: string[],
): Promise<EmailActionResult<{ cancelled: number }>> {
  const session = await assertCapability("send_email");
  if (messageIds.length === 0) return failure("Select at least one message.");

  const cancelled = await cancelMessages(messageIds);

  await recordAudit({
    action: AUDIT_ACTIONS.emailCancelled,
    actorId: session.userId,
    detail: { count: cancelled },
  });

  revalidatePath("/admin/email");
  return { ok: true, data: { cancelled } };
}

// ---------------------------------------------------------------------------
// Outreach from the customers table
// ---------------------------------------------------------------------------

/**
 * Queues tag-matched outreach for selected prospects.
 *
 * This is the action behind "Send email" in the customers table — the feature as
 * originally asked for: pick customers, and each one receives the template for
 * the reason they were classified.
 *
 * Whether anything actually leaves depends on `automation.requireApproval`,
 * which defaults to on. The result reports both counts so the operator is never
 * left guessing whether mail went out or is waiting for them.
 */
export async function sendOutreachAction(prospectIds: string[]): Promise<
  EmailActionResult<{
    queued: number;
    skipped: Array<{ prospectId: string; reason: string; detail: string }>;
    requiresApproval: boolean;
  }>
> {
  const session = await assertCapability("send_email");

  const unique = [...new Set(prospectIds.filter((id) => id.length === 24))];
  if (unique.length === 0) return failure("Select at least one customer.");

  // A bound on one click. Larger campaigns belong in a sequence, where pacing
  // and stopping conditions are explicit.
  if (unique.length > 200) {
    return failure(
      "Select 200 customers or fewer at a time. Larger runs should go through a sequence.",
    );
  }

  const settings = await getSettingsFresh();
  const summary = await prepareBulkOutreach(unique);

  await recordAudit({
    action: AUDIT_ACTIONS.sequenceEnrolled,
    actorId: session.userId,
    detail: {
      queued: summary.queued,
      skipped: summary.skipped.length,
      requiresApproval: settings.automation.requireApproval,
    },
  });

  if (!settings.automation.requireApproval) {
    after(() => kickJobs(20_000));
  }

  revalidatePath("/admin/customers");
  revalidatePath("/admin/email");

  return {
    ok: true,
    data: {
      queued: summary.queued,
      skipped: summary.skipped,
      requiresApproval: settings.automation.requireApproval,
    },
  };
}

// ---------------------------------------------------------------------------
// Suppression list
// ---------------------------------------------------------------------------

const suppressionSchema = z.object({
  value: z.string().trim().min(3).max(254),
});

export async function addSuppressionAction(
  value: string,
): Promise<EmailActionResult<{ value: string }>> {
  const session = await assertCapability("send_email");

  const parsed = suppressionSchema.safeParse({ value });
  if (!parsed.success) {
    return failure("Enter an email address or a domain such as example.com.");
  }

  const result = await addSuppression(
    parsed.data.value,
    "manual",
    "Added by an admin",
  );
  if (!result.value) {
    return failure("That is not a valid address or domain.");
  }

  await recordAudit({
    action: AUDIT_ACTIONS.suppressionAdded,
    actorId: session.userId,
    detail: { value: result.value },
  });

  revalidatePath("/admin/email");
  return { ok: true, data: { value: result.value } };
}

/**
 * Removes a suppression.
 *
 * Restricted to `manage_settings` rather than `send_email`, and audited. Deleting
 * a suppression is the one action here that can cause mail to reach someone who
 * previously opted out, so it should require a deliberate, higher-privilege
 * decision and leave a record of who made it.
 */
export async function removeSuppressionAction(
  value: string,
): Promise<EmailActionResult> {
  const session = await assertCapability("manage_settings");

  const removed = await removeSuppression(value);
  if (!removed) return failure("That entry was not found.");

  await recordAudit({
    action: AUDIT_ACTIONS.suppressionRemoved,
    actorId: session.userId,
    detail: { value },
  });

  revalidatePath("/admin/email");
  return { ok: true };
}

/** Who is acting, for the UI to show alongside destructive controls. */
export async function currentAdminNameAction(): Promise<string> {
  const user = await getCurrentAdminUser();
  return user?.name ?? user?.email ?? "Admin";
}

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

/**
 * Enrols selected customers into the follow-up sequence.
 *
 * Distinct from `sendOutreachAction`, which sends exactly one email. Enrolling
 * commits to up to three over a fortnight, so it is a separate, deliberate
 * choice rather than a checkbox on the same button.
 */
export async function enrollProspectsAction(
  prospectIds: string[],
  sequenceKey = "outreach.default",
): Promise<
  EmailActionResult<{
    enrolled: number;
    skipped: Array<{ prospectId: string; reason: string; detail: string }>;
  }>
> {
  const session = await assertCapability("send_email");

  const unique = [...new Set(prospectIds.filter((id) => id.length === 24))];
  if (unique.length === 0) return failure("Select at least one customer.");
  if (unique.length > 200) {
    return failure("Enrol 200 customers or fewer at a time.");
  }

  let enrolled = 0;
  const skipped: Array<{
    prospectId: string;
    reason: string;
    detail: string;
  }> = [];

  // Sequential: each enrolment sends step one, and that send reads the daily
  // cap. Running them in parallel would let a batch overshoot it.
  for (const prospectId of unique) {
    const result = await enrollProspect(prospectId, sequenceKey);
    if (result.ok) enrolled += 1;
    else
      skipped.push({
        prospectId,
        reason: result.reason,
        detail: result.detail,
      });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.sequenceEnrolled,
    actorId: session.userId,
    detail: { sequenceKey, enrolled, skipped: skipped.length },
  });

  const settings = await getSettingsFresh();
  if (!settings.automation.requireApproval) after(() => kickJobs(20_000));

  revalidatePath("/admin/customers");
  revalidatePath("/admin/email");
  return { ok: true, data: { enrolled, skipped } };
}

/** Stops one running sequence by hand. */
export async function stopEnrollmentAction(
  enrollmentId: string,
): Promise<EmailActionResult> {
  const session = await assertCapability("send_email");

  const stopped = await stopEnrollment(enrollmentId, "manual");
  if (!stopped) return failure("That sequence is not running.");

  await recordAudit({
    action: AUDIT_ACTIONS.sequenceEnrolled,
    actorId: session.userId,
    detail: { stopped: enrollmentId },
  });

  revalidatePath("/admin/email");
  return { ok: true };
}
