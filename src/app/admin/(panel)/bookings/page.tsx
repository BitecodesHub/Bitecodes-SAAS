import type { Metadata } from "next";
import { assertCapability } from "@/lib/server/auth/dal";
import {
  listBookingConfigs,
  listBookings,
} from "@/lib/server/bookings/repository";
import { getBalance } from "@/lib/server/wallet/wallet";
import { BookingsManager } from "@/components/admin/bookings-manager";
import {
  formatPackPrice,
  packsFor,
  perUnitPrice,
} from "@/lib/server/billing/packs";
import { siteConfig } from "@/lib/site";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const session = await assertCapability("manage_bookings");

  const [configs, credits] = await Promise.all([
    listBookingConfigs(session.userId),
    getBalance(session.userId, "bookings"),
  ]);

  /**
   * Upcoming counts, one query per calendar.
   *
   * A single aggregation would be fewer round trips, but it would also be the
   * only place in this slice that reaches past the repository into the
   * collection directly. An operator has a handful of calendars, not thousands,
   * so the fan-out costs nothing worth having a second data path for.
   *
   * `from` is the current instant rather than the start of the day: a slot that
   * finished this morning is not upcoming, and counting it would make the number
   * beside the calendar disagree with the diary the operator opens to check it.
   */
  const now = new Date();
  const upcoming = await Promise.all(
    configs.map(async (config) => {
      const rows = await listBookings(session.userId, config.bookingId, {
        from: now,
        limit: 500,
      });
      return rows.filter((row) => row.status === "confirmed").length;
    }),
  );

  const packs = packsFor("bookings").map((pack) => ({
    packId: pack.packId,
    label: pack.label,
    credits: pack.credits,
    price: formatPackPrice(pack),
    perUnit: perUnitPrice(pack),
    blurb: pack.blurb,
    popular: Boolean(pack.popular),
  }));

  /**
   * Whether the shared checkout can actually sell these packs.
   *
   * `CreditsPanel` is typed to `"forms" | "chatbot"` and carries a per-product
   * copy table, so it cannot render a bookings wallet yet. Rather than quietly
   * dropping the packs — which would leave an operator with an empty wallet and
   * nothing on the page explaining how to fill it — the prices are shown and the
   * gap is stated. The moment that union grows a `bookings` arm this whole
   * section is replaced by the panel, exactly as on /admin/forms.
   */
  const checkoutWired = false;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Publish your availability, paste one line on any website, and let
          visitors pick a time. Slots are offered in the visitor&apos;s own
          timezone and land in the diary here.
        </p>
      </header>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Wallet className="text-primary size-4" />
              Booking credits
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              One credit per confirmed booking. Browsing the calendar, an
              abandoned form, and a rejected origin all cost nothing — the
              credit is spent only when a slot is actually reserved.
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">
            {credits.toLocaleString("en-IN")}
            <span className="text-muted-foreground ml-1.5 text-sm font-normal">
              left
            </span>
          </p>
        </div>

        {credits <= 0 && (
          <p className="mt-3 text-sm text-amber-600">
            With no credits, the widget still renders and still shows times —
            but every attempt to book is refused. Top up before you advertise
            the link.
          </p>
        )}

        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {packs.map((pack) => (
            <li
              key={pack.packId}
              className="border-border bg-muted/30 rounded-xl border p-4"
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                {pack.label}
                {pack.popular && <Badge variant="secondary">popular</Badge>}
              </p>
              <p className="mt-1 text-xl font-semibold">{pack.price}</p>
              <p className="text-muted-foreground text-xs">
                {pack.credits.toLocaleString("en-IN")} bookings · {pack.perUnit}{" "}
                each
              </p>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {pack.blurb}
              </p>
            </li>
          ))}
        </ul>

        {!checkoutWired && (
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Checkout for these packs is not connected yet — the shared credits
            panel still only knows about forms and chatbots. Until it does, an
            administrator can add booking credits directly. Prices are a launch
            placeholder, as everywhere else.
          </p>
        )}
      </section>

      <BookingsManager
        siteUrl={siteConfig.url}
        bookings={configs.map((config, index) => ({
          bookingId: config.bookingId,
          name: config.name,
          status: config.status,
          timezone: config.timezone,
          slotMinutes: config.slotMinutes,
          allowedDomains: config.allowedDomains,
          bookingCount: config.bookingCount,
          upcomingCount: upcoming[index] ?? 0,
        }))}
      />
    </div>
  );
}
