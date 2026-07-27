import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The 401 boundary for the admin area, rendered when `unauthorized()` is called.
 *
 * Deliberately a real 401 page rather than a redirect to sign-in. A redirect
 * returns 200 for a resource the caller was not allowed to see, which misreports
 * the outcome to crawlers, monitoring, and any API client. This says "not
 * authenticated" and offers the way forward.
 *
 * Sits outside the `(panel)` group, so it renders without the admin shell —
 * which is correct, because there is no signed-in user to build a shell for.
 */
export default function AdminUnauthorized() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="text-muted-foreground text-sm font-medium">401</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          You are not signed in
        </h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          Your session has expired or was signed out elsewhere. Sign in again to
          continue.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="gradient">
            <Link href="/admin/login">
              <LogIn aria-hidden="true" />
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
