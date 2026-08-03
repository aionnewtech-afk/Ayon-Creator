"use server";

import { revalidatePath } from "next/cache";
import {
  AuditRepository,
  CampaignRepository,
  InactiveSubscriptionError,
  InsufficientCreditsError,
  ensureSufficientCredits,
  hasMinimumRole,
  logger,
  recordConsumption,
  runCampaignStrategySession,
} from "@ayon/core";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface SpecialistOpinionView {
  specialistId: string;
  specialistName: string;
  failed: boolean;
  opinion: string | null;
  rationale: string | null;
}

export interface CreateCampaignStrategyResult {
  ok: boolean;
  campaignId?: string;
  opinions?: SpecialistOpinionView[];
  consolidatedStrategy?: string;
  rationale?: string;
  divergences?: string | null;
  error?: string;
  blockedReason?: "inactive_subscription" | "insufficient_credits";
}

const FRIENDLY_ERROR = "Não consegui reunir a equipe de especialistas agora. Pode tentar de novo em instantes?";
const CAMPAIGN_STRATEGY_TRIGGER_REASON = "campaign_strategy";

/**
 * Aciona uma sessão completa do Intelligence Hub para estratégia de campanha
 * (Fluxo 10, versão simplificada da Missão 3 — sem geração de conteúdo ainda).
 */
export async function createCampaignStrategyAction(objective: string): Promise<CreateCampaignStrategyResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode criar campanhas por enquanto." };
  }

  const trimmedObjective = objective.trim();
  if (!trimmedObjective) {
    return { ok: false, error: "Conte pra mim qual é o objetivo dessa campanha." };
  }

  try {
    const sessionDb = createClient();
    const serviceRoleDb = createServiceRoleClient();
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    const { costCredits } = await ensureSufficientCredits({
      serviceRoleDb,
      organizationId: session.organization.id,
      triggerReason: CAMPAIGN_STRATEGY_TRIGGER_REASON,
      tier,
    });

    const result = await runCampaignStrategySession({
      db: sessionDb,
      serviceRoleDb,
      tier,
      brandId: session.brand.id,
      brandName: session.brand.name,
      objective: trimmedObjective,
      actorUserId: session.user.id,
    });

    await recordConsumption({
      serviceRoleDb,
      organizationId: session.organization.id,
      costCredits,
      intelligenceHubSessionId: result.sessionId,
      description: `Estratégia de campanha — ${session.brand.name}`,
    });

    revalidatePath("/criar-campanha");

    return {
      ok: true,
      campaignId: result.campaignId,
      opinions: result.opinions.map((opinion) => ({
        specialistId: opinion.specialistId,
        specialistName: opinion.specialistName,
        failed: opinion.failed,
        opinion: opinion.opinion,
        rationale: opinion.rationale,
      })),
      consolidatedStrategy: result.consolidatedStrategy,
      rationale: result.rationale,
      divergences: result.divergences,
    };
  } catch (error) {
    if (error instanceof InactiveSubscriptionError) {
      return {
        ok: false,
        blockedReason: "inactive_subscription",
        error: "Sua assinatura não está ativa. Reative o plano em Configurações para continuar.",
      };
    }
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        blockedReason: "insufficient_credits",
        error: "Créditos insuficientes para criar essa campanha. Compre mais créditos em Configurações.",
      };
    }

    logger.error("intelligence_hub.campaign_strategy_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * Aprovação explícita da estratégia consolidada — nunca automática (Princípio
 * do Consultor Permanente, PRD §1.1).
 */
export async function approveCampaignStrategyAction(campaignId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode aprovar campanhas por enquanto." };
  }

  const db = createClient();
  const campaignRepository = new CampaignRepository(db);
  const auditRepository = new AuditRepository(db);

  await campaignRepository.update(campaignId, { status: "approved" });

  await auditRepository.record({
    organization_id: session.organization.id,
    actor_user_id: session.user.id,
    action: "campaign.strategy_approved",
    entity_type: "campaign",
    entity_id: campaignId,
  });

  revalidatePath("/criar-campanha");

  return { ok: true };
}
