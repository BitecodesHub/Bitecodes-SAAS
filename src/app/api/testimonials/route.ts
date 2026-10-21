import { getDatabase } from "@/lib/server/mongodb";
import type { TestimonialDoc } from "@/lib/server/db/types";
import { z } from "zod";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const approveSchema = z.object({
  testimonialId: z.string().trim().min(1),
  approvedBy: z.string().trim().min(1),
});

const rejectSchema = z.object({
  testimonialId: z.string().trim().min(1),
  rejectedBy: z.string().trim().min(1),
});

const db = await getDatabase();
const collection = db.collection<TestimonialDoc>("testimonials");

/**
 * GET: Return approved, consented testimonials for the public site.
 */
export async function GET() {
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

/**
 * POST: Moderate a testimonial (approve or reject).
 */
export async function POST(request: Request) {
  const body = await request.json();
  const approveAction = body.type === "approve";

  if (approveAction) {
    const parsed = approveSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid approval data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { testimonialId, approvedBy } = parsed.data;

    await collection.updateOne(
      { _id: new ObjectId(testimonialId) },
      {
        $set: {
          status: "approved",
          approvedById: approvedBy,
          approvedAt: new Date(),
        },
      },
    );

    return new Response(JSON.stringify({ success: true, action: "approved" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = rejectSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid rejection data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { testimonialId, rejectedBy } = parsed.data;

  await collection.updateOne(
    { _id: new ObjectId(testimonialId) },
    {
      $set: {
        status: "rejected",
        rejectedById: rejectedBy,
        rejectedAt: new Date(),
      },
    },
  );

  return new Response(JSON.stringify({ success: true, action: "rejected" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
