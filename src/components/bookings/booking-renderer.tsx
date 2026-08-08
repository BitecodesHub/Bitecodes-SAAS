"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingAppearance } from "@/lib/server/db/types";
import { useClientValue } from "@/lib/use-client-value";

/**
 * Picks a slot and books it, against the public booking endpoints.
 *
 * Used by the hosted page at `/book/[bookingId]` (the iframe target). The
 * embedded `<script>` path renders the same three steps in a Shadow DOM instead —
 * see `src/app/booking-widget.js/route.ts`. Both speak the identical request and
 * response contract, so the server has one booking contract to validate.
 *
 * ---------------------------------------------------------------------------
 * Every instant on the wire is UTC; every instant on the screen is the VISITOR's
 * local time, and the zone is named on screen rather than left to be assumed.
 *
 * The owner authors availability in their own zone. Showing their "09:00" to a
 * visitor eight hours away, unlabelled, is how somebody books 3am and does not
 * find out until the reminder arrives. So formatting happens here, in the
 * browser, where the visitor's zone actually is — never on the server, whose
 * zone is an accident of where it is deployed.
 * ---------------------------------------------------------------------------
 */

interface Slot {
  startIso: string;
  endIso: string;
}

interface AvailabilityData {
  slots: Slot[];
}

/** How many days of availability are shown before "show more dates". */
const DAYS_SHOWN = 5;

function localZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function localZoneAbbr(d: Date): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function timezoneLine(): string {
  const zone = localZoneName();
  const abbr = localZoneAbbr(new Date());
  const detail = zone && abbr ? `${zone}, ${abbr}` : zone || abbr;
  return detail
    ? `All times are shown in your local time zone (${detail}).`
    : "All times are shown in your local time zone.";
}

function fmt(d: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(undefined, options).format(d);
  } catch {
    return d.toString();
  }
}

const TIME_ONLY: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};
const DAY_HEADING: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
};
const FULL: Intl.DateTimeFormatOptions = { ...DAY_HEADING, ...TIME_ONLY };

/**
 * Groups slots into the visitor's own calendar days.
 *
 * `getDate()` and friends already read the browser's zone, which is exactly the
 * grouping a visitor expects: a slot at 23:30 UTC belongs to whichever day it is
 * where they are standing, not where the server is.
 */
function groupByLocalDay(slots: Slot[]): { date: Date; entries: Slot[] }[] {
  const order: string[] = [];
  const byKey = new Map<string, { date: Date; entries: Slot[] }>();
  for (const slot of slots) {
    const date = new Date(slot.startIso);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { date, entries: [] };
      byKey.set(key, bucket);
      order.push(key);
    }
    bucket.entries.push(slot);
  }
  return order.map((k) => byKey.get(k)!);
}

/** The refusal codes the booking endpoint can answer with. */
type Refusal = { kind: "slot-taken" } | { kind: "message"; text: string };

/**
 * A refusal a visitor can act on.
 *
 * Every branch names the real obstacle and states the move that is left. On a
 * booking page "something went wrong" is never enough: the visitor's alternative
 * is to give up, and the business never learns that they did.
 */
