import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";
import {
  getSettingsFresh,
  hasPlaceholderContactDetails,
} from "@/lib/server/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

/**
 * Settings.
 *
 * Reads fresh rather than cached: the page exists to change these values, and
 * showing a stale copy of what you just saved is worse here than a round trip.
 */
export default async function SettingsPage() {
  await requireCapability("manage_settings");

  const settings = await getSettingsFresh();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Contact details, sending limits, and what happens automatically. These
          take effect on the next send — nothing here is a deploy.
        </p>
      </header>

      <SettingsForm
        hasPlaceholders={hasPlaceholderContactDetails(settings)}
        initial={{
          contact: {
            email: settings.contact.email,
            salesEmail: settings.contact.salesEmail,
            phone: settings.contact.phone,
            phoneHref: settings.contact.phoneHref,
            address: {
              line1: settings.contact.address.line1,
              city: settings.contact.address.city,
              region: settings.contact.address.region,
              country: settings.contact.address.country,
              full: settings.contact.address.full,
              postal: settings.contact.address.postal,
            },
          },
          automation: {
            requireApproval: settings.automation.requireApproval,
            perDomainDailyCap: settings.automation.perDomainDailyCap,
            globalDailyCap: settings.automation.globalDailyCap,
            blockConsentRequiredRegions:
              settings.automation.blockConsentRequiredRegions,
            autoEnrich: settings.automation.autoEnrich,
            harvestEmails: settings.automation.harvestEmails,
          },
          outreach: { senderName: settings.outreach.senderName },
        }}
      />
    </div>
  );
}
