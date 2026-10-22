import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Mail,
  MessagesSquare,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  requireAdminSession,
  getCurrentAdminUser,
} from "@/lib/server/auth/dal";
import { getBalance, recentLedger } from "@/lib/server/wallet/wallet";
import { listChatbots } from "@/lib/server/chatbot/repository";
import { listForms } from "@/lib/server/forms/repository";
import { listBookingConfigs } from "@/lib/server/bookings/repository";
import { adminUsers } from "@/lib/server/db/collections";
import type { ObjectId } from "mongodb";
import { CREDIT_PACKS } from "@/lib/server/billing/packs";
import {
  onboardingProgress,
  isOnboardingComplete,
  creditRunway,
  upsellSuggestion,
  crossSellSuggestion,
} from "@/lib/server/lifecycle";
import { ReferralCard } from "@/components/account/referral-card";
import {
  getOrCreateReferral,
  REFERRAL_REWARD_DESCRIPTION,
} from "@/lib/server/referrals";
import { FeedbackPrompt } from "@/components/account/feedback-prompt";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const PRODUCT_LABELS: Record<string, string> = {
  chatbot: "AI Chatbot",
  forms: "Lead Forms",
  bookings: "Booking Calendar",
  email: "Email API",
};

const PRODUCT_DESCRIPTIONS: Record<string, string> = {
  chatbot: "Embed a trained assistant on your website in one line of code.",
  forms: "Capture contact details and route them straight to your CRM.",
  bookings: "Let visitors book time with you without the back-and-forth.",
  email: "Send transactional mail from your own application.",
};

/**
 * The customer dashboard's front page.
 *
 * Shows onboarding progress, credit runways per wallet, product summary cards,
 * and a recommendations panel (upsell/cross-sell). ReferralCard and
 * FeedbackPrompt are rendered at the bottom.
 */
