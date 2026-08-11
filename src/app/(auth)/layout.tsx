import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Layout for the customer account pages: sign up, sign in, verify, recover.
 *
 * Deliberately not inside `(site)`. The marketing header offers eleven ways to
 * leave, and the footer is longer than the form — on a page whose only job is to
 * be completed, both are competition. What is left is the mark, the card, and a
 * way back.
 *
 * A route group, so it adds nothing to any URL: `/login` still resolves from
 * `(auth)/login/page.tsx`.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      id="main"
      className="flex min-h-screen flex-1 items-center justify-center px-4 py-14"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>

        {children}

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
