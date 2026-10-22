import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";
import { getDatabase } from "@/lib/server/mongodb";
import { COLLECTIONS } from "@/lib/server/db/schema";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  await requireCapability("view");

  const db = await getDatabase();

  const feedbacks = await db
    .collection(COLLECTIONS.feedback)
    .find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Manage NPS and in-app feedback.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full rounded border">
          <thead>
            <tr>
              <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                Score
              </th>
              <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                Email
              </th>
              <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                Source
              </th>
              <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                Status
              </th>
              <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((fb) => (
              <tr
                key={fb._id.toString()}
                className="hover:bg-muted/50 border-b"
              >
                <td className="p-3 text-sm">{fb.score ?? "—"}</td>
                <td className="p-3 text-sm whitespace-nowrap">
                  {fb.email ?? "—"}
                </td>
                <td className="p-3 text-sm">{fb.source ?? "—"}</td>
                <td className="p-3 text-sm">{fb.status ?? "—"}</td>
                <td className="text-muted-foreground p-3 text-sm">
                  {fb.createdAt
                    ? new Date(fb.createdAt).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
