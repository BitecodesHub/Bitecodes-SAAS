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

        <div className="bg-surface-2 rounded-[28px] p-7 sm:p-8">
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">
            Sign in to the admin panel
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
            This area is for Bitecodes staff.
          </p>

          {reset === "done" && (
            <p
              role="status"
              className="bg-background mt-4 rounded-[16px] p-4 text-[14px] leading-[1.5]"
            >
              Your password has been changed. Sign in with the new one.
            </p>
          )}

          <div className="mt-6">
            <LoginForm next={next} />
          </div>

          <p className="text-muted-foreground mt-6 text-center text-[13px] leading-[1.6]">
            <Link
              href="/admin/forgot-password"
              className="text-primary underline underline-offset-4"
            >
              Forgotten your password? Get a reset or one-click sign-in link
            </Link>
          </p>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-[13px]">
          <Link href="/" className="text-primary underline underline-offset-4">
            Return to bitecodes.com
          </Link>
        </p>
      </div>
    </main>
  );
}
