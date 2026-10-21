import "server-only";

import { ObjectId } from "mongodb";
import {
  adminUsers,
  bookingConfigs,
  bookings,
} from "@/lib/server/db/collections";
import type { BookingConfigDoc, BookingDoc } from "@/lib/server/db/types";
import { queueEmail } from "@/lib/server/email/send";
import { getSiteUrl } from "@/lib/server/env";
import { getSettingsFresh } from "@/lib/server/settings";
import type { JobContext } from "@/lib/server/jobs/worker";

/**
 * `booking.reminders` — emails the person who booked 24 hours and 1 hour before
 * the call.
 *
 * The scheduler runs this every fifteen minutes. Each tier therefore has a wide
 * enough window (two hours for the day-before note, thirty minutes for the
 * hour-before note) that a normal run cannot step over a booking, while the
 * stored flag on the booking makes a duplicate impossible even if two runs
 * overlap.
 *
 * Design decisions worth keeping:
 *  - The global toggle is authoritative. When it is off, nothing is claimed and
 *    nothing is sent.
 *  - The flag is set *before* queueing and cleared if queueing throws. A crash
 *    after the claim loses one reminder rather than sending two; a database
 *    failure that prevents queueing restores the flag for the next run.
 *  - Only confirmed bookings are considered. A cancelled booking needs no
 *    reminder, and the customer has already been told.
 *  - The time is rendered in the visitor's own zone when it was recorded, with
 *    the zone named, because a reminder is read on the customer's clock.
 */

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const REMINDER_24H_FROM_MS = 23 * HOUR_MS;
export const REMINDER_24H_TO_MS = 25 * HOUR_MS;
export const REMINDER_1H_FROM_MS = 45 * MINUTE_MS;
export const REMINDER_1H_TO_MS = 75 * MINUTE_MS;

/** How many bookings one run will examine, so a backlog cannot hold the job open. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const STAFF_ROLES = ["owner", "admin", "editor", "viewer"] as const;

function isReminderEnabled(
  config: BookingConfigDoc,
  staffOwnerIds: ReadonlySet<string>,
): boolean {
  if (staffOwnerIds.has(config.ownerId)) {
    return config.remindersEnabled !== false;
  }
  return config.remindersEnabled === true;
}

export type ReminderTier = "24h" | "1h";

/**
 * Which reminder, if any, a booking is due for at `now`.
 *
 * The two windows do not overlap. A booking made less than an hour before it
 * starts receives no reminder at all: it is already too late for one to be
 * useful, and the confirmation email was sent moments ago.
 */
export function reminderTierFor(startAt: Date, now: Date): ReminderTier | null {
  const distance = startAt.getTime() - now.getTime();
  if (distance >= REMINDER_1H_FROM_MS && distance <= REMINDER_1H_TO_MS) {
    return "1h";
  }
  if (distance >= REMINDER_24H_FROM_MS && distance <= REMINDER_24H_TO_MS) {
    return "24h";
  }
  return null;
}

function formatWhen(startAt: Date, timeZone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        dateStyle: "full",
        timeStyle: "short",
        hour12: false,
      }).format(startAt) + ` (${timeZone})`
    );
  } catch {
    return startAt.toISOString();
  }
}

