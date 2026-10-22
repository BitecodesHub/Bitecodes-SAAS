import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";

export const metadata: Metadata = { title: "Calls" };
export const dynamic = "force-dynamic";

/**
 * Placeholder created by the foundation so the navigation link resolves.
 * Owned by the assistant-calls package, which replaces this page.
 */
export default async function AdminCallsPage() {
  await requireCapability("manage_leads");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          This section is being set up.
        </p>
      </header>
    </div>
  );
}
