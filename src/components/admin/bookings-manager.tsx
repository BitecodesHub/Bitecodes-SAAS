"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Copy,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  createBookingAction,
  deleteBookingAction,
  rotateBookingTokenAction,
  setBookingStatusAction,
} from "@/lib/server/bookings/actions";
import { isValidTimezone } from "@/lib/bookings/availability";
import { COMMON_TIMEZONES } from "@/components/admin/booking-settings";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useVisitorTimezone } from "@/lib/use-client-value";

export interface BookingRow {
  bookingId: string;
  name: string;
  status: "active" | "paused";
  timezone: string;
  slotMinutes: number;
  allowedDomains: string[];
  bookingCount: number;
  upcomingCount: number;
}

/**
 * Booking calendar list and creation, with the copy-paste embed snippets.
 *
 * The public token is revealed once — on creation, or after an explicit
 * rotation — because only its hash is stored. The snippet shows a placeholder
 * until then, which is honest about what we can and cannot re-display.
 *
 * A calendar cannot be created without a timezone: availability is authored in
 * local hours and stored as minutes, so a missing zone would make every stored
 * window ambiguous rather than merely unset. The field is pre-filled from the
 * browser and can be changed here or in settings.
 */
export function BookingsManager({
  bookings,
  siteUrl,
}: {
  bookings: BookingRow[];
  siteUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  // Detected in the browser, never during render: resolvedOptions() answers
  // differently on the server, and this component is server-rendered.
  const detectedZone = useVisitorTimezone("");
  const [typedZone, setTypedZone] = useState<string | null>(null);
  // The operator's own edit wins once they make one; until then the field shows
  // the zone their browser reports. No effect and no second render.
  const timezone = typedZone ?? detectedZone;
  const setTimezone = setTypedZone;
  const [domains, setDomains] = useState("");
  const [notify, setNotify] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  /** Two-step delete: the id awaiting confirmation. Removal takes the diary. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const timezoneValid = isValidTimezone(timezone.trim());
  const canCreate = name.trim().length >= 2 && timezoneValid;

  function create() {
    if (!canCreate) return;
    start(async () => {
      const result = await createBookingAction({
        name: name.trim(),
        timezone: timezone.trim(),
        allowedDomains: domains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        notifyEmails: notify
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
      });
      if (result.ok) {
        setTokens((t) => ({
          ...t,
          [result.data.bookingId]: result.data.publicToken,
        }));
        setName("");
        setDomains("");
        setNotify("");
        toast({ title: "Calendar created", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not create",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function toggle(bookingId: string, status: "active" | "paused") {
    start(async () => {
      const result = await setBookingStatusAction(bookingId, status);
      if (result.ok) router.refresh();
      else
        toast({
          title: "Could not update",
          description: result.error,
          variant: "error",
        });
    });
  }

  function rotate(bookingId: string) {
    start(async () => {
      const result = await rotateBookingTokenAction(bookingId);
      if (result.ok) {
        setTokens((t) => ({ ...t, [bookingId]: result.data.publicToken }));
        toast({
          title: "New token issued",
          description: "Update your embed — the old token no longer works.",
          variant: "success",
        });
      } else {
        toast({
          title: "Could not rotate",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function remove(bookingId: string) {
    start(async () => {
      const result = await deleteBookingAction(bookingId);
      if (result.ok) {
        setConfirming(null);
        toast({ title: "Calendar deleted", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not delete",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function scriptSnippet(bookingId: string): string {
    const token = tokens[bookingId] ?? "PUBLIC_TOKEN";
    return `<script src="${siteUrl}/booking-widget.js"\n  data-booking="${bookingId}"\n  data-token="${token}">\n</script>`;
  }

  function iframeSnippet(bookingId: string): string {
    const token = tokens[bookingId] ?? "PUBLIC_TOKEN";
    return `<iframe src="${siteUrl}/book/${bookingId}?t=${token}"\n  style="width:100%;max-width:560px;height:680px;border:0"\n  title="Book a time"></iframe>`;
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    toast({ title: "Copied", variant: "success" });
  }

  return (
    <div className="space-y-6">
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus className="text-primary size-4" />
          New calendar
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Starts on weekday hours, 9 to 5, in 30-minute slots. Adjust the hours
          in settings once it exists.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input
              id="b-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Discovery call"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-timezone">Timezone</Label>
            <Input
              id="b-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
              list="b-timezone-options"
              className="font-mono"
              aria-invalid={timezone.length > 0 && !timezoneValid}
              aria-describedby="b-timezone-help"
            />
            <datalist id="b-timezone-options">
              {COMMON_TIMEZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </datalist>
            <p id="b-timezone-help" className="text-muted-foreground text-xs">
              {timezone.length === 0
                ? "Detected from this browser."
                : timezoneValid
                  ? "Recognised. Your hours are read in this zone."
                  : "Not a zone this runtime knows."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-domains">Allowed domains</Label>
            <Input
              id="b-domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="example.com, *.example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-notify">Notify emails</Label>
            <Input
              id="b-notify"
              value={notify}
              onChange={(e) => setNotify(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </div>
        <Button
          onClick={create}
          disabled={pending || !canCreate}
          className="mt-4"
        >
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Create calendar
        </Button>
      </section>

      {bookings.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border p-10 text-center text-sm shadow-[var(--shadow-soft)]">
          <CalendarClock className="size-6" />
          <p>
            No booking calendars yet. Create one above, then paste its snippet
            on any site to let visitors pick a time.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {bookings.map((booking) => (
            <li
              key={booking.bookingId}
              className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <Link
                      href={`/admin/bookings/${booking.bookingId}`}
                      className="hover:text-primary"
                    >
                      {booking.name}
                    </Link>
                    <Badge
                      variant={
                        booking.status === "active" ? "secondary" : "muted"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {booking.slotMinutes}-minute slots · {booking.timezone} ·{" "}
                    {booking.upcomingCount} upcoming · {booking.bookingCount}{" "}
                    total ·{" "}
                    {booking.allowedDomains.length
                      ? booking.allowedDomains.join(", ")
                      : "no domains yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggle(
                        booking.bookingId,
                        booking.status === "active" ? "paused" : "active",
                      )
                    }
                    disabled={pending}
                  >
                    {booking.status === "active" ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {booking.status === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rotate(booking.bookingId)}
                    disabled={pending}
                  >
                    <RefreshCw className="size-4" />
                    New token
                  </Button>
                  {confirming === booking.bookingId ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">
                        Delete this calendar and its whole diary?
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => remove(booking.bookingId)}
                        disabled={pending}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirming(null)}
                      >
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setConfirming(booking.bookingId)}
                      disabled={pending}
                      aria-label="Delete calendar"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {[
                  {
                    label: "Script embed",
                    code: scriptSnippet(booking.bookingId),
                  },
                  {
                    label: "Iframe embed",
                    code: iframeSnippet(booking.bookingId),
                  },
                ].map((snippet) => (
                  <div
                    key={snippet.label}
                    className="border-border bg-muted/30 relative overflow-x-auto rounded-xl border p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs font-medium">
                        {snippet.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(snippet.code)}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                      >
                        <Copy className="size-3.5" /> Copy
                      </button>
                    </div>
                    <pre className="text-foreground/90 text-xs leading-relaxed">
                      <code>{snippet.code}</code>
                    </pre>
                  </div>
                ))}
              </div>

              {tokens[booking.bookingId] ? (
                <p className="mt-2 text-xs text-amber-600">
                  Copy the snippet now — the token is shown once and cannot be
                  retrieved later.
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">
                  Use “New token” to reveal a fresh public token for the
                  snippets.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