function referenceFor(bookingId: string): string {
  return `BC-${bookingId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function handleBookingReminders(
  payload: Record<string, unknown>,
  context: JobContext,
): Promise<Record<string, unknown>> {
  const settings = await getSettingsFresh();
  if (!settings.growth.bookingReminders) {
    context.log("Booking reminders are switched off.");
    return { skipped: "disabled" };
  }

  const now = new Date();
  const requestedLimit = Number(payload.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(requestedLimit)))
    : DEFAULT_LIMIT;

  const diary = await bookings();
  const due = await diary
    .find({
      status: "confirmed",
      startAt: {
        $gt: new Date(now.getTime() + REMINDER_1H_FROM_MS),
        $lte: new Date(now.getTime() + REMINDER_24H_TO_MS),
      },
    })
    .sort({ startAt: 1 })
    .limit(limit)
    .toArray();

  if (due.length === 0) {
    context.log("No bookings are inside a reminder window.");
    return { checked: 0, sent: 0 };
  }

  const configIds = [...new Set(due.map((booking) => booking.configId))];
  const configs = await (await bookingConfigs())
    .find({ bookingId: { $in: configIds } })
    .toArray();
  const configById = new Map<string, BookingConfigDoc>(
    configs.map((config) => [config.bookingId, config]),
  );

  const ownerObjectIds = [
    ...new Set(
      configs
        .map((config) => config.ownerId)
        .filter((ownerId) => ObjectId.isValid(ownerId)),
    ),
  ].map((ownerId) => new ObjectId(ownerId));
  const staffOwners =
    ownerObjectIds.length === 0
      ? []
      : await (await adminUsers())
          .find(
            { _id: { $in: ownerObjectIds }, role: { $in: STAFF_ROLES } },
            { projection: { _id: 1 } },
          )
          .toArray();
  const staffOwnerIds = new Set(staffOwners.map((owner) => String(owner._id)));

  let sent24h = 0;
  let sent1h = 0;
  let skipped = 0;
  let failed = 0;
  let checked = 0;
  let stoppedEarly = false;

  for (const booking of due) {
    // Leave enough of the run to finish the current email and write the result.
    if (Date.now() > context.deadline - 5_000) {
      stoppedEarly = true;
      context.log(
        "Stopped before the run deadline; the rest are left for next time.",
      );
      break;
    }

    const tier = reminderTierFor(booking.startAt, now);
    if (!tier) continue;

    const config = configById.get(booking.configId);
    if (!config) {
      skipped += 1;
      context.log(
        `Skipped ${booking.bookingId}: its booking page no longer exists.`,
      );
      continue;
    }

    if (!isReminderEnabled(config, staffOwnerIds)) {
      skipped += 1;
      context.log(
        `Skipped ${booking.bookingId}: reminders are not enabled for this calendar.`,
      );
      continue;
    }

    checked += 1;
    const flag: keyof Pick<
      BookingDoc,
      "reminder24hSentAt" | "reminder1hSentAt"
    > = tier === "24h" ? "reminder24hSentAt" : "reminder1hSentAt";

    const claimed = await diary.findOneAndUpdate(
      {
        _id: booking._id,
        status: "confirmed",
        [flag]: null,
      },
      { $set: { [flag]: now } },
      { returnDocument: "after" },
    );
    if (!claimed) {
      // Another run claimed it between the read and this write.
      skipped += 1;
      continue;
    }

    const timezone =
      claimed.meta.timezone && claimed.meta.timezone.length > 0
        ? claimed.meta.timezone
        : config.timezone;
    const when = formatWhen(claimed.startAt, timezone);
    const oneHour = tier === "1h";

    try {
      const result = await queueEmail({
        to: claimed.customerEmail,
        toName: claimed.customerName,
        subject: oneHour
          ? `Reminder: your call is in one hour — ${config.name}`
          : `Reminder: your call is tomorrow — ${config.name}`,
        blocks: [
          {
            type: "p",
            text: `This is a reminder of your booking for “${config.name}”.`,
          },
          {
            type: "ul",
            items: [
              `When: ${when}`,
              `Reference: ${referenceFor(claimed.bookingId)}`,
            ],
          },
          {
            type: "p",
            text: "If you need to change the time, reply to this email or contact us before the call.",
          },
          {
            type: "cta",
            label: "Contact Bitecodes",
            url: `${getSiteUrl()}/contact`,
          },
        ],
        category: "transactional",
        skipApproval: true,
        track: false,
        footerNote: "You are receiving this because you booked a call.",
      });

      if (result.status === "queued" || result.status === "pending_approval") {
        if (oneHour) sent1h += 1;
        else sent24h += 1;
      } else {
        skipped += 1;
        context.log(
          `Reminder for ${claimed.bookingId} was not queued: ${result.skipReason ?? result.status}.`,
        );
      }
    } catch (error) {
      failed += 1;
      // Clear the claim so the next run can try again rather than silently
      // losing the reminder.
      await diary.updateOne({ _id: claimed._id }, { $set: { [flag]: null } });
      console.error(
        "[bookings] reminder could not be queued for",
        claimed.bookingId,
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
      context.log(`Failed to queue the reminder for ${claimed.bookingId}.`);
    }
  }

  context.log(
    `${checked} due, ${sent24h} 24-hour reminder(s), ${sent1h} 1-hour reminder(s), ${skipped} skipped, ${failed} failed.`,
  );

  return {
    checked,
    sent24h,
    sent1h,
    skipped,
    failed,
    ...(stoppedEarly ? { stoppedEarly: true } : {}),
  };
}
