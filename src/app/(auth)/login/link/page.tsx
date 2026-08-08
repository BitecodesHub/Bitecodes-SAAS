import type { Metadata } from "next";
import Link from "next/link";
import { LoginLinkForm } from "@/components/account/login-link-form";
import { peekToken } from "@/lib/server/auth/recovery";

export const metadata: Metadata = {
  title: "Complete sign-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Magic-link landing page for customer accounts.
 *
 * Peeks at the token to give an honest answer on an expired link, but
 * consumption — and the session — happen in the POST behind the button, never on
 * this GET, because inbox scanners fetch every URL in an email.
 */
export default async function CustomerLoginLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await peekToken(token, "login-link") : false;

  return (
    <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
      {valid && token ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Almost there</h1>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            Press the button to finish signing in.
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
            Sign-in links work once and expire after 15 minutes. Request a fresh
            one and try again.
          </p>
          <p className="mt-6 text-sm">
            <Link
              href="/forgot"
              className="text-primary underline underline-offset-4"
            >
              Request a new link
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
