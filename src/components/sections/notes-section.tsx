import Link from "next/link";
import { ArrowRight, Cpu, EyeOff, Keyboard } from "lucide-react";
import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Home-page spotlight for Notes, the free desktop app. Kept to the same
 * quiet banner shape as ToolsSection but on the normal palette — two inverted
 * bands on one page would shout.
 */
export function NotesSection() {
  return (
    <Section spacing="sm">
      <div className="container-page">
        <div className="border-border bg-card grid gap-8 rounded-3xl border p-8 shadow-[var(--shadow-soft)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                New · Notes for desktop
              </p>
              <Badge>Free download</Badge>
            </div>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              A private AI assistant that lives on your desktop.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl leading-relaxed">
              One shortcut summons a translucent window over whatever you are
              doing. Capture the screen, ask in plain language, and get
              streaming answers from a model running on your own machine — so
              your work never has to leave it.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <span className="flex items-center gap-2">
                <Cpu className="text-primary size-4" />
                Local-first, works offline
              </span>
              <span className="flex items-center gap-2">
                <EyeOff className="text-primary size-4" />
                Hidden from screen shares
              </span>
              <span className="flex items-center gap-2">
                <Keyboard className="text-primary size-4" />
                Keyboard-first, rebindable
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button asChild size="lg">
              <Link href="/notes#download">
                Download for Windows
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/notes">Learn more</Link>
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              macOS coming soon
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
