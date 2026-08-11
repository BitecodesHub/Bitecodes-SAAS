import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginLinkForm } from "@/components/account/login-link-form";
import { peekToken } from "@/lib/server/auth/recovery";

export const metadata: Metadata = {
  title: "Complete sign-in",
  robots: { index: false, follow: false },
};

/**
 * Magic-link landing page. Peeks at the token to give an honest answer on an
 * expired link, but consumption — and the session — happen in the POST behind
 * the button, never on this GET.
 */
export default async function LoginLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await peekToken(token, "login-link") : false;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
          {valid && token ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                Almost there
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Press the button to finish signing in to the admin panel.
              </p>
              <div className="mt-6">
                <LoginLinkForm token={token} />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                This sign-in link is no longer valid
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Sign-in links work once and expire after 15 minutes. Request a
                fresh one and try again.
              </p>
              <p className="mt-6 text-sm">
                <Link
                  href="/admin/forgot-password"
                  className="text-primary underline underline-offset-4"
                >
                  Request a new link
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