export default async function AppOverviewPage() {
  const session = await requireAdminSession();
  const user = await getCurrentAdminUser();

  // --- Parallelise all fetches ---
  const [
    chatbots,
    forms,
    calendars,
    chatbotBalance,
    formsBalance,
    bookingBalance,
    emailBalance,
    chatbotLedger,
    formsLedger,
    bookingLedger,
    emailLedger,
    ownerDoc,
    referral,
  ] = await Promise.all([
    listChatbots(session.userId),
    listForms(session.userId),
    listBookingConfigs(session.userId),
    getBalance(session.userId, "chatbot"),
    getBalance(session.userId, "forms"),
    getBalance(session.userId, "bookings"),
    getBalance(session.userId, "email"),
    recentLedger(session.userId, "chatbot", 200),
    recentLedger(session.userId, "forms", 200),
    recentLedger(session.userId, "bookings", 200),
    recentLedger(session.userId, "email", 200),
    adminUsers().then((col) =>
      col.findOne({ _id: session.userId as unknown as ObjectId }),
    ),
    getOrCreateReferral(session.userId),
  ]);

  // --- Onboarding progress ---
  const totalProducts = chatbots.length + forms.length + calendars.length;

  // "activity" = any debit across all wallets
  const allLedger = [
    ...chatbotLedger,
    ...formsLedger,
    ...bookingLedger,
    ...emailLedger,
  ];
  const activityCount = allLedger.filter((r) => r.delta < 0).length;

  // "purchased credits" = any purchase row in any ledger
  const hasPurchasedCredits = allLedger.some((r) => r.kind === "purchase");

  const ownerForProgress = {
    emailVerifiedAt: ownerDoc?.emailVerifiedAt ?? null,
    createdAt: ownerDoc?.createdAt ?? new Date(),
    status: ownerDoc?.status ?? "active",
    company: ownerDoc?.company ?? null,
    productCount: totalProducts,
    activityCount,
    embedCount: totalProducts, // proxy: product created == snippet accessible
    hasPurchasedCredits,
  };

  const progress = onboardingProgress(ownerForProgress);
  const onboardingDone = isOnboardingComplete(progress);

  const onboardingSteps = [
    {
      key: "emailVerified" as const,
      label: "Verify your email address",
      done: progress.emailVerified,
    },
    {
      key: "firstProductCreated" as const,
      label: "Create your first product (chatbot, form, or calendar)",
      done: progress.firstProductCreated,
    },
    {
      key: "hasActivity" as const,
      label: "Record your first live event",
      done: progress.hasActivity,
    },
    {
      key: "embedded" as const,
      label: "Embed a product on your site",
      done: progress.embedded,
    },
    {
      key: "creditsPurchased" as const,
      label: "Top up your credits",
      done: progress.creditsPurchased,
    },
  ];

  // --- Credit runways ---
  const wallets = [
    {
      product: "chatbot" as const,
      balance: chatbotBalance,
      ledger: chatbotLedger,
      label: "Chatbot tokens",
    },
    {
      product: "forms" as const,
      balance: formsBalance,
      ledger: formsLedger,
      label: "Form submissions",
    },
    {
      product: "bookings" as const,
      balance: bookingBalance,
      ledger: bookingLedger,
      label: "Bookings",
    },
    {
      product: "email" as const,
      balance: emailBalance,
      ledger: emailLedger,
      label: "Emails",
    },
  ];

  const runways = wallets.map((w) => ({
    ...w,
    runway: creditRunway(w.ledger, w.balance),
  }));

  // --- Product cards ---
  const products = [
    {
      href: "/app/chatbots",
      icon: MessagesSquare,
      label: "Chatbots",
      built: chatbots.length,
      builtUnit: chatbots.length === 1 ? "chatbot" : "chatbots",
      credits: chatbotBalance,
      creditUnit: "tokens",
      cta: "Create a chatbot",
    },
    {
      href: "/app/forms",
      icon: ClipboardList,
      label: "Forms",
      built: forms.length,
      builtUnit: forms.length === 1 ? "form" : "forms",
      credits: formsBalance,
      creditUnit: "submissions",
      cta: "Build a form",
    },
    {
      href: "/app/bookings",
      icon: CalendarClock,
      label: "Bookings",
      built: calendars.length,
      builtUnit: calendars.length === 1 ? "calendar" : "calendars",
      credits: bookingBalance,
      creditUnit: "bookings",
      cta: "Set up a calendar",
    },
    {
      href: "/app/email",
      icon: Mail,
      label: "Email API",
      built: null,
      builtUnit: "",
      credits: emailBalance,
      creditUnit: "emails",
      cta: "Get an API key",
    },
  ];

  // --- Recommendations ---
  const upsellRecommendations = runways
    .map((w) => {
      const suggestion = upsellSuggestion(w.runway, CREDIT_PACKS, w.product);
      return suggestion ? { wallet: w, suggestion } : null;
    })
    .filter(Boolean) as Array<{
    wallet: (typeof runways)[number];
    suggestion: (typeof CREDIT_PACKS)[number];
  }>;

  const activeProducts = wallets
    .filter((w) => w.balance > 0 || w.ledger.some((r) => r.delta < 0))
    .map((w) => w.product);

  const crossSell = crossSellSuggestion(activeProducts);

  const hasRecommendations =
    upsellRecommendations.length > 0 || crossSell !== null;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user?.name ? `Hello, ${user.name.split(" ")[0]}` : "Your dashboard"}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Everything you have running, and what is left in each wallet.
        </p>
      </header>

      {/* ── Onboarding checklist ── */}
      {!onboardingDone && (
        <section className="border-border bg-muted/30 rounded-2xl border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Getting started</h2>
            <span className="text-muted-foreground text-sm">
              {progress.score}% complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="bg-border mb-4 h-1.5 w-full rounded-full">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${progress.score}%` }}
              role="progressbar"
              aria-valuenow={progress.score}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <ul className="space-y-2">
            {onboardingSteps.map((step) => (
              <li key={step.key} className="flex items-center gap-2.5 text-sm">
                {step.done ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="text-primary size-4 shrink-0"
                  />
                ) : (
                  <Circle
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                )}
                <span
                  className={
                    step.done ? "text-muted-foreground line-through" : ""
                  }
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Credit runway ── */}
      <section>
        <h2 className="mb-3 font-semibold">Credit runway</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {runways.map((w) => (
            <div
              key={w.product}
              className="border-border bg-card rounded-xl border p-4"
            >
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {w.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {w.balance.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs">
                {w.runway.daysRemaining !== null
                  ? `~${w.runway.daysRemaining} days left`
                  : "No recent spend"}
              </p>
              {w.balance <= 0 && (
                <p className="mt-1.5 text-xs text-amber-600">Out of credits</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Product cards ── */}
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

      {/* ── Recommendations panel ── */}
      {hasRecommendations && (
        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center gap-2">
            <Zap aria-hidden="true" className="text-primary size-4.5" />
            <h2 className="font-semibold">Recommendations</h2>
          </div>

          <div className="space-y-4">
            {/* Upsell suggestions */}
            {upsellRecommendations.map(({ wallet, suggestion }) => (
              <div key={wallet.product} className="bg-muted/40 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Top up your {wallet.label.toLowerCase()}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {wallet.runway.daysRemaining !== null &&
                      wallet.runway.daysRemaining <= 14
                        ? `Only ~${wallet.runway.daysRemaining} days of runway left.`
                        : "Balance is running low."}{" "}
                      The <strong>{suggestion.label}</strong> pack adds{" "}
                      {suggestion.credits.toLocaleString()}{" "}
                      {wallet.label.toLowerCase()}.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/app/billing">Buy credits</Link>
                  </Button>
                </div>
              </div>
            ))}

            {/* Cross-sell suggestion */}
            {crossSell && (
              <div className="bg-muted/40 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp
                        aria-hidden="true"
                        className="text-primary size-3.5"
                      />
                      <p className="text-sm font-medium">
                        Try {PRODUCT_LABELS[crossSell]}
                      </p>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {PRODUCT_DESCRIPTIONS[crossSell]} Free credits included.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/app/${crossSell === "chatbot" ? "chatbots" : crossSell === "forms" ? "forms" : crossSell === "bookings" ? "bookings" : "email"}`}
                    >
                      Explore
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Buy more credits CTA ── */}
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

      {/* ── Referral and feedback ── */}
      <div className="space-y-4">
        <ReferralCard
          code={referral.code}
          redemptionCount={referral.redemptions.length}
          rewardLabel={REFERRAL_REWARD_DESCRIPTION}
        />
        <FeedbackPrompt />
      </div>
    </div>
  );
}
