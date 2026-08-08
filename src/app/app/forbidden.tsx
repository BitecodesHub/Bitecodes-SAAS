import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The 403 boundary for the customer area.
 *
 * Reached by a signed-in account with no product permissions — an editor or a
 * viewer, who belongs in the admin panel rather than here. Saying so beats
 * bouncing them to a sign-in page they are already past.
 */
export default function AppForbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <ShieldAlert
          aria-hidden="true"
          className="text-muted-foreground mx-auto size-8"
        />
        <p className="text-muted-foreground mt-4 text-sm font-medium">403</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          This is not your area
        </h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          You are signed in, but this account has no products of its own. If you
          are a member of staff, the admin panel is what you are looking for.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/admin">Admin panel</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to the site</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
