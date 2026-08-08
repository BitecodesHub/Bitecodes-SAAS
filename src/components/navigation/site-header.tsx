"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DesktopNav } from "@/components/navigation/desktop-nav";
import { MobileNav } from "@/components/navigation/mobile-nav";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center gap-4">
        <div className="flex flex-1 items-center justify-start gap-1">
          <Logo />
        </div>
        <div className="flex items-center">
          <DesktopNav />
        </div>
        <div className="flex flex-1 items-center justify-end gap-1.5">
          <ThemeToggle />
          {/*
            Sign in comes before the primary call to action and is styled down.
            Somebody who already has an account is not choosing between these
            two — they know which one they want, and making it quiet keeps it
            out of the way of the visitor who is deciding.
          */}
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:inline-flex"
          >
            Sign in
          </Link>
          <Button
            asChild
            variant="gradient"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Link href="/signup">
              Get started free
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
