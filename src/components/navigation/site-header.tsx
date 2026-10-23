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
    <header className="glass fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] dark:border-white/10">
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:px-5 focus:py-2.5 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center gap-3">
        <div className="flex flex-1 items-center justify-start gap-1">
          <Logo />
        </div>
        <div className="flex items-center">
          <DesktopNav />
        </div>
        <div className="flex flex-1 items-center justify-end gap-0.5 sm:gap-1">
          <ThemeToggle />
          {/*
            Sign in comes before the primary call to action and is styled down.
            Somebody who already has an account is not choosing between these
            two — they know which one they want, and making it quiet keeps it
            out of the way of the visitor who is deciding.
          */}
          <Link
            href="/login"
            data-track="header_signin"
            className="text-foreground/80 hover:text-foreground hidden min-h-11 items-center rounded-full px-3 text-[13px] font-medium transition-colors lg:inline-flex"
          >
            Sign in
          </Link>
          <Button asChild className="ml-1 hidden sm:inline-flex">
            <Link href="/book-a-call" data-track="header_call_cta">
              Book a free call
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
