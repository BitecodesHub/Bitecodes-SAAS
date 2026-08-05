"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  updateSettingsAction,
  type SettingsFormInput,
} from "@/lib/server/settings/actions";

/**
 * The settings form.
 *
 * Grouped by consequence rather than by database shape: the fields that decide
 * whether mail reaches a stranger sit together at the top, contact details that
 * get published sit below, and nothing here is saved until the whole form is
 * submitted so a half-applied change cannot leave sending enabled with no
 * postal address.
 */

interface SettingsFormProps {
  initial: SettingsFormInput;
  /** True while the compiled-in placeholders are still in place. */
  hasPlaceholders: boolean;
}

export function SettingsForm({ initial, hasPlaceholders }: SettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<SettingsFormInput>(initial);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateSettingsAction(form);
      if (result.ok) {
        toast({ title: "Settings saved", variant: "success" });
        router.refresh();
        return;
      }
      toast({
        title: "Could not save",
        description: result.error,
        variant: "error",
      });
    });
  }

  const automation = form.automation;
  const contact = form.contact;

  return (
    <div className="space-y-8">
      {hasPlaceholders ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            Some contact details are still the shipped placeholders. They are
            published in your Organization structured data, in{" "}
            <code>llms.txt</code>, and in the footer of every outbound email.
          </p>
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Outreach</h2>
          <p className="text-muted-foreground text-sm">
            These decide whether an email can reach a stranger.
          </p>
        </div>

        <ToggleRow
          label="Hold outreach for approval"
          description="Every outreach email waits in the approval queue. Turning this off lets sequences send on their own."
          checked={automation.requireApproval}
          onChange={(requireApproval) =>
            setForm({ ...form, automation: { ...automation, requireApproval } })
          }
        />
        <ToggleRow
          label="Hold consent-required regions"
          description="Recipients in the UK, EU, Australia, and Canada — where cold email needs prior consent — are prepared but held in the approval queue for your manual release rather than auto-sent."
          checked={automation.blockConsentRequiredRegions}
          onChange={(blockConsentRequiredRegions) =>
            setForm({
              ...form,
              automation: { ...automation, blockConsentRequiredRegions },
            })
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="perDomainDailyCap"
            label="Per-domain daily cap"
            hint="Messages per recipient domain per day. 1–50."
            value={automation.perDomainDailyCap}
            onChange={(perDomainDailyCap) =>
              setForm({
                ...form,
                automation: { ...automation, perDomainDailyCap },
              })
            }
          />
          <NumberField
            id="globalDailyCap"
            label="Global daily cap"
            hint="Total outreach per day. 1–2000."
            value={automation.globalDailyCap}
            onChange={(globalDailyCap) =>
              setForm({
                ...form,
                automation: { ...automation, globalDailyCap },
              })
            }
          />
        </div>

        <TextField
          id="senderName"
          label="Sender name"
          hint="Signs every outreach email."
          value={form.outreach.senderName}
          onChange={(senderName) =>
            setForm({ ...form, outreach: { senderName } })
          }
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Discovery</h2>
          <p className="text-muted-foreground text-sm">
            What happens after businesses are found on the map.
          </p>
        </div>

        <ToggleRow
          label="Check websites automatically"
          description="Audits and classifies each newly discovered business. With this off, they stay untagged until you re-check them by hand."
          checked={automation.autoEnrich}
          onChange={(autoEnrich) =>
            setForm({ ...form, automation: { ...automation, autoEnrich } })
          }
        />
        <ToggleRow
          label="Collect published email addresses"
          description="Keeps the contact address a business publishes on its own site."
          checked={automation.harvestEmails}
          onChange={(harvestEmails) =>
            setForm({ ...form, automation: { ...automation, harvestEmails } })
          }
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Autopilot</h2>
          <p className="text-muted-foreground text-sm">
            The hands-off pipeline. When on, saved searches re-run on their
            cadence and qualified customers are contacted automatically — within
            the caps above and never into a held region without your release.
          </p>
        </div>

        <ToggleRow
          label="Run on autopilot"
          description="Discover, check, and contact new customers without you. Leave off to keep everything manual."
          checked={automation.autopilot}
          onChange={(autopilot) =>
            setForm({ ...form, automation: { ...automation, autopilot } })
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="autopilotScoreThreshold"
            label="Minimum score to contact"
            hint="Only auto-contact customers scored at least this (0–100)."
            value={automation.autopilotScoreThreshold}
            onChange={(autopilotScoreThreshold) =>
              setForm({
                ...form,
                automation: { ...automation, autopilotScoreThreshold },
              })
            }
          />
          <NumberField
            id="autopilotDailyEnrollCap"
            label="Daily auto-contact cap"
            hint="Most new customers to start contacting per day. 1–500."
            value={automation.autopilotDailyEnrollCap}
            onChange={(autopilotDailyEnrollCap) =>
              setForm({
                ...form,
                automation: { ...automation, autopilotDailyEnrollCap },
              })
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Contact details</h2>
          <p className="text-muted-foreground text-sm">
            Published on the site and in every email you send.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="email"
            label="Contact email"
            value={contact.email}
            onChange={(email) =>
              setForm({ ...form, contact: { ...contact, email } })
            }
          />
          <TextField
            id="salesEmail"
            label="Sales email"
            value={contact.salesEmail}
            onChange={(salesEmail) =>
              setForm({ ...form, contact: { ...contact, salesEmail } })
            }
          />
          <TextField
            id="phone"
            label="Phone"
            value={contact.phone}
            onChange={(phone) =>
              setForm({ ...form, contact: { ...contact, phone } })
            }
          />
          <TextField
            id="phoneHref"
            label="Phone link"
            hint="Dialable form, such as +919428767709."
            value={contact.phoneHref}
            onChange={(phoneHref) =>
              setForm({ ...form, contact: { ...contact, phoneHref } })
            }
          />
        </div>

        <TextField
          id="postal"
          label="Postal address for email footers"
          hint="Required by law in commercial email. Outreach will not send while this is empty."
          value={contact.address.postal}
          onChange={(postal) =>
            setForm({
              ...form,
              contact: { ...contact, address: { ...contact.address, postal } },
            })
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="line1"
            label="Address line"
            value={contact.address.line1}
            onChange={(line1) =>
              setForm({
                ...form,
                contact: { ...contact, address: { ...contact.address, line1 } },
              })
            }
          />
          <TextField
            id="city"
            label="City"
            value={contact.address.city}
            onChange={(city) =>
              setForm({
                ...form,
                contact: { ...contact, address: { ...contact.address, city } },
              })
            }
          />
          <TextField
            id="region"
            label="Region"
            value={contact.address.region}
            onChange={(region) =>
              setForm({
                ...form,
                contact: {
                  ...contact,
                  address: { ...contact.address, region },
                },
              })
            }
          />
          <TextField
            id="country"
            label="Country"
            value={contact.address.country}
            onChange={(country) =>
              setForm({
                ...form,
                contact: {
                  ...contact,
                  address: { ...contact.address, country },
                },
              })
            }
          />
        </div>

        <TextField
          id="full"
          label="Short location line"
          hint="Shown in the site footer, such as Remote-first · Ahmedabad, India."
          value={contact.address.full}
          onChange={(full) =>
            setForm({
              ...form,
              contact: { ...contact, address: { ...contact.address, full } },
            })
          }
        />
      </section>

      <div className="flex items-center gap-3 border-t pt-6">
        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save settings
        </Button>
        {automation.requireApproval ? null : (
          <p className="text-sm text-amber-600">
            Outreach will send without review.
          </p>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      <Switch
        label={label}
        description={description}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
