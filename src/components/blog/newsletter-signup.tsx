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
        className="border-border bg-card mt-10 rounded-2xl border p-6"
      >
        <p className="font-semibold">
          {alreadySubscribed
            ? "You\u2019re already subscribed."
            : "Check your inbox!"}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
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
      className="border-border bg-card mt-10 rounded-2xl border p-6"
      data-track-form="newsletter-signup"
    >
      <h2 className="text-base font-semibold">
        Get practical engineering notes in your inbox
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
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
            className="border-input bg-background placeholder:text-muted-foreground w-full rounded-lg border px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-offset-1 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div className="flex items-start gap-2.5">
          <input
            id={consentId}
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={state.phase === "submitting"}
            className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-current"
          />
          <label
            htmlFor={consentId}
            className="text-muted-foreground cursor-pointer text-sm leading-relaxed"
          >
            I agree to receive the Bitecodes newsletter. You can unsubscribe at
            any time.
          </label>
        </div>

        {state.phase === "error" && (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={state.phase === "submitting" || !consent}
          className="bg-foreground text-background inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
        >
          {state.phase === "submitting" ? "Subscribing\u2026" : "Subscribe"}
        </button>
      </form>
    </aside>
  );
}
