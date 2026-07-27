import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The 403 boundary for the admin area, rendered when `forbidden()` is called.
 *
 * Kept distinct from the 401 page on purpose. "Sign in again" is unhelpful and
 * confusing advice for someone who is already signed in and simply lacks the
 * permission — so this says what actually happened and who can change it.
 */
export default function AdminForbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <ShieldAlert
          aria-hidden="true"
          className="text-muted-foreground mx-auto size-8"
        />
        <p className="text-muted-foreground mt-4 text-sm font-medium">403</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          You do not have access to this
        </h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          Your account is signed in, but your role does not include this area.
          An owner can change your role under Team.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/admin">
              <ArrowLeft aria-hidden="true" />
              Back to the dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
