import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";
import { getDatabase } from "@/lib/server/mongodb";
import { COLLECTIONS } from "@/lib/server/db/schema";

export const metadata: Metadata = { title: "Customer health" };
export const dynamic = "force-dynamic";

export default async function AdminCustomerHealthPage() {
  await requireCapability("view");

  const db = await getDatabase();

  const [churnRisk, feedbackCount, testimonials] = await Promise.all([
    db
      .collection(COLLECTIONS.churnRisk)
      .find({})
      .sort({ scoredAt: -1 })
      .limit(20)
      .toArray(),

    db.collection(COLLECTIONS.feedback).countDocuments({ status: "received" }),

    db
      .collection(COLLECTIONS.testimonials)
      .find({ status: "approved" })
      .limit(5)
      .toArray(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Customer health
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Overview of churn risk and recent activity.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded border p-4">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            High risk accounts
          </h3>
          <p className="text-3xl font-bold">
            {
              churnRisk.filter(
                (r) => (r as unknown as { level: string }).level === "high",
              ).length
            }
          </p>
        </div>
        <div className="rounded border p-4">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            Recent feedback
          </h3>
          <p className="text-3xl font-bold">{feedbackCount}</p>
        </div>
        <div className="rounded border p-4">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            Approved testimonials
          </h3>
          <p className="text-3xl font-bold">{testimonials.length}</p>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-font-semibold text-muted-foreground mb-4">
          High risk accounts
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full rounded border">
            <thead>
              <tr>
                <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                  Customer
                </th>
                <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                  Score
                </th>
                <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                  Level
                </th>
                <th className="text-muted-foreground p-3 text-left text-xs font-medium">
                  Signals
                </th>
              </tr>
            </thead>
            <tbody>
              {churnRisk.map((cr) => {
                const level = cr.level;
                const signals = cr.signals || [];
                return (
                  <tr
                    key={cr._id.toString()}
                    className="hover:bg-muted/50 border-b"
                  >
                    <td className="p-3 text-sm">
                      {(cr.ownerId as string) || "—"}
                    </td>
                    <td className="p-3 text-sm">{cr.score || "—"}</td>
                    <td className="p-3 text-sm">{level}</td>
                    <td className="text-line-clamp-2 p-3 text-sm">
                      {signals.join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-font-semibold text-muted-foreground mb-4">
          Recently approved testimonials
        </h2>
        <div className="space-y-4">
          {testimonials.map((t) => (
            <div key={t._id.toString()} className="rounded border p-4">
              <p className="font-medium">{t.quote}</p>
              <p className="text-muted-foreground text-sm">
                —{t.authorName}
                {t.authorRole ? `, ${t.authorRole}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
