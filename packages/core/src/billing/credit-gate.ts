import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { CreditPricingRepository } from "../repositories/credit-pricing.repository";
import { CreditLedgerRepository } from "../repositories/credit-ledger.repository";

export class InactiveSubscriptionError extends Error {
  constructor() {
    super("Assinatura inativa ou inexistente.");
    this.name = "InactiveSubscriptionError";
  }
}

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Créditos insuficientes: necessário ${required}, disponível ${available}.`);
    this.name = "InsufficientCreditsError";
  }
}

export interface EnsureSufficientCreditsParams {
  /** Client de service role — subscriptions/credit_ledger/credit_pricing não têm policy de escrita/leitura ampla para o usuário final. */
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  triggerReason: string;
  tier: ProviderTier;
}

export interface EnsureSufficientCreditsResult {
  costCredits: number;
}

/**
 * Portão de crédito obrigatório (architecture.md §12.3, Fluxo 6) — checa
 * assinatura ativa e saldo suficiente antes de qualquer sessão do
 * Intelligence Hub. Lança `InactiveSubscriptionError`/`InsufficientCreditsError`
 * quando bloqueado; nunca deduz nada aqui — só confirma que dá pra prosseguir.
 * O débito de verdade só acontece em `recordConsumption`, após a sessão
 * concluir com sucesso.
 */
export async function ensureSufficientCredits(
  params: EnsureSufficientCreditsParams,
): Promise<EnsureSufficientCreditsResult> {
  const subscriptionRepository = new SubscriptionRepository(params.serviceRoleDb);
  const creditPricingRepository = new CreditPricingRepository(params.serviceRoleDb);
  const creditLedgerRepository = new CreditLedgerRepository(params.serviceRoleDb);

  const subscription = await subscriptionRepository.findByOrganizationId(params.organizationId);
  if (!subscription || subscription.status !== "active") {
    throw new InactiveSubscriptionError();
  }

  const pricing = await creditPricingRepository.findActive(params.triggerReason, params.tier);
  if (!pricing) {
    throw new Error(`Nenhum credit_pricing ativo para (trigger_reason=${params.triggerReason}, tier=${params.tier}).`);
  }

  const balance = await creditLedgerRepository.getBalance(params.organizationId);
  if (balance < pricing.credits) {
    throw new InsufficientCreditsError(pricing.credits, balance);
  }

  return { costCredits: pricing.credits };
}

export interface RecordConsumptionParams {
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  costCredits: number;
  /** Sessão do Intelligence Hub que gerou o consumo (`campaign_strategy`/`trend_ranking`). */
  intelligenceHubSessionId?: string;
  /** Peça de conteúdo que gerou o consumo (`asset_generation`, Missão 7) — nunca os dois ao mesmo tempo. */
  contentPieceId?: string;
  description: string;
}

/** Débito real — chamado só depois que a operação (sessão do Intelligence Hub ou geração de peça) concluiu com sucesso (Fluxo 6, passo 3). */
export async function recordConsumption(params: RecordConsumptionParams): Promise<void> {
  const creditLedgerRepository = new CreditLedgerRepository(params.serviceRoleDb);

  await creditLedgerRepository.create({
    organization_id: params.organizationId,
    type: "consumption",
    amount: -params.costCredits,
    related_intelligence_hub_session_id: params.intelligenceHubSessionId,
    related_content_piece_id: params.contentPieceId,
    description: params.description,
  });
}
