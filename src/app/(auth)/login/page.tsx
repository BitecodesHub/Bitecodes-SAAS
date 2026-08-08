import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/account/login-form";
import { createMetadata } from "@/lib/seo";
import { redirectIfSignedIn } from "@/lib/server/auth/redirect-if-signed-in";

export const metadata: Metadata = createMetadata({
  title: "Sign in",
  description:
    "Sign in to your Bitecodes account to manage your AI chatbot, forms, booking calendar, and credits.",
  path: "/login",
});

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; verified?: string }>;
}) {
  // Validated, unlike the cookie-presence check proxy used to make here.
  await redirectIfSignedIn();

  const { next, reset, verified } = await searchParams;

  return (
    <div className="border-border bg-card rounded-3xl border p-7 shadow-[var(--shadow-lift)]">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
        Your chatbots, forms, calendars, and credits.
      </p>

      {verified === "1" && (
        <p
          role="status"
          className="border-border bg-muted/40 mt-4 rounded-xl border p-3.5 text-sm leading-relaxed"
        >
          Your email address is confirmed. Sign in to get started.
        </p>
      )}

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
          href="/forgot"
          className="hover:text-foreground underline underline-offset-4"
        >
          Forgotten your password?
        </Link>
      </p>

      <p className="text-muted-foreground mt-4 border-t border-[var(--border)] pt-5 text-center text-sm">
        New here?{" "}
        <Link
          href="/signup"
          className="text-foreground hover:text-primary font-medium underline underline-offset-4"
        >
          Create an account
        </Link>{" "}
        — free credits, no card.
      </p>
    </div>
  );
}
