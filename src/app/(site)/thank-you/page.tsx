import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { CallbackRequest } from "@/components/assistant/callback-request";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...createMetadata({
    title: "Thank You",
    description: "Thanks for reaching out to Bitecodes.",
    path: "/thank-you",
  }),
  robots: { index: false, follow: true },
};

export default function ThankYouPage() {
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden pt-16">
      <div className="container-page py-20 sm:py-28">
        <Reveal className="mx-auto flex max-w-xl flex-col items-center text-center">
          {/* Confirmation icon */}
          <span className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Thank you!
          </h1>

          {/* What happens next — honest timing */}
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
            Your submission is safely with us. We review every submission within{" "}
            <span className="text-foreground font-medium">
              one business day
            </span>{" "}
            and will send you a personalised response.
          </p>
        </Reveal>

        {/* Next steps */}
        <Reveal className="mx-auto mt-10 max-w-xl">
          <div className="border-border rounded-2xl border p-6">
            <h2 className="text-base font-semibold tracking-tight">
              What happens next
            </h2>
            <ol className="text-muted-foreground mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="text-primary mt-0.5 font-semibold tabular-nums">
                  1
                </span>
                We review your submission and research your business or project.
              </li>
              <li className="flex gap-3">
                <span className="text-primary mt-0.5 font-semibold tabular-nums">
                  2
                </span>
                A team member contacts you within one business day with initial
                thoughts.
              </li>
              <li className="flex gap-3">
                <span className="text-primary mt-0.5 font-semibold tabular-nums">
                  3
                </span>
                We schedule a free strategy call to understand your goals in
                detail.
              </li>
            </ol>
          </div>
        </Reveal>

        {/* Faster response CTA */}
        <Reveal className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link
              href="/book-a-call"
              data-track="thankyou_call_cta"
              className="min-h-[44px]"
            >
              Book a call for a faster response
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Reveal>

        {/* Callback request — stub until assistant-calls package implements it */}
        <div className="mx-auto mt-6 max-w-xl">
          <CallbackRequest source="thank-you" />
        </div>

        {/* Explore links */}
        <Reveal className="mx-auto mt-12 max-w-xl">
          <p className="text-muted-foreground text-center text-sm">
            In the meantime, take a look at what we&apos;ve been building:
          </p>
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-h-[44px]"
            >
              <Link href="/portfolio">
                Explore our work
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="min-h-[44px]"
            >
              <Link href="/resources">Browse resources</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
