"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessagesSquare,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * The customer dashboard shell.
 *
 * Deliberately much smaller than `AdminShell`: a customer has seven
 * destinations, not twenty-two, so there is no command palette, no collapsing
 * rail, and no capability filtering to do — every link here is reachable by
 * every account that can see this shell. Reusing the admin shell would have
 * meant carrying all of that for a menu that fits on one screen.
 *
 * Nothing rendered here is an authorisation decision. Each page asserts its own
 * capability, and the links are a convenience.
 */

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/chatbots", label: "Chatbots", icon: MessagesSquare },
  { href: "/app/forms", label: "Forms", icon: ClipboardList },
  { href: "/app/bookings", label: "Bookings", icon: CalendarClock },
  { href: "/app/email", label: "Email API", icon: Mail },
  { href: "/app/billing", label: "Credits", icon: Wallet },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  user,
  logout,
  children,
}: {
  user: { name: string; email: string };
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(item: (typeof NAV)[number]): boolean {
    return "exact" in item && item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    /*
      Every product screen this shell renders reports the outcome of a mutation
      through `useToast`, which throws outside a provider — so without this the
      whole page 500s rather than merely losing its notifications. The admin
      shell has always carried one; this one has to as well.
    */
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <header className="border-border bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
            <Logo href="/app" />

            <nav
              aria-label="Dashboard"
              className="ml-4 hidden items-center gap-0.5 lg:flex"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item) ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden text-right sm:block">
                <p className="text-sm leading-tight font-medium">{user.name}</p>
                <p className="text-muted-foreground text-xs leading-tight">
                  {user.email}
                </p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-9 items-center justify-center rounded-lg transition-colors"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                </button>
              </form>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="app-mobile-nav"
                className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-9 items-center justify-center rounded-lg transition-colors lg:hidden"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
              >
                {menuOpen ? (
                  <X aria-hidden="true" className="size-5" />
                ) : (
                  <Menu aria-hidden="true" className="size-5" />
                )}
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav
              id="app-mobile-nav"
              aria-label="Dashboard"
              className="border-border grid gap-0.5 border-t p-3 lg:hidden"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(item) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <item.icon aria-hidden="true" className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6"
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
