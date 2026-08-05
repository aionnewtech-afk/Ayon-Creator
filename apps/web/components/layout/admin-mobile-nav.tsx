"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { PlatformAdminRole } from "@ayon/types";
import { Button, cn } from "@ayon/ui";
import { adminNavItemHref, visibleAdminNavItems } from "@/config/admin-navigation";

export interface AdminMobileNavProps {
  role: PlatformAdminRole;
}

/**
 * Navegação administrativa para telas estreitas — `AdminSidebar` fica
 * `hidden md:flex` (mesmo padrão já usado pelo `Sidebar` do produto desde a
 * Missão 2), então sem isto o menu ADMIN inteiro fica inacessível abaixo do
 * breakpoint `md` (achado real durante a revisão de responsividade da
 * Missão 12). Escopo deliberadamente restrito ao layout administrativo —
 * o `Sidebar` do produto já em produção não é tocado aqui.
 */
export function AdminMobileNav({ role }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = visibleAdminNavItems(role);

  return (
    <div className="md:hidden">
      <Button type="button" variant="ghost" size="icon" aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen((value) => !value)}>
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </Button>

      {open ? (
        <nav className="absolute inset-x-0 top-16 z-20 flex flex-col gap-1 border-b border-border bg-card px-3 py-2 shadow-sm">
          {items.map((item) => {
            const href = adminNavItemHref(item);
            const isActive = pathname === href;
            const Icon = item.icon;

            return (
              <Link
                key={item.slug}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
