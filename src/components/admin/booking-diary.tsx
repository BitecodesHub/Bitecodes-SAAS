"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, Mail, Phone } from "lucide-react";
import { cancelBookingAction } from "@/lib/server/bookings/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * The diary: what has been booked, and the way to cancel it.
 *
 * Every time is rendered in the calendar's own timezone with that zone named
 * beside it, never in the viewer's. An operator reading their diary from an
 * airport should see the hours their customers were offered, and a bare "3:00
 * PM" that quietly means something different depending on where the laptop is
 * would be worse than useless.
 *
 * Formatting is pinned to an explicit locale and zone for a second reason: this
 * component is server-rendered and then hydrated, and an unpinned formatter
 * resolves against a different default in each of those two places.
 */

export interface DiaryRow {
  bookingId: string;
  startIso: string;
  endIso: string;
  status: "confirmed" | "cancelled";
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
}

function makeFormatters(timeZone: string) {
  // A zone the runtime rejects would throw out of the render. Fall back to UTC
  // and say so, rather than taking the page down over a bad settings value.
  const safeZone = (() => {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone });
      return timeZone;
    } catch {
      return "UTC";
    }
  })();

  return {
    zone: safeZone,
    day: new Intl.DateTimeFormat("en-GB", {
      timeZone: safeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: safeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

export function BookingDiary({
  bookings,
  timezone,
}: {
  bookings: DiaryRow[];
  timezone: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  /** Two-step cancel: the customer is emailed and the slot is released. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const formatters = useMemo(() => makeFormatters(timezone), [timezone]);

  /** Grouped by calendar day *in the calendar's zone*, preserving order. */
  const days = useMemo(() => {
    const groups = new Map<string, DiaryRow[]>();
    for (const booking of bookings) {
      const label = formatters.day.format(new Date(booking.startIso));
      groups.set(label, [...(groups.get(label) ?? []), booking]);
    }
    return [...groups.entries()];
  }, [bookings, formatters]);

  const confirmedCount = bookings.filter(
    (b) => b.status === "confirmed",
  ).length;

  function cancel(bookingId: string) {
    start(async () => {
      const result = await cancelBookingAction(bookingId);
      if (result.ok) {
        setConfirming(null);
        toast({
          title: "Booking cancelled",
          description: "The slot is free for someone else to take.",
          variant: "success",
        });
        router.refresh();
      } else {
        toast({
          title: "Could not cancel",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  if (bookings.length === 0) {
    return (
      <div className="border-border bg-card text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border p-10 text-center text-sm shadow-[var(--shadow-soft)]">
        <CalendarCheck className="size-6" />
        <p>
          Nothing booked ahead. Slots appear here the moment a visitor reserves
          one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {confirmedCount} upcoming appointment{confirmedCount === 1 ? "" : "s"},
        shown in {formatters.zone}.
      </p>

      {days.map(([label, rows]) => (
        <section
          key={label}
          className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
        >
          <h3 className="text-base font-semibold">{label}</h3>
          <ul className="mt-3 space-y-3">
            {rows.map((booking) => {
              const cancelled = booking.status === "cancelled";
              return (
                <li
                  key={booking.bookingId}
                  className={`border-border rounded-xl border p-3 ${
                    cancelled ? "bg-muted/20 opacity-70" : "bg-muted/30"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="font-mono text-sm">
                          {formatters.time.format(new Date(booking.startIso))} –{" "}
                          {formatters.time.format(new Date(booking.endIso))}
                        </span>
                        <span
                          className={cancelled ? "line-through" : undefined}
                        >
                          {booking.customerName}
                        </span>
                        {cancelled && <Badge variant="muted">cancelled</Badge>}
                      </p>
                      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3.5" />
                          <a
                            href={`mailto:${booking.customerEmail}`}
                            className="hover:text-foreground underline-offset-2 hover:underline"
                          >
                            {booking.customerEmail}
                          </a>
                        </span>
                        {booking.customerPhone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3.5" />
                            {booking.customerPhone}
                          </span>
                        )}
                      </p>
                      {booking.notes && (
                        <p className="text-foreground/80 mt-1.5 text-xs leading-relaxed whitespace-pre-wrap">
                          {booking.notes}
                        </p>
                      )}
                    </div>

                    {!cancelled &&
                      (confirming === booking.bookingId ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-muted-foreground text-xs">
                            Cancel and free the slot?
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => cancel(booking.bookingId)}
                            disabled={pending}
                          >
                            {pending ? (
                              <Loader2 className="animate-spin" />
                            ) : null}
                            Cancel it
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
                        >
                          Cancel
                        </Button>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
