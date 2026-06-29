"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DesktopNav } from "@/components/navigation/desktop-nav";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div
        className={cn(
          "transition-all duration-300",
          scrolled
            ? "glass border-border border-b"
            : "border-b border-transparent",
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <Logo />
          </div>
          <div className="flex items-center">
            <DesktopNav />
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button
              asChild
              variant="gradient"
              className="hidden sm:inline-flex"
            >
              <Link href="/contact">
                Start a project
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
