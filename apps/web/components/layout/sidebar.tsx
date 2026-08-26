"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasMinimumRole } from "@ayon/core";
import type { OrganizationMemberRole } from "@ayon/types";
import { cn } from "@ayon/ui";
import { NAV_ITEMS, navItemHref } from "@/config/navigation";
import { appConfig } from "@/config/app";

export interface SidebarProps {
  role: OrganizationMemberRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => hasMinimumRole(role, item.minRole));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center px-6">
        {/* ★ Achado real (pedido direto do usuário — "eu quero que siga a
            identidade visual da Ayon, inclusive que tenha a logo" — depois
            "seguem as logos com fundo transparente pra fundo branco e
            preto"): 2 arquivos reais (transparentes), 1 por tema — nunca um
            só tentando servir os dois (o texto "AYON" fica ilegível no tema
            errado, confirmado visualmente comparando os 2). `dark:` troca
            sozinho, sem JS. */}
        <Image
          src="/logo-horizontal-light.png"
          alt={appConfig.name}
          width={2172}
          height={724}
          className="h-9 w-auto dark:hidden"
          priority
        />
        <Image
          src="/logo-horizontal-dark.png"
          alt={appConfig.name}
          width={2172}
          height={724}
          className="hidden h-9 w-auto dark:block"
          priority
        />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {visibleItems.map((item) => {
          const href = navItemHref(item);
          const isActive = item.implemented && pathname === href;
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
