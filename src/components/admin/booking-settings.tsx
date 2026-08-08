"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarOff,
  Clock,
  Globe2,
  Loader2,
  Mail,
  Palette,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { updateBookingAction } from "@/lib/server/bookings/actions";
import {
  generateSlots,
  isValidTimezone,
  zonedParts,
} from "@/lib/bookings/availability";
import type {
  AvailabilityWindow,
  BookingAppearance,
} from "@/lib/server/db/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/**
 * Settings editor for one booking calendar.
 *
 * Everything `updateBookingAction` accepts, saved in one call — the same shape
 * as the form settings panel, for the same reason: the action takes a partial
 * and merges, so one round trip is both cheaper and harder to leave half
 * applied.
 *
 * The availability editor is the part that needs explaining. An operator thinks
 * in wall-clock times on named weekdays; storage needs minutes from midnight on
 * a numeric day index, because arithmetic on "09:00" means parsing a string
 * every time. The editor is therefore a translation layer, and the *only* thing
 * that makes the translation trustworthy is that the slot preview is computed
 * by the real engine — `generateSlots` from src/lib/bookings/availability.ts,
 * the same function the public widget will call. A preview drawn with its own
 * arithmetic would agree with the engine right up until the day it did not, and
 * the day it did not would be a daylight-saving Sunday.
 */

/** 0 = Sunday, matching `AvailabilityWindow["day"]` and `Date.getUTCDay()`. */
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Rendered Monday-first: a working week reads better than a calendar week. */
const DAY_ORDER: ReadonlyArray<AvailabilityWindow["day"]> = [
  1, 2, 3, 4, 5, 6, 0,
];

/**
 * A shortlist, not the whole IANA database.
 *
 * The full list is ~600 entries and picking from it is worse than typing. These
 * cover the zones this product is actually sold into; anything else is entered
 * by hand in the box beside the picker, which is validated against the runtime's
 * own zone table rather than against this list.
 */
export const COMMON_TIMEZONES: ReadonlyArray<{ value: string; label: string }> =
  [
    { value: "Asia/Kolkata", label: "Asia/Kolkata — India" },
    { value: "Asia/Dubai", label: "Asia/Dubai — Gulf" },
    { value: "Asia/Singapore", label: "Asia/Singapore" },
    { value: "Asia/Tokyo", label: "Asia/Tokyo" },
    { value: "Australia/Sydney", label: "Australia/Sydney" },
    { value: "Australia/Perth", label: "Australia/Perth" },
    { value: "Europe/London", label: "Europe/London — UK" },
    { value: "Europe/Dublin", label: "Europe/Dublin" },
    { value: "Europe/Paris", label: "Europe/Paris — CET" },
    { value: "Europe/Berlin", label: "Europe/Berlin — CET" },
    { value: "America/New_York", label: "America/New_York — US Eastern" },
    { value: "America/Chicago", label: "America/Chicago — US Central" },
    { value: "America/Denver", label: "America/Denver — US Mountain" },
    { value: "America/Los_Angeles", label: "America/Los_Angeles — US Pacific" },
    { value: "America/Sao_Paulo", label: "America/Sao_Paulo" },
    { value: "Africa/Johannesburg", label: "Africa/Johannesburg" },
    { value: "UTC", label: "UTC — no daylight saving" },
  ];

