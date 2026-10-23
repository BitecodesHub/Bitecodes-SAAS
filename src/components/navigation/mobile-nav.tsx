"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogSheet,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { mainNav } from "@/data/navigation";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogSheet className="max-w-[26rem] gap-0 p-0">
        <DialogTitle className="sr-only">Navigation menu</DialogTitle>
        <div className="flex h-16 shrink-0 items-center px-6">
          <Logo />
        </div>
        <nav className="-mx-0 flex-1 overflow-y-auto px-3 pb-4">
          <Accordion type="multiple">
            {mainNav.map((item) =>
              item.sections ? (
                <AccordionItem
                  key={item.title}
                  value={item.title}
                  className="border-b-0"
                >
                  <AccordionTrigger className="hover:bg-surface-2 hover:text-foreground [&>svg]:text-muted-foreground min-h-12 rounded-xl px-3 py-3 text-[17px] font-semibold tracking-[-0.01em] [&>svg]:size-4">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="overflow-visible pr-0 pb-2">
                    {item.sections.map((section) => (
                      <div key={section.heading} className="mb-1">
                        <p className="text-muted-foreground px-3 pt-2 pb-1 text-[13px] font-medium tracking-[0.06em] uppercase">
                          {section.heading}
                        </p>
                        {section.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="text-foreground hover:bg-surface-2 flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors"
                          >
                            {link.icon && (
                              <link.icon
                                className="text-muted-foreground size-[18px]"
                                aria-hidden="true"
                              />
                            )}
                            <span className="flex-1">{link.title}</span>
                            <ChevronRight
                              className="text-muted-foreground size-4"
                              aria-hidden="true"
                            />
                          </Link>
                        ))}
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ) : (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="hover:bg-surface-2 flex min-h-12 items-center justify-between rounded-xl px-3 text-[17px] font-semibold tracking-[-0.01em] transition-colors"
                >
                  {item.title}
                  <ChevronRight
                    className="text-muted-foreground size-4"
                    aria-hidden="true"
                  />
                </Link>
              ),
            )}
          </Accordion>
        </nav>
        <div className="border-border/60 shrink-0 space-y-2 border-t px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DialogClose asChild>
            <Button asChild size="lg" className="w-full">
              <Link href="/contact">Start a project</Link>
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button asChild variant="ghost" size="lg" className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
          </DialogClose>
        </div>
      </DialogSheet>
    </Dialog>
  );
}
