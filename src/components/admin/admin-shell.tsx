"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogSheet,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { findActiveNavItem } from "@/lib/admin/navigation";
import type { AdminUserDto } from "@/lib/server/auth/dal";
import { ROLE_LABELS } from "@/lib/server/auth/roles";
import type { Capability } from "@/lib/server/auth/roles";
import { cn } from "@/lib/utils";

/**
 * The admin panel chrome: a fixed sidebar on desktop, a drawer on mobile, and a
 * header carrying the page title and the account menu.
 *
 * The collapsed state travels in a cookie, and the layout reads it on the server
 * so the first paint is already correct. `localStorage` would have needed an
 * effect to read it after mount, which means every page load flashes the
 * expanded sidebar before snapping shut. A cookie is also still per-device,
 * because cookies are per-browser.
 */

export const SIDEBAR_COOKIE = "bc_admin_sidebar";

export function AdminShell({
  user,
  capabilities,
  logout,
  defaultCollapsed = false,
  children,
}: {
  user: AdminUserDto;
  capabilities: Capability[];
  /** The logout Server Action, passed down from the layout. */
  logout: () => Promise<void>;
  /** Read from the cookie on the server, so there is no flash on load. */
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = findActiveNavItem(pathname);
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      // Written directly rather than through a Server Action: this is a display
      // preference, so a round trip and a re-render would be wasted work.
      // `SameSite=Lax` and a one-year age; deliberately not `HttpOnly`, since
      // the client is what writes it.
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <ToastProvider>
        <div className="flex min-h-screen">
          {/* Desktop sidebar. */}
          <aside
            className={cn(
              "border-border bg-card hidden shrink-0 border-r lg:flex lg:flex-col",
              collapsed ? "lg:w-[68px]" : "lg:w-64",
            )}
          >
            <div className="flex h-16 items-center gap-2 px-4">
              {collapsed ? (
                <Logo href="/admin" iconOnly />
              ) : (
                <Logo href="/admin" />
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {/*
                Collapsed hides the labels with `sr-only` rather than by width.
                Every row keeps its accessible name, and nothing is left
                half-rendered — clipping by width used to show "OVERVIE" and
                "PIPELINI" against the edge of the rail.
              */}
              <AdminSidebar capabilities={capabilities} collapsed={collapsed} />
            </div>

            <div className="border-border border-t p-2">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
                className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/40 flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {collapsed ? (
                  <PanelLeftOpen aria-hidden="true" className="size-4" />
                ) : (
                  <PanelLeftClose aria-hidden="true" className="size-4" />
                )}
                <span className={cn(collapsed && "sr-only")}>
                  Collapse sidebar
                </span>
              </button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-border bg-background/80 sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 backdrop-blur">
              {/* Mobile drawer trigger. */}
              <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu aria-hidden="true" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </DialogTrigger>
                <DialogSheet side="left" className="w-72">
                  <DialogTitle className="sr-only">
                    Admin navigation
                  </DialogTitle>
                  <div className="mb-6">
                    <Logo href="/admin" />
                  </div>
                  <AdminSidebar
                    capabilities={capabilities}
                    onNavigate={() => setDrawerOpen(false)}
                  />
                </DialogSheet>
              </Dialog>

              <div className="min-w-0 flex-1">
                <h1 className="truncate font-semibold tracking-tight">
                  {active?.label ?? "Admin"}
                </h1>
                {active?.description && (
                  <p className="text-muted-foreground hidden truncate text-xs sm:block">
                    {active.description}
                  </p>
                )}
              </div>

              <ThemeToggle />

              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground hidden text-sm underline-offset-4 hover:underline sm:block"
              >
                View site
              </Link>

              <div className="border-border flex items-center gap-3 border-l pl-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm leading-tight font-medium">
                    {user.name}
                  </p>
                  <p className="text-muted-foreground text-xs leading-tight">
                    {ROLE_LABELS[user.role]}
                  </p>
                </div>

                {/*
                  A form rather than a link: signing out mutates state, and a
                  GET-able logout URL can be triggered by any third-party image
                  tag on any page.
                */}
                <form action={logout}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    title="Sign out"
                  >
                    <LogOut aria-hidden="true" />
                    <span className="sr-only">Sign out</span>
                  </Button>
                </form>
              </div>
            </header>

            <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
}
