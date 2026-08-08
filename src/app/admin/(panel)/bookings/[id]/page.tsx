import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assertCapability } from "@/lib/server/auth/dal";
import {
  getBookingConfig,
  listBookings,
} from "@/lib/server/bookings/repository";
import { getBalance } from "@/lib/server/wallet/wallet";
import {
  BookingSettings,
  type BookingSettingsInitial,
} from "@/components/admin/booking-settings";
import { BookingDiary, type DiaryRow } from "@/components/admin/booking-diary";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

/**
 * How far back the diary reaches.
 *
 * A booking that happened yesterday is still the thing an owner is most likely to
 * be looking for — "who was that, and what did they say" — so the diary opens on
 * a short window of recent history rather than only the future.
 */
const DIARY_LOOKBACK_DAYS = 7;
const DIARY_LIMIT = 300;

/**
 * The clock, read outside component scope.
 *
 * `Date.now()` called during a render is flagged as impure, and rightly: a
 * component that reads the clock while rendering is not idempotent. This page is
 * `force-dynamic` and genuinely needs the current time, so the read is done in a
 * plain function the rule can see is not a component.
 */
function diaryWindow(): { from: Date; nowIso: string } {
  const now = new Date();
  return {
    from: new Date(now.getTime() - DIARY_LOOKBACK_DAYS * 86_400_000),
    nowIso: now.toISOString(),
  };
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await assertCapability("manage_bookings");
  const { id } = await params;

  const { from, nowIso } = diaryWindow();

  // Issued together. Each query is scoped to this owner in the query itself, so
  // the ordering carries no authorisation weight.
  const [config, diary, balance] = await Promise.all([
    getBookingConfig(session.userId, id),
    listBookings(session.userId, id, { from, limit: DIARY_LIMIT }),
    getBalance(session.userId, "bookings"),
  ]);

  if (!config) notFound();

  const initial: BookingSettingsInitial = {
    name: config.name,
    description: config.description,
    allowedDomains: config.allowedDomains,
    notifyEmails: config.notifyEmails,
    timezone: config.timezone,
    slotMinutes: config.slotMinutes,
    leadTimeHours: config.leadTimeHours,
    horizonDays: config.horizonDays,
    availability: config.availability,
    blackoutDates: config.blackoutDates,
    confirmationMessage: config.confirmationMessage,
    appearance: config.appearance,
  };

  // Dates are serialised here: a Server Component may not hand a Date across the
  // boundary into a client component.
  const rows: DiaryRow[] = diary.map((b) => ({
    bookingId: b.bookingId,
    startIso: new Date(b.startAt).toISOString(),
    endIso: new Date(b.endAt).toISOString(),
    status: b.status,
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    customerPhone: b.customerPhone,
    notes: b.notes,
  }));

  const upcoming = rows.filter(
    (r) => r.status === "confirmed" && r.startIso >= nowIso,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/bookings"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> All calendars
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {config.name}
          </h1>
          <Badge variant={config.status === "active" ? "secondary" : "muted"}>
            {config.status}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {upcoming} upcoming {upcoming === 1 ? "booking" : "bookings"} ·{" "}
          {config.timezone} ·{" "}
          {balance > 0 ? (
            <>{balance.toLocaleString()} booking credits left</>
          ) : (
            // Stated plainly rather than left to be discovered by a customer
            // hitting a refusal: with no credits the calendar takes nothing.
            <span className="text-amber-600">
              No booking credits — new bookings will be turned away
            </span>
          )}
        </p>
      </div>

      <BookingDiary bookings={rows} timezone={config.timezone} />

      <BookingSettings bookingId={config.bookingId} initial={initial} />
    </div>
  );
}
