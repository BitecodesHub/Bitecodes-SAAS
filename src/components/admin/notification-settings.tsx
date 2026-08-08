"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

/**
 * Every notification the platform can send, on one page.
 *
 * The point of gathering them is that the question "will I be told when this
 * happens?" had five different answers in five different places, one of which
 * was "no, and there is nowhere to say otherwise". A single list makes the gaps
 * visible instead of surprising — which is why the rows that are not yet
 * delivering say so on their face rather than showing a switch that does
 * nothing.
 */

export type NotificationChannelKey =
  | "formSubmission"
  | "chatConversation"
  | "booking"
  | "lowBalance"
  | "failedJob";

export interface NotificationSettingsValue {
  defaultRecipients: string[];
  channels: Record<
    NotificationChannelKey,
    { enabled: boolean; recipients: string[] }
  >;
  chat: { everyConversation: boolean; maxAlertsPerBotPerHour: number };
  lowBalance: { threshold: number };
}

export type NotificationSaveResult =
  | { ok: true }
  | { ok: false; error: string };

interface ChannelCopy {
  key: NotificationChannelKey;
  title: string;
  /** What causes the email. */
  trigger: string;
  /**
   * Whether the product actually calls central notifications today. A row that
   * is not wired keeps its settings — they take effect the moment it is — but
   * says plainly what sends the email right now.
   */
  wired: boolean;
  /** How this interacts with a recipient list the product already owns. */
  relationship?: string;
}

const CHANNELS: ChannelCopy[] = [
  {
    key: "formSubmission",
    title: "Form submissions",
    trigger: "Somebody completes one of your forms.",
    wired: false,
    relationship:
      "Each form carries its own “Notify emails” list, and that list is what sends today — it is the answer to “who owns this form”, so nothing on this page overrides it. Addresses added here are additional recipients, applied on top of a form's own list rather than in place of it.",
  },
  {
    key: "chatConversation",
    title: "Chatbot conversations",
    trigger:
      "A visitor asks your assistant something it could not answer from your knowledge base. That is the valuable one — an unanswered question is a lead and a gap in your content at the same time.",
    wired: true,
    relationship:
      "One email per conversation at most, and a per-assistant hourly ceiling, so a busy bot cannot flood this inbox.",
  },
  {
    key: "booking",
    title: "Bookings",
    trigger: "Somebody books or cancels a slot.",
    wired: false,
    relationship:
      "Like forms, a booking page has its own notify list, and that list is added to these addresses rather than replaced by them.",
  },
  {
    key: "lowBalance",
    title: "Low credit balance",
    trigger:
      "A product's prepaid credits fall to the threshold below. At zero, requests are refused rather than queued, so this is the warning that stops a silent outage.",
    wired: true,
    relationship:
      "Sending today for the email API's own wallet, on each send and on each refusal, at most once a day. Forms separately send an “out of credits” notice to the form's own list when a submission is turned away; the other products will report here as they are connected.",
  },
  {
    key: "failedJob",
    title: "Failed background jobs",
    trigger:
      "A queued job gives up after its retries — an email that never sent, an import that never finished.",
    wired: false,
    relationship:
      "Throttled by job type: when a queue breaks it breaks for every job at once, and one email per failure would tell you the same thing two hundred times.",
  },
];

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const MAX_RECIPIENTS = 10;

