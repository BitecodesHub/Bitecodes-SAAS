import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-30" />
        <div className="from-brand-1/20 via-brand-2/15 absolute top-1/3 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-gradient-to-br to-transparent blur-3xl" />
      </div>
      <div className="container-page">
        <Reveal className="mx-auto flex max-w-xl flex-col items-center text-center">
          <span className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Thank you
          </h1>
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
            Your message is on its way to us. We’ll get back to you within one
            business day. In the meantime, take a look at what we’ve been
            building.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="gradient" size="lg">
              <Link href="/portfolio">
                Explore our work
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