const THEMES: ReadonlyArray<{
  value: BookingAppearance["theme"];
  label: string;
}> = [
  { value: "auto", label: "Match the visitor's system" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Keep in step with `normalizeDomainPattern` in src/lib/chatbot/domains.ts. */
function normalizeDomain(pattern: string): string {
  return pattern
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function looksLikeDomain(normalized: string): boolean {
  if (normalized === "*") return true;
  if (!/^(\*\.)?[a-z0-9.-]+$/.test(normalized)) return false;
  const host = normalized.replace(/^\*\./, "");
  return host.includes(".") || host === "localhost";
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Minutes from midnight to the `HH:MM` an `<input type="time">` accepts.
 *
 * Clamped at 23:59 because that input has no representation for a 24:00 end.
 * The one lost minute cannot change a slot count for any slot length above one
 * minute, and the alternative — an empty box where a value used to be — would
 * silently delete the window on the next save.
 */
function minutesToTime(minute: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minute)));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

/** `HH:MM` back to minutes, or null when the box is empty or unparseable. */
function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

interface WindowDraft {
  /** Stable across edits so React keys do not reshuffle as rows are removed. */
  key: string;
  start: string;
  end: string;
}

/** Seven buckets, index = day number, so a day with no hours is still present. */
type DayDrafts = WindowDraft[][];

function toDrafts(windows: readonly AvailabilityWindow[]): DayDrafts {
  const drafts: DayDrafts = [[], [], [], [], [], [], []];
  windows.forEach((w, index) => {
    drafts[w.day]?.push({
      key: `seed-${index}`,
      start: minutesToTime(w.startMinute),
      end: minutesToTime(w.endMinute),
    });
  });
  for (const day of drafts) day.sort((a, b) => a.start.localeCompare(b.start));
  return drafts;
}

/** Only fully-valid windows survive: a half-typed row must not reach storage. */
function toWindows(drafts: DayDrafts): AvailabilityWindow[] {
  const windows: AvailabilityWindow[] = [];
  drafts.forEach((day, index) => {
    for (const draft of day) {
      const startMinute = timeToMinutes(draft.start);
      const endMinute = timeToMinutes(draft.end);
      if (startMinute === null || endMinute === null) continue;
      if (endMinute <= startMinute) continue;
      windows.push({
        day: index as AvailabilityWindow["day"],
        startMinute,
        endMinute,
      });
    }
  });
  return windows;
}

export interface BookingSettingsInitial {
  name: string;
  description: string | null;
  allowedDomains: string[];
  notifyEmails: string[];
  timezone: string;
  slotMinutes: number;
  leadTimeHours: number;
  horizonDays: number;
  availability: AvailabilityWindow[];
  blackoutDates: string[];
  confirmationMessage: string;
  appearance: BookingAppearance;
}

export function BookingSettings({
  bookingId,
  initial,
}: {
  bookingId: string;
  initial: BookingSettingsInitial;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const nextKey = useRef(0);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [domains, setDomains] = useState(initial.allowedDomains.join("\n"));
  const [notify, setNotify] = useState(initial.notifyEmails.join("\n"));
  const [timezone, setTimezone] = useState(initial.timezone);
  const [slotMinutes, setSlotMinutes] = useState(String(initial.slotMinutes));
  const [leadTimeHours, setLeadTimeHours] = useState(
    String(initial.leadTimeHours),
  );
  const [horizonDays, setHorizonDays] = useState(String(initial.horizonDays));
  const [drafts, setDrafts] = useState<DayDrafts>(() =>
    toDrafts(initial.availability),
  );
  const [blackouts, setBlackouts] = useState<string[]>(() =>
    [...initial.blackoutDates].sort(),
  );
  const [blackoutDraft, setBlackoutDraft] = useState("");
  const [confirmation, setConfirmation] = useState(initial.confirmationMessage);
  const [theme, setTheme] = useState<BookingAppearance["theme"]>(
    initial.appearance.theme,
  );
  const [primaryColor, setPrimaryColor] = useState(
    initial.appearance.primaryColor,
  );
  const [buttonText, setButtonText] = useState(initial.appearance.buttonText);

  function mutateDay(
    day: AvailabilityWindow["day"],
    fn: (windows: WindowDraft[]) => WindowDraft[],
  ) {
    setDrafts((current) =>
      current.map((windows, index) => (index === day ? fn(windows) : windows)),
    );
  }

  function addWindow(day: AvailabilityWindow["day"]) {
    nextKey.current += 1;
    const key = `w-${nextKey.current}`;
    mutateDay(day, (windows) => {
      // A new row copies the previous one's end as its start, because the
      // common case is a split day — mornings, then afternoons after a break.
      const previous = windows[windows.length - 1];
      const startAt = previous ? previous.end : "09:00";
      return [...windows, { key, start: startAt, end: "17:00" }];
    });
  }

  /** Copies Monday's rows onto every other weekday — the usual shape by far. */
  function copyMondayToWeekdays() {
    const monday = drafts[1] ?? [];
    setDrafts((current) =>
      current.map((windows, index) => {
        if (index < 2 || index > 5) return windows;
        return monday.map((w, position) => {
          nextKey.current += 1;
          return { ...w, key: `copy-${index}-${position}-${nextKey.current}` };
        });
      }),
    );
  }

  const timezoneValid = isValidTimezone(timezone.trim());
  const slotNumber = Number(slotMinutes);
  const leadNumber = Number(leadTimeHours);
  const horizonNumber = Number(horizonDays);

  const availability = useMemo(() => toWindows(drafts), [drafts]);

  /**
   * Anchored to the start of the current UTC day rather than to `Date.now()`.
   *
   * This component renders on the server and hydrates on the client, and those
   * two renders happen milliseconds apart. A `now`-based preview can therefore
   * differ between them by exactly one slot — the one that just passed — which
   * React reports as a hydration mismatch. Rounding to midnight makes the two
   * renders agree.
   */
  const anchor = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, []);

  /**
   * A typical week, deliberately: no lead time and no blackout dates.
   *
   * Both of those subtract from a *particular* week rather than describing the
   * schedule, and an operator checking their configured hours should not have
   * to mentally add back the four slots today's lead time happens to be hiding.
   * Daylight saving is left in, because that genuinely is a property of the
   * schedule — a spring-forward week really does have fewer slots in it.
   */
  const previewSlots = useMemo(() => {
    if (!timezoneValid) return [];
    if (!Number.isFinite(slotNumber) || slotNumber <= 0) return [];
    return generateSlots(
      {
        timezone: timezone.trim(),
        slotMinutes: slotNumber,
        leadTimeHours: 0,
        horizonDays: 7,
        availability,
        blackoutDates: [],
      },
      anchor,
    );
  }, [timezoneValid, timezone, slotNumber, availability, anchor]);

  /**
   * Per-day counts read back out of the generated slots rather than recomputed.
   *
   * Dividing a window's length by the slot length would be the obvious way and
   * is wrong twice a year: on a clock-change day the engine drops the hour that
   * does not exist, and only the engine knows which day that is.
   */
  const perDayCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    if (!timezoneValid) return counts;
    for (const slot of previewSlots) {
      const { weekday } = zonedParts(new Date(slot.startIso), timezone.trim());
      counts[weekday] = (counts[weekday] ?? 0) + 1;
    }
    return counts;
  }, [previewSlots, timezone, timezoneValid]);

  const domainList = useMemo(
    () => splitList(domains).map(normalizeDomain).filter(Boolean),
    [domains],
  );
  const badDomains = useMemo(
    () => domainList.filter((d) => !looksLikeDomain(d)),
    [domainList],
  );
  const emailList = useMemo(
    () => splitList(notify).map((e) => e.toLowerCase()),
    [notify],
  );
  const badEmails = useMemo(
    () => emailList.filter((e) => !EMAIL_SHAPE.test(e)),
    [emailList],
  );

  /** Rows the operator has started but not finished — dropped on save if left. */
  const incompleteWindows = useMemo(() => {
    const problems: string[] = [];
    drafts.forEach((day, index) => {
      for (const draft of day) {
        const startMinute = timeToMinutes(draft.start);
        const endMinute = timeToMinutes(draft.end);
        if (startMinute === null || endMinute === null) {
          problems.push(`${DAY_NAMES[index]} has a window with a blank time.`);
        } else if (endMinute <= startMinute) {
          problems.push(
            `${DAY_NAMES[index]} has a window ending at or before it starts.`,
          );
        }
      }
    });
    return [...new Set(problems)];
  }, [drafts]);

  const trimmedName = name.trim();
  const colorBroken = !HEX_COLOR.test(primaryColor.trim());

  const blockers: string[] = [];
  if (trimmedName.length < 2)
    blockers.push("Name needs at least 2 characters.");
  if (description.trim().length > 500)
    blockers.push("Description is over 500 characters.");
  if (!timezoneValid)
    blockers.push(
      "Timezone is not one this runtime recognises — use an IANA name such as Asia/Kolkata.",
    );
  if (!Number.isInteger(slotNumber) || slotNumber < 5 || slotNumber > 480)
    blockers.push("Slot length must be a whole number of minutes, 5 to 480.");
  if (!Number.isInteger(leadNumber) || leadNumber < 0 || leadNumber > 720)
    blockers.push("Lead time must be a whole number of hours, 0 to 720.");
  if (
    !Number.isInteger(horizonNumber) ||
    horizonNumber < 1 ||
    horizonNumber > 365
  )
    blockers.push("Horizon must be a whole number of days, 1 to 365.");
  blockers.push(...incompleteWindows);
  if (badDomains.length > 0)
    blockers.push(`Not a domain: ${badDomains.join(", ")}.`);
  if (domainList.length > 50) blockers.push("At most 50 domains.");
  if (badEmails.length > 0)
    blockers.push(`Not an email address: ${badEmails.join(", ")}.`);
  if (emailList.length > 10) blockers.push("At most 10 notify addresses.");
  if (confirmation.trim().length < 1)
    blockers.push("Confirmation message cannot be empty.");
  if (confirmation.trim().length > 500)
    blockers.push("Confirmation message is over 500 characters.");
  if (colorBroken) blockers.push("Primary colour must be a hex like #4f46e5.");
  if (buttonText.trim().length < 1)
    blockers.push("Button text cannot be empty.");
  if (buttonText.trim().length > 40)
    blockers.push("Button text is over 40 characters.");

  function addBlackout() {
    const value = blackoutDraft.trim();
    if (!DATE_KEY.test(value)) return;
    setBlackouts((current) =>
      current.includes(value) ? current : [...current, value].sort(),
    );
    setBlackoutDraft("");
  }

  function save() {
    if (blockers.length > 0) return;
    start(async () => {
      const result = await updateBookingAction(bookingId, {
        name: trimmedName,
        description: description.trim() || null,
        allowedDomains: domainList,
        notifyEmails: emailList,
        timezone: timezone.trim(),
        slotMinutes: slotNumber,
        leadTimeHours: leadNumber,
        horizonDays: horizonNumber,
        availability,
        blackoutDates: blackouts,
        confirmationMessage: confirmation.trim(),
        appearance: {
          theme,
          primaryColor: primaryColor.trim().toLowerCase(),
          buttonText: buttonText.trim(),
        },
      });
      if (result.ok) {
        toast({ title: "Settings saved", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not save",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Settings2 className="text-primary size-4" />
          Basics
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          The name identifies this calendar in the panel and in the subject line
          of every booking notification. The description is internal only.
        </p>
        <div className="mt-4 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bs-name">Name</Label>
            <Input
              id="bs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-description">Description</Label>
            <Textarea
              id="bs-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="min-h-20"
              placeholder="What this calendar is for, for whoever inherits it."
            />
          </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Globe2 className="text-primary size-4" />
          Timezone
          <Badge variant="muted">everything else depends on this</Badge>
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          The hours below are read in this zone. Visitors always see slots
          converted into their own zone, so a customer in another country books
          a time you both agree on. Change this and every window shifts with it
          — the hours are not re-interpreted, they are re-projected.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bs-tz-pick">Common zones</Label>
            <select
              id="bs-tz-pick"
              value={
                COMMON_TIMEZONES.some((z) => z.value === timezone.trim())
                  ? timezone.trim()
                  : ""
              }
              onChange={(e) => {
                if (e.target.value) setTimezone(e.target.value);
              }}
              className="border-border bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Something else — type it below</option>
              {COMMON_TIMEZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-tz">IANA zone name</Label>
            <Input
              id="bs-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-9 font-mono"
              placeholder="Asia/Kolkata"
              aria-invalid={!timezoneValid}
              aria-describedby="bs-tz-help"
            />
            <p id="bs-tz-help" className="text-muted-foreground text-xs">
              {timezoneValid
                ? "Recognised. Daylight saving is applied automatically."
                : "Not a zone this runtime knows. Slots cannot be generated until it is."}
            </p>
          </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Timer className="text-primary size-4" />
          Slot length and booking window
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Slots are cut from the start of each availability window, so a window
          that does not divide evenly leaves its remainder unbookable rather
          than offering a short appointment.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bs-slot">Slot length</Label>
            <select
              id="bs-slot"
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(e.target.value)}
              className="border-border bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {SLOT_LENGTHS.map((length) => (
                <option key={length} value={String(length)}>
                  {length} minutes
                </option>
              ))}
              {!SLOT_LENGTHS.includes(
                slotNumber as (typeof SLOT_LENGTHS)[number],
              ) && <option value={slotMinutes}>{slotMinutes} minutes</option>}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-lead">Lead time (hours)</Label>
            <Input
              id="bs-lead"
              value={leadTimeHours}
              onChange={(e) => setLeadTimeHours(e.target.value)}
              inputMode="numeric"
              className="h-9"
              aria-describedby="bs-lead-help"
            />
            <p id="bs-lead-help" className="text-muted-foreground text-xs">
              The earliest a visitor may book from now. Zero lets someone book
              the next slot as it begins.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-horizon">Horizon (days)</Label>
            <Input
              id="bs-horizon"
              value={horizonDays}
              onChange={(e) => setHorizonDays(e.target.value)}
              inputMode="numeric"
              className="h-9"
              aria-describedby="bs-horizon-help"
            />
            <p id="bs-horizon-help" className="text-muted-foreground text-xs">
              How far ahead the widget will show. Beyond this, the calendar is
              simply empty.
            </p>
          </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Clock className="text-primary size-4" />
              Weekly availability
            </h3>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Times are in {timezoneValid ? timezone.trim() : "the zone above"}.
              A day may have any number of windows — add a second one to put a
              lunch break in the middle of it.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyMondayToWeekdays}
            disabled={(drafts[1] ?? []).length === 0}
          >
            Copy Monday to Tue–Sat
          </Button>
        </div>

        <ul className="mt-4 space-y-2">
          {DAY_ORDER.map((day) => {
            const windows = drafts[day] ?? [];
            const count = perDayCounts[day] ?? 0;
            return (
              <li
                key={day}
                className="border-border bg-muted/20 rounded-xl border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-24 text-sm font-medium">
                      {DAY_NAMES[day]}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {windows.length === 0
                        ? "closed"
                        : `${count} slot${count === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addWindow(day)}
                  >
                    <Plus className="size-4" />
                    Add window
                  </Button>
                </div>

                {windows.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {windows.map((window, position) => (
                      <div
                        key={window.key}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="time"
                          id={`bs-${day}-${window.key}-start`}
                          aria-label={`${DAY_NAMES[day]} window ${position + 1} start`}
                          value={window.start}
                          onChange={(e) =>
                            mutateDay(day, (list) =>
                              list.map((w) =>
                                w.key === window.key
                                  ? { ...w, start: e.target.value }
                                  : w,
                              ),
                            )
                          }
                          className="border-border bg-background h-9 rounded-md border px-2 text-sm"
                        />
                        <span className="text-muted-foreground text-sm">
                          to
                        </span>
                        <input
                          type="time"
                          id={`bs-${day}-${window.key}-end`}
                          aria-label={`${DAY_NAMES[day]} window ${position + 1} end`}
                          value={window.end}
                          onChange={(e) =>
                            mutateDay(day, (list) =>
                              list.map((w) =>
                                w.key === window.key
                                  ? { ...w, end: e.target.value }
                                  : w,
                              ),
                            )
                          }
                          className="border-border bg-background h-9 rounded-md border px-2 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          aria-label={`Remove ${DAY_NAMES[day]} window ${position + 1}`}
                          onClick={() =>
                            mutateDay(day, (list) =>
                              list.filter((w) => w.key !== window.key),
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="border-border bg-muted/40 mt-4 rounded-xl border p-3 text-sm leading-relaxed">
          {!timezoneValid ? (
            <p className="flex items-start gap-1.5 text-amber-600">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                No preview: fix the timezone first. Until it is a zone the
                runtime knows, the engine returns nothing and the widget will
                show an empty calendar.
              </span>
            </p>
          ) : previewSlots.length === 0 ? (
            <p className="flex items-start gap-1.5 text-amber-600">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong className="font-medium">
                  This configuration offers no slots at all.
                </strong>{" "}
                Either no day has hours, or every window is shorter than one{" "}
                {slotMinutes}-minute slot. The widget will render, and every
                visitor will find nothing to book.
              </span>
            </p>
          ) : (
            <p>
              <strong className="font-medium">
                {previewSlots.length} bookable slot
                {previewSlots.length === 1 ? "" : "s"} in a typical week
              </strong>{" "}
              — computed by the same engine the widget uses, so this is the real
              number rather than an estimate. Lead time and blackout dates are
              excluded here because they subtract from a particular week rather
              than describing the schedule.
            </p>
          )}
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CalendarOff className="text-primary size-4" />
          Blackout dates
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Whole days removed from the calendar — public holidays, leave, a
          conference. Read as calendar dates in{" "}
          {timezoneValid ? timezone.trim() : "the configured zone"}, not in the
          visitor&apos;s. Existing bookings on a blacked-out day are{" "}
          <em>not</em> cancelled; the day simply stops accepting new ones.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="bs-blackout">Add a date</Label>
            <input
              type="date"
              id="bs-blackout"
              value={blackoutDraft}
              onChange={(e) => setBlackoutDraft(e.target.value)}
              className="border-border bg-background h-9 rounded-md border px-2 text-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={addBlackout}
            disabled={!DATE_KEY.test(blackoutDraft.trim())}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        {blackouts.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {blackouts.map((date) => (
              <li key={date}>
                <button
                  type="button"
                  onClick={() =>
                    setBlackouts((current) => current.filter((d) => d !== date))
                  }
                  className="border-border bg-muted/40 hover:text-destructive inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs"
                  aria-label={`Remove blackout on ${date}`}
                >
                  {date}
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            None. Every day matching the hours above is bookable.
          </p>
        )}
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="text-primary size-4" />
          Allowed domains
          <Badge variant="muted">security boundary</Badge>
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          A booking is accepted only when the browser&apos;s{" "}
          <code className="text-foreground/90">Origin</code> matches an entry
          here. The list fails closed: with nothing listed, nothing on the
          public internet can book, so the embed will appear to do nothing until
          you add the site it lives on.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="bs-domains">
            One per line — commas are accepted too
          </Label>
          <Textarea
            id="bs-domains"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            className="min-h-24 font-mono text-sm"
            placeholder={"example.com\n*.example.com"}
            aria-describedby="bs-domains-help"
          />
          <p
            id="bs-domains-help"
            className="text-muted-foreground text-xs leading-relaxed"
          >
            Scheme, port and path are stripped. <code>*.example.com</code>{" "}
            matches any subdomain but <em>not</em> the bare{" "}
            <code>example.com</code> — list the apex as well if you need both. A
            bare <code>*</code> allows every site, which is useful while testing
            and unwise afterwards: the public token is visible in your page
            source, so this list is the only thing stopping a stranger filling
            your diary and spending your credits. Loopback addresses are always
            allowed, so local development never needs an entry here.
          </p>
        </div>
        {badDomains.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              These are not hostnames and would never match:{" "}
              {badDomains.join(", ")}
            </span>
          </p>
        )}
        {domainList.length > 0 && badDomains.length === 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            Will be stored as: {domainList.join(", ")}
          </p>
        )}
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Mail className="text-primary size-4" />
          Booking notifications
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Everyone listed is emailed when a slot is booked or cancelled. A wrong
          address here fails <strong>silently</strong> — nothing bounces back
          into the product, the booking still succeeds, and the appointment sits
          in the diary with nobody told about it.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="bs-notify">Notify addresses (up to 10)</Label>
          <Textarea
            id="bs-notify"
            value={notify}
            onChange={(e) => setNotify(e.target.value)}
            className="min-h-20 font-mono text-sm"
            placeholder={"you@example.com\nbookings@example.com"}
          />
        </div>
        {badEmails.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              These would never receive a notification: {badEmails.join(", ")}
            </span>
          </p>
        )}
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Palette className="text-primary size-4" />
          Appearance and confirmation
        </h3>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Applies to both the script embed and the hosted page. Changes take
          effect on the next page load — no need to update the snippet.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bs-theme">Theme</Label>
            <select
              id="bs-theme"
              value={theme}
              onChange={(e) =>
                setTheme(e.target.value as BookingAppearance["theme"])
              }
              className="border-border bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {THEMES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-color">Primary colour</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick primary colour"
                value={
                  HEX_COLOR.test(primaryColor.trim())
                    ? primaryColor.trim()
                    : "#4f46e5"
                }
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="border-border size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input
                id="bs-color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#4f46e5"
                aria-invalid={colorBroken}
                className="h-9 font-mono"
              />
            </div>
            {colorBroken && (
              <p className="text-xs text-amber-600">
                Six-digit hex only, such as #4f46e5.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-button">Book button text</Label>
            <Input
              id="bs-button"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              maxLength={40}
              placeholder="Book this time"
              className="h-9"
            />
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="bs-confirmation">Confirmation message</Label>
          <Textarea
            id="bs-confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            maxLength={500}
            className="min-h-20"
          />
          <p className="text-muted-foreground text-xs">
            Shown in place of the calendar once a slot is reserved.
          </p>
        </div>
      </section>

      <div className="space-y-2">
        {blockers.length > 0 && (
          <ul
            role="status"
            className="text-muted-foreground list-inside list-disc space-y-0.5 text-xs"
          >
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        )}
        <Button onClick={save} disabled={pending || blockers.length > 0}>
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}
