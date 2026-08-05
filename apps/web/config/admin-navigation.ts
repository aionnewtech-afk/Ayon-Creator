import {
  Banknote,
  Building2,
  CreditCard,
  FileClock,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquareWarning,
  Server,
  Settings,
  ShieldCheck,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PlatformAdminRole } from "@ayon/types";

export interface AdminNavItem {
  slug: string;
  label: string;
  icon: LucideIcon;
  /** ★ Missão 12 — matriz de capacidades (architecture.md §15.1.1): telas exclusivas de `super_admin` ficam invisíveis para `support_admin`, nunca só desabilitadas. */
  requiresSuperAdmin: boolean;
}

/** Fonte única do menu administrativo (ux-design.md §2.5/§3.11) — fora da navegação de cliente por completo. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { slug: "admin", label: "Dashboard", icon: LayoutDashboard, requiresSuperAdmin: false },
  { slug: "admin/organizacoes", label: "Organizações", icon: Building2, requiresSuperAdmin: false },
  { slug: "admin/usuarios", label: "Usuários", icon: Users, requiresSuperAdmin: false },
  { slug: "admin/planos", label: "Planos", icon: CreditCard, requiresSuperAdmin: true },
  { slug: "admin/trials", label: "Trials", icon: Timer, requiresSuperAdmin: false },
  { slug: "admin/creditos", label: "Créditos", icon: Banknote, requiresSuperAdmin: false },
  { slug: "admin/mercado-pago", label: "Mercado Pago", icon: CreditCard, requiresSuperAdmin: false },
  { slug: "admin/feedbacks", label: "Feedbacks", icon: MessageSquareWarning, requiresSuperAdmin: false },
  { slug: "admin/providers", label: "Providers", icon: Server, requiresSuperAdmin: false },
  { slug: "admin/logs", label: "Logs", icon: FileClock, requiresSuperAdmin: false },
  { slug: "admin/branding", label: "Branding", icon: ImageIcon, requiresSuperAdmin: false },
  { slug: "admin/auditoria", label: "Auditoria", icon: ShieldCheck, requiresSuperAdmin: false },
  { slug: "admin/configuracoes", label: "Configurações", icon: Settings, requiresSuperAdmin: true },
];

export function adminNavItemHref(item: AdminNavItem): string {
  return `/${item.slug}`;
}

export function visibleAdminNavItems(role: PlatformAdminRole): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => !item.requiresSuperAdmin || role === "super_admin");
}
