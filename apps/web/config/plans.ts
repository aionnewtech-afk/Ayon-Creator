import type { SubscriptionPlan } from "@ayon/types";

/**
 * Rótulos/descrições de plano (copy de UI) — PRD.md §8. Números (créditos/mês,
 * marcas inclusas, tier incluso, preço) vêm da tabela `plans`
 * (`PlanRepository`, Missão 6) — dado, não código, única fonte da verdade
 * compartilhada com o handler de webhook do Mercado Pago.
 */
export const PLAN_LABELS: Record<SubscriptionPlan, { label: string; description: string }> = {
  starter: {
    label: "Starter",
    description: "Pequenos negócios testando o produto.",
  },
  pro: {
    label: "Pro",
    description: "Negócios com produção recorrente.",
  },
  business: {
    label: "Business",
    description: "Múltiplos clientes/marcas, times e permissões.",
  },
};
