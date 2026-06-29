"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { mainNav } from "@/data/navigation";
import { cn } from "@/lib/utils";

export function DesktopNav() {
  return (
    <NavigationMenu className="bg-background/80 hidden rounded-full border px-1.5 shadow-sm backdrop-blur-md lg:flex">
      <NavigationMenuList>
        {mainNav.map((item) =>
          item.sections ? (
            <NavigationMenuItem key={item.title}>
              <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="flex w-[min(46rem,90vw)] gap-6 p-5">
                  <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1">
                    {item.sections.map((section) => (
                      <div key={section.heading} className="min-w-0">
                        <p className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-semibold tracking-wider uppercase">
                          {section.heading}
                        </p>
                        <ul>
                          {section.links.map((link) => (
                            <li key={link.href}>
                              <NavigationMenuLink asChild>
                                <Link
                                  href={link.href}
                                  className="group hover:bg-accent flex items-start gap-3 rounded-xl p-3 transition-colors"
                                >
                                  {link.icon && (
                                    <span className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors">
                                      <link.icon className="size-4" />
                                    </span>
                                  )}
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium">
                                      {link.title}
                                    </span>
                                    {link.description && (
                                      <span className="text-muted-foreground block truncate text-xs">
                                        {link.description}
                                      </span>
                                    )}
                                  </span>
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {item.featured && (
                    <Link
                      href={item.featured.href}
                      className="bg-primary text-primary-foreground relative flex w-56 shrink-0 flex-col justify-end overflow-hidden rounded-xl p-5"
                    >
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 opacity-[0.14]"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                          backgroundSize: "40px 40px",
                          maskImage:
                            "radial-gradient(ellipse at 70% 20%, black, transparent 75%)",
                          WebkitMaskImage:
                            "radial-gradient(ellipse at 70% 20%, black, transparent 75%)",
                        }}
                      />
                      <div className="relative">
                        <p className="text-base font-semibold">
                          {item.featured.title}
                        </p>
                        <p className="text-primary-foreground/85 mt-1 text-sm">
                          {item.featured.description}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
                          {item.featured.cta}
                          <ArrowRight className="size-4" />
                        </span>
                      </div>
                    </Link>
                  )}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          ) : (
            <NavigationMenuItem key={item.title}>
              <NavigationMenuLink
                asChild
                className={cn(navigationMenuTriggerStyle())}
              >
                <Link href={item.href}>{item.title}</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ),
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
