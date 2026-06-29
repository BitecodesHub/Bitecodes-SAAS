"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
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
      <DialogSheet>
        <DialogTitle className="sr-only">Navigation menu</DialogTitle>
        <div className="flex items-center justify-between">
          <Logo />
        </div>
        <nav className="-mx-2 flex-1 overflow-y-auto">
          <Accordion type="multiple" className="px-2">
            {mainNav.map((item) =>
              item.sections ? (
                <AccordionItem key={item.title} value={item.title}>
                  <AccordionTrigger className="text-base">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="pr-0 pb-2">
                    <div className="flex flex-col gap-1">
                      {item.sections
                        .flatMap((s) => s.links)
                        .map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors"
                          >
                            {link.icon && <link.icon className="size-4" />}
                            {link.title}
                          </Link>
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-border hover:text-primary flex items-center justify-between border-b py-5 text-base font-medium transition-colors"
                >
                  {item.title}
                </Link>
              ),
            )}
          </Accordion>
        </nav>
        <DialogClose asChild>
          <Button asChild variant="gradient" size="lg" className="w-full">
            <Link href="/contact">
              Start a project
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </DialogClose>
      </DialogSheet>
    </Dialog>
  );
}
