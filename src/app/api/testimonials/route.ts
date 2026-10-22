import { testimonials } from "@/lib/server/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: Return approved, consented testimonials for the public site.
 *
 * Reads only. Moderation is an authenticated admin action (server actions
 * under `/admin/loyalty`); the previous public POST let anyone approve or
 * reject a testimonial and trust a caller-supplied approver id.
 */
export async function GET() {
  const collection = await testimonials();
  const documents = await collection
    .find({
      status: "approved",
      approvedAt: { $ne: null },
      consentAt: { $type: "date" },
      consentText: { $ne: "" },
    })
    .project({
      _id: 0,
      quote: 1,
      authorName: 1,
      authorRole: 1,
      company: 1,
      approvedAt: 1,
    })
    .sort({ approvedAt: -1 })
    .limit(12)
    .toArray();

  const items = documents.flatMap((document) => {
    if (!(document.approvedAt instanceof Date)) return [];
    return [
      {
        quote: document.quote,
        name: document.authorName,
        role: document.authorRole,
        company: document.company,
        approvedAt: document.approvedAt.toISOString(),
      },
    ];
  });

  return Response.json(
    { testimonials: items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