function splitList(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function NotificationSettings({
  initial,
  fallbackRecipients,
  save,
}: {
  initial: NotificationSettingsValue;
  /**
   * Where notifications go when nothing is configured — the deployment's
   * `CONTACT_NOTIFICATION_TO`. Shown so an empty list next to an enabled switch
   * does not read as "nobody is being told".
   */
  fallbackRecipients: string[];
  save: (value: NotificationSettingsValue) => Promise<NotificationSaveResult>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [defaults, setDefaults] = useState(
    initial.defaultRecipients.join("\n"),
  );
  const [channels, setChannels] = useState<
    Record<NotificationChannelKey, { enabled: boolean; recipients: string }>
  >(() => {
    const seed = {} as Record<
      NotificationChannelKey,
      { enabled: boolean; recipients: string }
    >;
    for (const channel of CHANNELS) {
      seed[channel.key] = {
        enabled: initial.channels[channel.key].enabled,
        recipients: initial.channels[channel.key].recipients.join("\n"),
      };
    }
    return seed;
  });
  const [everyConversation, setEveryConversation] = useState(
    initial.chat.everyConversation,
  );
  const [maxAlerts, setMaxAlerts] = useState(
    String(initial.chat.maxAlertsPerBotPerHour),
  );
  const [threshold, setThreshold] = useState(
    String(initial.lowBalance.threshold),
  );

  const defaultList = useMemo(() => splitList(defaults), [defaults]);

  const blockers = useMemo(() => {
    const problems: string[] = [];
    const check = (label: string, list: string[]) => {
      const bad = list.filter((entry) => !EMAIL_SHAPE.test(entry));
      if (bad.length > 0)
        problems.push(`${label}: not an email — ${bad.join(", ")}.`);
      if (list.length > MAX_RECIPIENTS) {
        problems.push(`${label}: at most ${MAX_RECIPIENTS} addresses.`);
      }
    };

    check("Everything else goes to", defaultList);
    for (const channel of CHANNELS) {
      check(channel.title, splitList(channels[channel.key].recipients));
    }

    const alerts = Number(maxAlerts);
    if (!Number.isInteger(alerts) || alerts < 1 || alerts > 100) {
      problems.push("Chat alert ceiling must be a whole number from 1 to 100.");
    }
    const low = Number(threshold);
    if (!Number.isInteger(low) || low < 1 || low > 100_000) {
      problems.push(
        "Low-balance threshold must be a whole number from 1 to 100000.",
      );
    }
    return problems;
  }, [channels, defaultList, maxAlerts, threshold]);

  const noRecipientsAnywhere =
    defaultList.length === 0 && fallbackRecipients.length === 0;

  function onSave() {
    if (blockers.length > 0) return;
    start(async () => {
      const value: NotificationSettingsValue = {
        defaultRecipients: defaultList,
        channels: CHANNELS.reduce(
          (accumulator, channel) => {
            accumulator[channel.key] = {
              enabled: channels[channel.key].enabled,
              recipients: splitList(channels[channel.key].recipients),
            };
            return accumulator;
          },
          {} as NotificationSettingsValue["channels"],
        ),
        chat: {
          everyConversation,
          maxAlertsPerBotPerHour: Number(maxAlerts),
        },
        lowBalance: { threshold: Number(threshold) },
      };

      const result = await save(value);
      if (result.ok) {
        toast({ title: "Notification settings saved", variant: "success" });
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

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Everything goes here</h2>
          <p className="text-muted-foreground text-sm">
            The address every notification below reaches unless you give it one
            of its own. A per-notification list is added to this one, never
            substituted for it.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultRecipients">Default recipients</Label>
          <Textarea
            id="defaultRecipients"
            value={defaults}
            onChange={(event) => setDefaults(event.target.value)}
            placeholder={"you@example.com\nteam@example.com"}
            className="min-h-20 font-mono text-sm"
          />
          <p className="text-muted-foreground text-xs">
            One per line. At most {MAX_RECIPIENTS}.
            {fallbackRecipients.length > 0 ? (
              <>
                {" "}
                Leave empty and notifications go to{" "}
                <code>{fallbackRecipients.join(", ")}</code>, the address this
                deployment was configured with.
              </>
            ) : null}
          </p>
        </div>

        {noRecipientsAnywhere ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
            Nothing is configured here and the deployment has no fallback
            address, so every notification below is switched on and reaching
            nobody. Add at least one address.
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-muted-foreground text-sm">
            Everything the platform can email you about.
          </p>
        </div>

        {CHANNELS.map((channel) => (
          <div key={channel.key} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{channel.title}</h3>
                  {channel.wired ? null : (
                    <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                      not sending yet
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {channel.trigger}
                </p>
                {channel.relationship ? (
                  <p className="text-muted-foreground text-sm">
                    {channel.relationship}
                  </p>
                ) : null}
                {channel.wired ? null : (
                  <p className="text-muted-foreground text-xs">
                    Saved here and applied the moment this product starts
                    routing its notifications centrally. Nothing on this row is
                    sending mail today.
                  </p>
                )}
              </div>

              <Switch
                aria-label={`${channel.title} notifications`}
                checked={channels[channel.key].enabled}
                onChange={(event) =>
                  setChannels({
                    ...channels,
                    [channel.key]: {
                      ...channels[channel.key],
                      enabled: event.target.checked,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`recipients-${channel.key}`}>
                Recipients for this notification
              </Label>
              <Textarea
                id={`recipients-${channel.key}`}
                value={channels[channel.key].recipients}
                onChange={(event) =>
                  setChannels({
                    ...channels,
                    [channel.key]: {
                      ...channels[channel.key],
                      recipients: event.target.value,
                    },
                  })
                }
                placeholder="Leave empty to use the default recipients"
                className="min-h-16 font-mono text-sm"
                disabled={!channels[channel.key].enabled}
              />
            </div>

            {channel.key === "chatConversation" ? (
              <div className="space-y-4 border-t pt-4">
                <Switch
                  label="Also tell me about conversations it answered"
                  description="Off by default. An answered question is traffic; the unanswered one is the lead. Turning this on emails you about the first message of every conversation as well, within a smaller share of the hourly ceiling."
                  checked={everyConversation}
                  onChange={(event) =>
                    setEveryConversation(event.target.checked)
                  }
                  disabled={!channels.chatConversation.enabled}
                />
                <div className="max-w-xs space-y-2">
                  <Label htmlFor="maxAlerts">
                    Most alerts per assistant per hour
                  </Label>
                  <Input
                    id="maxAlerts"
                    type="number"
                    min={1}
                    max={100}
                    value={maxAlerts}
                    onChange={(event) => setMaxAlerts(event.target.value)}
                    disabled={!channels.chatConversation.enabled}
                  />
                  <p className="text-muted-foreground text-xs">
                    An assistant whose knowledge base failed to index answers
                    nothing and would otherwise email you about every message.
                  </p>
                </div>
              </div>
            ) : null}

            {channel.key === "lowBalance" ? (
              <div className="max-w-xs space-y-2 border-t pt-4">
                <Label htmlFor="threshold">Warn at this many credits</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  max={100000}
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  disabled={!channels.lowBalance.enabled}
                />
                <p className="text-muted-foreground text-xs">
                  One warning per product per day.
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </section>

      {blockers.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          {blockers.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-3 border-t pt-6">
        <Button onClick={onSave} disabled={pending || blockers.length > 0}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save notifications
        </Button>
      </div>
    </div>
  );
}
