import type { OrganizationPlan } from "@ayon/types";

/**
 * Rótulos/descrições de plano — PRD.md §8. Limites numéricos exatos são
 * decisão em aberto (PRD §13.5); não representados aqui ainda.
 */
export const PLAN_LABELS: Record<OrganizationPlan, { label: string; description: string }> = {
  starter: {
    label: "Starter",
    description: "Pequenos negócios testando o produto — 1 marca.",
  },
  pro: {
    label: "Pro",
    description: "Negócios com produção recorrente — todos os formatos.",
  },
  business: {
    label: "Business",
    description: "Múltiplas marcas, times e permissões.",
  },
};
