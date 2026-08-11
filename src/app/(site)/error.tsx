"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  // Re-fetches and re-renders the boundary's children; plain reset() only
  // clears boundary state, which immediately re-throws server-render errors.
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // A production monitoring provider can capture this boundary later.
    void error.digest;
  }, [error]);

  return (
    <section className="relative flex min-h-[70vh] items-center">
      <div className="container-page">
        <div className="border-border bg-card mx-auto max-w-xl rounded-3xl border p-8 text-center sm:p-10">
          <span className="bg-destructive/10 text-destructive mx-auto flex size-14 items-center justify-center rounded-2xl">
            <AlertTriangle className="size-6" />
          </span>
          <p className="text-muted-foreground mt-6 text-xs font-semibold tracking-[0.16em] uppercase">
            Temporary problem
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            This page could not finish loading
          </h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Your information has not been submitted again. Retry the page, or
            return home and continue browsing.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" size="lg" onClick={() => unstable_retry()}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">
                <Home className="size-4" />
                Back to home
              </Link>
            </Button>
          </div>
          {error.digest ? (
            <p className="text-muted-foreground mt-6 text-xs">
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
