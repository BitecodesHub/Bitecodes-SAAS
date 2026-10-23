import type { Metadata } from "next";
import Link from "next/link";
import { LoginLinkForm } from "@/components/account/login-link-form";
import { inspectLoginLink } from "@/lib/server/auth/recovery";

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
  const inspection = await inspectLoginLink(token);

  return (
    <div className="bg-surface-2 rounded-[28px] p-7 sm:p-8">
      {inspection.valid && token ? (
        <>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
            Almost there
          </h1>
          <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
            Press the button to finish signing in.
          </p>
          <div className="mt-6">
            <LoginLinkForm
              token={token}
              requiresTwoFactor={inspection.requiresTwoFactor}
            />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
            This sign-in link is no longer valid
          </h1>
          <p className="text-muted-foreground mt-1.5 text-[15px] leading-[1.55]">
            Sign-in links work once and expire after 15 minutes. Request a fresh
            one and try again.
          </p>
          <p className="mt-6 text-[15px]">
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
