"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Mail,
  MapPin,
  MessagesSquare,
  PenLine,
  Search,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  ADMIN_NAV,
  findActiveNavItem,
  type AdminNavItem,
} from "@/lib/admin/navigation";
import type { Capability } from "@/lib/server/auth/roles";
import { cn } from "@/lib/utils";

/**
 * Admin sidebar navigation.
 *
 * `capabilities` is passed in from the server rather than looked up here: the
 * role matrix is server-only, and a client component that could read it would
 * ship the whole permission table to the browser.
 */

/**
 * Icons are named in the navigation data and resolved here, because the nav
 * module is imported by server code and a Lucide component is not serialisable
 * across that boundary.
 */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Inbox,
  Users,
  MapPin,
  Mail,
  MessagesSquare,
  ClipboardList,
  PenLine,
  Search,
  BarChart3,
  ListChecks,
  Settings,
  ShieldCheck,
};

export function AdminSidebar({
  capabilities,
  onNavigate,
  collapsed = false,
}: {
  capabilities: Capability[];
  /** Called on link activation, so the mobile drawer can close itself. */
  onNavigate?: () => void;
  /**
   * Icon-only rail. Labels stay in the DOM as `sr-only` rather than being
   * removed, so every row keeps an accessible name; hiding them this way also
   * avoids the half-words that clipping by width left on screen.
   */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = findActiveNavItem(pathname);

  return (
    <nav
      aria-label="Admin sections"
      className={cn("space-y-6", collapsed && "space-y-2")}
    >
      {ADMIN_NAV.map((section) => {
        const visible = section.items.filter((item) =>
          capabilities.includes(item.capability),
        );
        // A section whose every entry is hidden by permissions renders nothing,
        // rather than an empty heading.
        if (visible.length === 0) return null;

        return (
          <div key={section.title}>
            <h2
              className={cn(
                "text-muted-foreground px-3 text-[11px] font-semibold tracking-wider uppercase",
                collapsed && "sr-only",
              )}
            >
              {section.title}
            </h2>
            <ul className={cn("space-y-0.5", collapsed ? "mt-0" : "mt-2")}>
              {visible.map((item) => (
                <li key={item.href}>
                  <NavRow
                    item={item}
                    isActive={active?.href === item.href}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function NavRow({
  item,
  isActive,
  onNavigate,
  collapsed = false,
}: {
  item: AdminNavItem;
  isActive: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = ICONS[item.icon] ?? LayoutDashboard;
  const shared = cn(
    "flex min-h-10 items-center rounded-xl text-sm transition-colors",
    collapsed ? "justify-center px-0" : "gap-2.5 px-3",
  );

  if (!item.enabled) {
    // A planned section renders as a labelled, non-interactive row. Linking to
    // a page that does not exist yet would just be a 404.
    return (
      <span
        className={cn(shared, "text-muted-foreground/50 cursor-default")}
        title={`${item.description} — not built yet`}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className={cn(collapsed ? "sr-only" : "truncate")}>
          {item.label}
        </span>
        <span
          className={cn(
            "border-border text-muted-foreground/70 ml-auto rounded-full border px-1.5 py-0.5 text-[10px]",
            collapsed && "sr-only",
          )}
        >
          soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      // Prefetch is off deliberately, and it is a trade rather than an oversight.
      //
      // Adding `loading.tsx` makes these dynamic routes prefetchable, and every
      // sidebar link is in the viewport at once. The default would therefore fire
      // an authenticated RSC render for each one on every page view, and each of
      // those re-runs the panel layout's session and user lookups — roughly a
      // dozen renders to save one click. The skeleton from `loading.tsx` already
      // gives the click instant feedback, which is what actually made the panel
      // feel slow; paying for twelve speculative renders to shave the rest is not
      // worth it on a shared-tier database.
      prefetch={false}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        shared,
        "focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className={cn(collapsed ? "sr-only" : "truncate")}>
        {item.label}
      </span>
    </Link>
  );
}