function explainRefusal(
  status: number,
  payload: { code?: string; message?: string } | null,
): Refusal {
  const code = payload?.code ?? "";
  if (status === 409 || code === "SLOT_TAKEN") return { kind: "slot-taken" };
  if (status === 402 || code === "OWNER_OUT_OF_CREDITS") {
    return {
      kind: "message",
      text: "Online booking is temporarily unavailable for this business. Please contact them directly to arrange a time.",
    };
  }
  if (status === 403 || code === "ORIGIN_NOT_ALLOWED") {
    return {
      kind: "message",
      text: "Online booking is not enabled here. Please contact the business directly to arrange a time.",
    };
  }
  if (status === 404 || code === "NOT_AVAILABLE") {
    return {
      kind: "message",
      text: "This booking page is not available. It may have been paused by its owner, or the link may be incomplete.",
    };
  }
  if (status === 429 || code === "RATE_LIMITED") {
    return {
      kind: "message",
      text: "Too many attempts just now. Please wait a moment and try again.",
    };
  }
  return {
    kind: "message",
    text: payload?.message ?? "Something went wrong. Please try again.",
  };
}

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function BookingRenderer({
  bookingId,
  publicToken,
  appearance,
  confirmationMessage,
}: {
  bookingId: string;
  publicToken: string;
  appearance: BookingAppearance;
  confirmationMessage: string;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [showAllDays, setShowAllDays] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    slot: Slot;
    message: string;
  } | null>(null);
  // Resolved in the browser only: the server has no idea which zone the visitor
  // is in, and useClientValue gives the server a distinct snapshot so the
  // difference is deliberate rather than a hydration mismatch.
  const zoneLine = useClientValue(timezoneLine, "");

  // Both parameters are on the URL deliberately. This page is same-origin so no
  // preflight happens here, but the endpoint is shared with the cross-origin
  // embed, where OPTIONS can only resolve the configuration from the query
  // string — see the long note in `src/app/booking-widget.js/route.ts`.
  const query = `?id=${encodeURIComponent(bookingId)}&t=${encodeURIComponent(publicToken)}`;

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}/availability${query}`,
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        const why = explainRefusal(res.status, payload);
        setLoadError(
          why.kind === "slot-taken"
            ? "That time has just been taken. Please choose another."
            : why.text,
        );
        return false;
      }
      const data = payload.data as AvailabilityData;
      setSlots(Array.isArray(data.slots) ? data.slots : []);
      setLoadError(null);
      return true;
    } catch {
      setLoadError(
        "We could not load the available times. Please refresh the page, or contact the business directly to arrange a time.",
      );
      return false;
    }
  }, [bookingId, query]);

  useEffect(() => {
    // Fetching the first page of availability on mount. The rule cannot see that
    // every state update inside `load` happens AFTER an awaited fetch, so none of
    // them is synchronous and none can cascade — the render finishes long before
    // the network does.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function book(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen) return;
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setFormError("Please enter your name.");
      return;
    }
    if (!EMAIL_OK.test(trimmedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}/book${query}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            publicToken,
            startIso: chosen.startIso,
            name: trimmedName,
            email: trimmedEmail,
            phone: null,
            notes: null,
            timezone: localZoneName() || null,
          }),
        },
      );
      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.ok !== false) {
        setConfirmed({
          slot: chosen,
          message: payload?.message ?? confirmationMessage,
        });
        return;
      }

      const why = explainRefusal(res.status, payload);
      if (why.kind === "slot-taken") {
        // Somebody else won the race for this instant. Returning the visitor to a
        // stale list would let them lose a second one, so the list is refetched
        // before they choose again.
        setChosen(null);
        setBanner(
          "Sorry — that time was booked by someone else a moment ago. Here are the times that are still free. Please choose another.",
        );
        await load();
        return;
      }
      setFormError(why.text);
    } catch {
      setFormError("We could not reach the booking service. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const accent = appearance.primaryColor;

  if (confirmed) {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      >
        <p className="font-semibold">
          You are booked for {fmt(new Date(confirmed.slot.startIso), FULL)}
        </p>
        {zoneLine && <p className="mt-1 opacity-80">{zoneLine}</p>}
        {confirmed.message && <p className="mt-2">{confirmed.message}</p>}
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-relaxed text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {loadError}
      </div>
    );
  }

  if (slots === null) {
    return (
      <p className="text-muted-foreground text-sm">Loading available times…</p>
    );
  }

  // Step two: name and email for the slot already chosen.
  if (chosen) {
    return (
      <form onSubmit={book} noValidate className="space-y-4">
        <div className="border-border rounded-xl border p-3.5 text-sm">
          <span className="text-muted-foreground">Your appointment</span>
          <b className="mt-0.5 block text-base font-semibold">
            {fmt(new Date(chosen.startIso), FULL)}
          </b>
          {zoneLine && (
            <span className="text-muted-foreground">{zoneLine}</span>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bk_name" className="block text-sm font-semibold">
            Your name<span style={{ color: accent }}> *</span>
          </label>
          <input
            id="bk_name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bk_email" className="block text-sm font-semibold">
            Email address<span style={{ color: accent }}> *</span>
          </label>
          <input
            id="bk_email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>

        {formError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            style={{ backgroundColor: accent }}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Booking…" : appearance.buttonText || "Confirm booking"}
          </button>
          <button
            type="button"
            onClick={() => {
              setChosen(null);
              setFormError(null);
            }}
            className="text-muted-foreground px-2 py-2.5 text-sm underline"
          >
            Choose a different time
          </button>
        </div>
      </form>
    );
  }

  // Step one: the next available days, in the visitor's own clock.
  const days = groupByLocalDay(slots);
  const visible = showAllDays ? days : days.slice(0, DAYS_SHOWN);

  return (
    <div className="space-y-4">
      {banner && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {banner}
        </div>
      )}

      {zoneLine && <p className="text-muted-foreground text-xs">{zoneLine}</p>}

      {days.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          There are no times available at the moment. Please check back later,
          or get in touch to arrange a time directly.
        </p>
      ) : (
        <>
          {visible.map((group) => (
            <div key={group.date.toISOString()}>
              <h2 className="mb-2 text-sm font-semibold">
                {fmt(group.date, DAY_HEADING)}
              </h2>
              <div className="flex flex-wrap gap-2">
                {group.entries.map((slot) => {
                  const start = new Date(slot.startIso);
                  return (
                    <button
                      key={slot.startIso}
                      type="button"
                      // The full local date and time for anyone using a screen
                      // reader, who would otherwise hear a bare "10:30" with no
                      // day attached to it.
                      aria-label={fmt(start, FULL)}
                      onClick={() => {
                        setChosen(slot);
                        setBanner(null);
                      }}
                      className="border-border bg-background min-w-21 rounded-lg border px-3 py-2 text-sm hover:border-current"
                    >
                      {fmt(start, TIME_ONLY)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!showAllDays && days.length > DAYS_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAllDays(true)}
              style={{ color: accent }}
              className="text-sm underline"
            >
              Show more dates
            </button>
          )}
        </>
      )}
    </div>
  );
}
