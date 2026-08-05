"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlatformAdminRole } from "@ayon/types";
import { cn } from "@ayon/ui";
import { adminNavItemHref, visibleAdminNavItems } from "@/config/admin-navigation";

export interface AdminSidebarProps {
  role: PlatformAdminRole;
}

export function AdminSidebar({ role }: AdminSidebarProps) {
  const pathname = usePathname();
  const items = visibleAdminNavItems(role);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center px-6">
        <span className="text-base font-semibold text-foreground">Super Admin</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {items.map((item) => {
          const href = adminNavItemHref(item);
          const isActive = pathname === href;
          const Icon = item.icon;

          return (
            <Link
              key={item.slug}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
