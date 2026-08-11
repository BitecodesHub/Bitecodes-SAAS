import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Mail,
  MessagesSquare,
} from "lucide-react";
import {
  requireAdminSession,
  getCurrentAdminUser,
} from "@/lib/server/auth/dal";
import { getBalance } from "@/lib/server/wallet/wallet";
import { listChatbots } from "@/lib/server/chatbot/repository";
import { listForms } from "@/lib/server/forms/repository";
import { listBookingConfigs } from "@/lib/server/bookings/repository";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

/**
 * The customer dashboard's front page.
 *
 * Answers the two questions somebody actually arrives with: what have I built,
 * and how much have I got left. Everything is scoped by `ownerId` in the query,
 * so this shows one account's numbers and cannot be made to show another's.
 */
export default async function AppOverviewPage() {
  const session = await requireAdminSession();
  const user = await getCurrentAdminUser();

  const [
    chatbots,
    forms,
    calendars,
    chatbotCredits,
    formCredits,
    bookingCredits,
    emailCredits,
  ] = await Promise.all([
    listChatbots(session.userId),
    listForms(session.userId),
    listBookingConfigs(session.userId),
    getBalance(session.userId, "chatbot"),
    getBalance(session.userId, "forms"),
    getBalance(session.userId, "bookings"),
    getBalance(session.userId, "email"),
  ]);

  const products = [
    {
      href: "/app/chatbots",
      icon: MessagesSquare,
      label: "Chatbots",
      built: chatbots.length,
      builtUnit: chatbots.length === 1 ? "chatbot" : "chatbots",
      credits: chatbotCredits,
      creditUnit: "tokens",
      cta: "Create a chatbot",
    },
    {
      href: "/app/forms",
      icon: ClipboardList,
      label: "Forms",
      built: forms.length,
      builtUnit: forms.length === 1 ? "form" : "forms",
      credits: formCredits,
      creditUnit: "submissions",
      cta: "Build a form",
    },
    {
      href: "/app/bookings",
      icon: CalendarClock,
      label: "Bookings",
      built: calendars.length,
      builtUnit: calendars.length === 1 ? "calendar" : "calendars",
      credits: bookingCredits,
      creditUnit: "bookings",
      cta: "Set up a calendar",
    },
    {
      href: "/app/email",
      icon: Mail,
      label: "Email API",
      built: null,
      builtUnit: "",
      credits: emailCredits,
      creditUnit: "emails",
      cta: "Get an API key",
    },
  ];

  const nothingBuilt =
    chatbots.length === 0 && forms.length === 0 && calendars.length === 0;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user?.name ? `Hello, ${user.name.split(" ")[0]}` : "Your dashboard"}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Everything you have running, and what is left in each wallet.
        </p>
      </header>

      {nothingBuilt && (
        <section className="border-border bg-muted/30 rounded-2xl border p-5">
          <h2 className="font-semibold">Start with one line of code</h2>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
            Each product gives you a snippet to paste into your website. No
            build step, no framework, and nothing to install. Your free credits
            are already on the account — pick whichever is most useful first.
          </p>
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {products.map((product) => (
          <section
            key={product.href}
            className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                  <product.icon aria-hidden="true" className="size-4.5" />
                </span>
                <h2 className="font-semibold">{product.label}</h2>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold tabular-nums">
                  {product.credits.toLocaleString()}
                </p>
                <p className="text-muted-foreground text-xs">
                  {product.creditUnit} left
                </p>
              </div>
            </div>

            <p className="text-muted-foreground mt-3 text-sm">
              {product.built === null
                ? "Send transactional mail from your own application."
                : product.built === 0
                  ? "Nothing set up yet."
                  : `${product.built} ${product.builtUnit}`}
            </p>

            {product.credits <= 0 && (
              <p className="mt-2 text-sm text-amber-600">
                Out of credits — this product will turn people away until you
                top up.
              </p>
            )}

            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href={product.href}>
                {product.built === 0 || product.built === null
                  ? product.cta
                  : "Open"}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </section>
        ))}
      </div>

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-semibold">Need more credits?</h2>
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          Credits are bought in packs, spent one at a time, and never expire
          while your account is open. There is no monthly fee and nothing renews
          on its own.
        </p>
        <Button asChild className="mt-4">
          <Link href="/app/billing">
            Buy credits
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
