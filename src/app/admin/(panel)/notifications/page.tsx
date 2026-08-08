import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCapability, requireCapability } from "@/lib/server/auth/dal";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/server/audit-log";
import { fallbackNotificationRecipients } from "@/lib/server/email/notify";
import {
  getSettingsFresh,
  NOTIFICATION_CHANNELS,
  updateSettings,
} from "@/lib/server/settings";
import {
  NotificationSettings,
  type NotificationSaveResult,
  type NotificationSettingsValue,
} from "@/components/admin/notification-settings";

export const metadata: Metadata = { title: "Notifications" };

export const dynamic = "force-dynamic";

/**
 * Notifications.
 *
 * One page for every email the platform sends to its operator. Before this,
 * "will I be told when this happens?" was answered per product — and for
 * chatbot conversations the answer was no, with nowhere to change it.
 *
 * Read fresh rather than cached, like the settings page: this exists to change
 * these values, so showing a stale copy of what was just saved is worse than a
 * round trip.
 */
export default async function NotificationsPage() {
  await requireCapability("manage_settings");

  const settings = await getSettingsFresh();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          What the platform emails you about, and who receives it. Where a
          product keeps its own recipient list — the notify addresses on a form,
          or on a booking page — that list still applies; these addresses are
          added to it rather than replacing it.
        </p>
      </header>

      <NotificationSettings
        initial={settings.notifications}
        fallbackRecipients={fallbackNotificationRecipients()}
        save={saveNotificationSettings}
      />
    </div>
  );
}

/**
 * Recipient lists are validated but deliberately not deduplicated against the
 * suppression list here: a colleague who unsubscribed from marketing has not
 * asked to stop receiving their own account's alerts, and the send pipeline
 * makes that distinction itself.
 */
const recipientList = z
  .array(z.string().trim().toLowerCase().email("Enter valid email addresses."))
  .max(10, "At most 10 addresses.");

const notificationsSchema = z.object({
  defaultRecipients: recipientList,
  channels: z.object(
    Object.fromEntries(
      NOTIFICATION_CHANNELS.map((channel) => [
        channel,
        z.object({ enabled: z.boolean(), recipients: recipientList }),
      ]),
    ) as Record<
      (typeof NOTIFICATION_CHANNELS)[number],
      z.ZodObject<{
        enabled: z.ZodBoolean;
        recipients: typeof recipientList;
      }>
    >,
  ),
  chat: z.object({
    everyConversation: z.boolean(),
    // Bounded rather than free-form: zero would silently stop every alert with
    // the switch still reading "on", and a ceiling in the thousands is not a
    // ceiling.
    maxAlertsPerBotPerHour: z.number().int().min(1).max(100),
  }),
  lowBalance: z.object({
    threshold: z.number().int().min(1).max(100_000),
  }),
});

/**
 * Saves the notification preferences.
 *
 * Defined inline in the page and passed to the client component as a prop,
 * which keeps the whole feature — page, validation, audit trail — readable in
 * one file. `manage_settings` gates it, the same capability as the rest of the
 * settings surface: deciding where the business's leads are emailed is an
 * owner-level decision.
 */
async function saveNotificationSettings(
  value: NotificationSettingsValue,
): Promise<NotificationSaveResult> {
  "use server";

  const session = await assertCapability("manage_settings");

  const parsed = notificationsSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first
        ? `${first.path.join(".")}: ${first.message}`
        : "Check the values and try again.",
    };
  }

  await updateSettings({ notifications: parsed.data });

  await recordAudit({
    action: AUDIT_ACTIONS.settingsUpdated,
    actorId: session.userId,
    detail: {
      section: "notifications",
      // The switches, not the addresses: an audit entry answers "who turned the
      // chatbot alerts off", and listing every recipient on every save buries
      // that under noise (and copies personal data into a second store).
      enabled: NOTIFICATION_CHANNELS.filter(
        (channel) => parsed.data.channels[channel].enabled,
      ),
    },
  });

  revalidatePath("/admin/notifications");
  revalidatePath("/admin/settings");

  return { ok: true };
}
