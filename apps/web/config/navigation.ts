import {
  Building2,
  BookOpen,
  Image,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  Settings,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { OrganizationMemberRole } from "@ayon/types";

export interface NavItem {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
  minRole: OrganizationMemberRole;
  implemented: boolean;
}

/**
 * Fonte única da sidebar — ux-design.md §2.2 (navegação primária) e §2.4
 * (visibilidade por papel). Itens com `implemented: false` abrem a tela
 * padrão "coming-soon" (`/coming-soon?item=<slug>`) em vez de uma página real.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    slug: "painel",
    label: "Painel",
    description: "Visão geral da sua conta.",
    icon: LayoutDashboard,
    minRole: "viewer",
    implemented: true,
  },
  {
    slug: "criar-campanha",
    label: "Criar Campanha",
    description: "Em breve você vai poder criar campanhas completas com a ajuda de uma equipe de especialistas de IA.",
    icon: Sparkles,
    minRole: "editor",
    implemented: false,
  },
  {
    slug: "conheca-sua-empresa",
    label: "Conheça sua Empresa",
    description: "Em breve uma entrevista guiada por IA vai conhecer a sua empresa para deixar tudo com a sua cara.",
    icon: Building2,
    minRole: "viewer",
    implemented: false,
  },
  {
    slug: "ensine-sua-empresa",
    label: "Ensine sua Empresa para a IA",
    description: "Em breve você vai poder enviar documentos e materiais para enriquecer o conhecimento da sua marca.",
    icon: BookOpen,
    minRole: "editor",
    implemented: false,
  },
  {
    slug: "o-que-esta-em-alta",
    label: "O que está em Alta",
    description: "Em breve você vai ver as tendências mais relevantes para o seu nicho, já priorizadas para você.",
    icon: TrendingUp,
    minRole: "viewer",
    implemented: false,
  },
  {
    slug: "campanhas",
    label: "Campanhas",
    description: "Em breve você vai encontrar aqui o histórico de todas as suas campanhas.",
    icon: Megaphone,
    minRole: "viewer",
    implemented: false,
  },
  {
    slug: "biblioteca-de-midia",
    label: "Biblioteca de Mídia",
    description: "Em breve você vai poder organizar toda a mídia própria da sua marca por aqui.",
    icon: Image,
    minRole: "editor",
    implemented: false,
  },
  {
    slug: "o-que-funcionou",
    label: "O que Funcionou",
    description: "Em breve você vai receber sugestões de melhoria com base no que performou melhor nas suas campanhas.",
    icon: Lightbulb,
    minRole: "admin",
    implemented: false,
  },
  {
    slug: "configuracoes",
    label: "Configurações",
    description: "Em breve você vai poder gerenciar plano, créditos, marcas e time por aqui.",
    icon: Settings,
    minRole: "viewer",
    implemented: false,
  },
];

export function navItemHref(item: NavItem): string {
  return item.implemented ? `/${item.slug}` : `/coming-soon?item=${item.slug}`;
}
