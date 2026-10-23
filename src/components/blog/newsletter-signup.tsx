"use client";

import { useState, useId } from "react";

type State =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "done"; status: string }
  | { phase: "error"; message: string };

/**
 * NewsletterSignup — placed at the end of every blog post.
 *
 * - Unticked consent checkbox, required before submit.
 * - POSTs to /api/newsletter.
 * - `data-track-form="newsletter-signup"` for analytics.
 * - No gradients, rings, or glow (Apple-quiet palette).
 */
export function NewsletterSignup({
  source = "blog-post",
}: {
  source?: string;
}) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const emailId = useId();
  const consentId = useId();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) return;

    setState({ phase: "submitting" });

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, source }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        status?: string;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setState({
          phase: "error",
          message: json.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      setState({ phase: "done", status: json.status ?? "pending" });
    } catch {
      setState({
        phase: "error",
        message: "Could not connect. Please check your internet connection.",
      });
    }
  }

  if (state.phase === "done") {
    const alreadySubscribed = state.status === "already";
    return (
      <aside
        aria-label="Newsletter"
        className="bg-surface-2 mt-10 rounded-[24px] p-6 sm:p-7"
      >
        <p className="text-[17px] font-semibold tracking-[-0.01em]">
          {alreadySubscribed
            ? "You\u2019re already subscribed."
            : "Check your inbox!"}
        </p>
        <p className="text-muted-foreground mt-1.5 text-[14px] leading-[1.55]">
          {alreadySubscribed
            ? "You\u2019re already on the list. We\u2019ll send you our next issue."
            : "We\u2019ve sent a confirmation link to your email address. Click it to complete your signup."}
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Newsletter signup"
      className="bg-surface-2 mt-10 rounded-[24px] p-6 sm:p-7"
      data-track-form="newsletter-signup"
    >
      <h2 className="text-[19px] font-semibold tracking-[-0.01em]">
        Get practical engineering notes in your inbox
      </h2>
      <p className="text-muted-foreground mt-1.5 text-[14px] leading-[1.55]">
        Weekly. No marketing fluff. Unsubscribe any time.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
        <div>
          <label htmlFor={emailId} className="sr-only">
            Email address
          </label>
          <input
            id={emailId}
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state.phase === "submitting"}
            className="bg-background placeholder:text-muted-foreground focus-visible:ring-ring/40 w-full rounded-[14px] px-4 py-3 text-[15px] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-2.5">
          <input
            id={consentId}
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={state.phase === "submitting"}
            className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-current"
          />
          <span className="text-muted-foreground text-[13px] leading-[1.55]">
            I agree to receive the Bitecodes newsletter. You can unsubscribe at
            any time.
          </span>
        </label>

        {state.phase === "error" && (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-[14px] px-4 py-3 text-[14px] leading-[1.5]"
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={state.phase === "submitting" || !consent}
          className="bg-primary text-primary-foreground focus-visible:ring-ring/40 inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold transition-opacity focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          {state.phase === "submitting" ? "Subscribing\u2026" : "Subscribe"}
        </button>
      </form>
    </aside>
  );
}
