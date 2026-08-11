import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...createMetadata({
    title: "Offline",
    description: "Connection guidance for Bitecodes visitors.",
    path: "/offline",
  }),
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden">
      <div className="container-page">
        <div className="border-border bg-card mx-auto max-w-xl rounded-3xl border p-8 text-center shadow-[var(--shadow-lift)] sm:p-10">
          <span className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
            <CloudOff className="size-6" />
          </span>
          <h1 className="mt-6 text-3xl font-semibold">
            You appear to be offline
          </h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Reconnect to load live pages, submit forms, run calculators backed
            by APIs, or use the AI consultant. This route is informational; full
            offline caching is not currently claimed.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/">
              <RefreshCw className="size-4" />
              Try the homepage
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
