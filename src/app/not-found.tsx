import Link from "next/link";
import { ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-40" />
        <div className="bg-mesh absolute inset-0" />
      </div>
      <div className="container-page">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <p className="text-gradient text-7xl font-semibold tracking-tight sm:text-8xl">
            404
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            This page wandered off
          </h1>
          <p className="text-muted-foreground mt-3 leading-relaxed text-pretty">
            The page you’re looking for doesn’t exist or may have moved. Let’s
            get you back on track.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="gradient" size="lg">
              <Link href="/">
                <Home className="size-4" />
                Back to home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/portfolio">
                See our work
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
