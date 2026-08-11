import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/account/login-form";
import { redirectIfSignedIn } from "@/lib/server/auth/redirect-if-signed-in";

/**
 * Admin sign-in.
 *
 * Outside the admin shell on purpose: the shell's navigation is meaningless to
 * someone who is not signed in, and rendering it would leak the panel's
 * structure to anyone who loads this page.
 */
export const metadata: Metadata = {
  title: "Sign in",
  // Belt-and-braces with the X-Robots-Tag header set in next.config.ts.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  // Validated, unlike the cookie-presence check proxy used to make here.
  await redirectIfSignedIn();

  const { next, reset } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
          <h1 className="text-xl font-semibold tracking-tight">
            Sign in to the admin panel
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            This area is for Bitecodes staff.
          </p>

          {reset === "done" && (
            <p
              role="status"
              className="border-border bg-muted/40 mt-4 rounded-xl border p-3.5 text-sm leading-relaxed"
            >
              Your password has been changed. Sign in with the new one.
            </p>
          )}

          <div className="mt-6">
            <LoginForm next={next} />
          </div>

          <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
            <Link
              href="/admin/forgot-password"
              className="hover:text-foreground underline underline-offset-4"
            >
              Forgotten your password? Get a reset or one-click sign-in link
            </Link>
          </p>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          <Link
            href="/"
            className="hover:text-foreground underline underline-offset-4"
          >
            Return to bitecodes.com
          </Link>
        </p>
      </div>
    </main>
  );
}
