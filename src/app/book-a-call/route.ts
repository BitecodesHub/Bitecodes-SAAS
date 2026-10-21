import { NextResponse, type NextRequest } from "next/server";
import { getBookACallDestination } from "@/lib/server/discovery-booking";

/**
 * The one URL every call-to-action may safely link to.
 *
 * A 307 rather than a 308 on purpose: the destination is configuration, and a
 * permanent redirect would be cached by browsers long after the studio moved
 * to a different calendar. Once the booking product is configured the visitor
 * lands on the live calendar; until then they land on the contact form with
 * the call intent, so no call-to-action is ever a dead end.
 */
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL(getBookACallDestination(), request.nextUrl.origin),
    307,
  );
}
