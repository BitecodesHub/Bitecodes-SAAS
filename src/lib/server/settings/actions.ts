"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { flatten, updateSettings } from "@/lib/server/settings";

/**
 * Server Action behind the settings page.
 *
 * Everything here was previously reachable only with a database client:
 * `updateSettings` existed and had no caller, so the approval toggle, the
 * sending caps, and the contact details published in every outbound email and
 * in Organization structured data could not be changed by the person
 * responsible for them.
 *
 * The whole form is `manage_settings`, which owners and admins hold. There is
 * no finer split because the dangerous field here is not any single one: it is
 * `requireApproval`, and turning that off is what the confirmation in the UI is
 * for.
 */

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

/**
 * Caps are bounded rather than free-form. A per-domain cap in the hundreds is
 * indistinguishable from a spam run to a receiving provider, and a zero cap
 * silently stops all outreach with no other signal — both are mistakes worth
 * refusing at the edge.
 */
const settingsSchema = z.object({
  contact: z.object({
    email: z.string().trim().email("Enter a valid email address."),
    salesEmail: z.string().trim().email("Enter a valid email address."),
    phone: z.string().trim().max(40),
    phoneHref: z.string().trim().max(40),
    address: z.object({
      line1: z.string().trim().max(160),
      city: z.string().trim().max(80),
      region: z.string().trim().max(80),
      country: z.string().trim().max(80),
      full: z.string().trim().max(240),
      // Commercial email must carry a postal address, and the send pipeline
      // refuses to deliver without one, so this is the field that most needs
      // to be editable here.
      postal: z.string().trim().max(240),
    }),
  }),
  automation: z.object({
    requireApproval: z.boolean(),
    perDomainDailyCap: z.number().int().min(1).max(50),
    globalDailyCap: z.number().int().min(1).max(2000),
    blockConsentRequiredRegions: z.boolean(),
    autoEnrich: z.boolean(),
    harvestEmails: z.boolean(),
    autopilot: z.boolean(),
    autopilotScoreThreshold: z.number().int().min(0).max(100),
    autopilotDailyEnrollCap: z.number().int().min(1).max(500),
  }),
  outreach: z.object({
    senderName: z.string().trim().min(1, "Say who the email is from.").max(80),
  }),
});

export type SettingsFormInput = z.input<typeof settingsSchema>;

export async function updateSettingsAction(
  input: SettingsFormInput,
): Promise<SettingsActionResult> {
  const session = await assertCapability("manage_settings");

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    // Surface the first real complaint rather than a generic "invalid": the
    // caps and the two email fields are the only things that can fail here, and
    // naming which one saves a guessing game.
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first
        ? `${first.path.join(".")}: ${first.message}`
        : "Check the values and try again.",
    };
  }

  await updateSettings(parsed.data);

  // Record the paths that changed rather than the whole document: an audit
  // entry is for answering "who turned approval off", and dumping every field
  // on every save buries that.
  await recordAudit({
    action: AUDIT_ACTIONS.settingsUpdated,
    actorId: session.userId,
    detail: { fields: Object.keys(flatten(parsed.data)) },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/email");
  revalidatePath("/admin/customers/discover");

  return { ok: true };
}
