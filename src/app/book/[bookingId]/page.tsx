import type { Metadata } from "next";
import { getBookingConfigForPublic } from "@/lib/server/bookings/repository";
import { BookingRenderer } from "@/components/bookings/booking-renderer";

/**
 * Hosted, standalone rendering of one customer's booking page — the iframe
 * target for embedders who prefer not to run our script.
 *
 * Server-rendered from the configuration itself, resolved by id plus the public
 * token in `?t=`. No session is read and no authenticated action is possible
 * here, which is what makes it safe to allow any site to frame it (see the
 * `frame-ancestors` exemption in `next.config.ts`).
 *
 * The slots themselves are fetched by the client component rather than rendered
 * here, for two reasons: they must be shown in the *visitor's* zone, which the
 * server cannot know, and the list has to be refetched when somebody else wins
 * the race for a slot.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a time",
  robots: { index: false, follow: false },
};

export default async function HostedBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { bookingId } = await params;
  const { t } = await searchParams;
  const config = t ? await getBookingConfigForPublic(bookingId, t) : null;

  // `mx-auto` alone is not enough here, and the omission is not cosmetic.
  //
  // <main> is a flex item inside the flex-col body layout, so it takes its
  // content's width rather than the line's. Without `w-full` the centred column
  // shrink-wrapped to about half a phone screen — the hosted form shipped that
  // way and looked broken on every mobile device. Both classes, always.
  if (!config) {
    return (
      <main className="mx-auto w-full max-w-lg p-6">
        <div className="border-border bg-card rounded-xl border p-5 text-sm leading-relaxed">
          <p className="font-medium">This booking page is not available.</p>
          <p className="text-muted-foreground mt-1">
            The link may be incomplete, or the booking page may have been paused
            by its owner.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg p-6">
      <h1 className="text-xl font-semibold tracking-tight">{config.name}</h1>
      {config.description && (
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          {config.description}
        </p>
      )}
      <p className="text-muted-foreground mt-1.5 text-sm">
        {config.slotMinutes} minutes
      </p>
      <div className="mt-6">
        <BookingRenderer
          bookingId={config.bookingId}
          publicToken={t!}
          appearance={config.appearance}
          confirmationMessage={config.confirmationMessage}
        />
      </div>
    </main>
  );
}
