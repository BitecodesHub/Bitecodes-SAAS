"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
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
}: {
  capabilities: Capability[];
  /** Called on link activation, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = findActiveNavItem(pathname);

  return (
    <nav aria-label="Admin sections" className="space-y-6">
      {ADMIN_NAV.map((section) => {
        const visible = section.items.filter((item) =>
          capabilities.includes(item.capability),
        );
        // A section whose every entry is hidden by permissions renders nothing,
        // rather than an empty heading.
        if (visible.length === 0) return null;

        return (
          <div key={section.title}>
            <h2 className="text-muted-foreground px-3 text-[11px] font-semibold tracking-wider uppercase">
              {section.title}
            </h2>
            <ul className="mt-2 space-y-0.5">
              {visible.map((item) => (
                <li key={item.href}>
                  <NavRow
                    item={item}
                    isActive={active?.href === item.href}
                    onNavigate={onNavigate}
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
}: {
  item: AdminNavItem;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[item.icon] ?? LayoutDashboard;
  const shared =
    "flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors";

  if (!item.enabled) {
    // A planned section renders as a labelled, non-interactive row. Linking to
    // a page that does not exist yet would just be a 404.
    return (
      <span
        className={cn(shared, "text-muted-foreground/50 cursor-default")}
        title={`${item.description} — not built yet`}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        <span className="border-border text-muted-foreground/70 ml-auto rounded-full border px-1.5 py-0.5 text-[10px]">
          soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        shared,
        "focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
