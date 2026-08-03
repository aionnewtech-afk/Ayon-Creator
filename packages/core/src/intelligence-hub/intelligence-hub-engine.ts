import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { BrandBrainRepository } from "../repositories/brand-brain.repository";
import { SpecialistRepository } from "../repositories/specialist.repository";
import { IntelligenceHubSessionRepository } from "../repositories/intelligence-hub-session.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { knownFieldsFromProfile } from "../brand-brain/onboarding-themes";
import { runSpecialistPanel, type SpecialistOpinionResult } from "./run-specialist-panel";
import { runCoordinator } from "./run-coordinator";

export interface RunCampaignStrategySessionParams {
  /** Client de sessão (RLS) — grava campaigns/intelligence_hub_sessions/specialist_opinions. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve o Specialist Registry e provider_configs. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  brandId: string;
  brandName: string;
  objective: string;
  actorUserId: string;
}

export interface RunCampaignStrategySessionResult {
  campaignId: string;
  sessionId: string;
  opinions: SpecialistOpinionResult[];
  consolidatedStrategy: string;
  rationale: string;
  divergences: string | null;
}

const CAMPAIGN_STRATEGY_DECISION_TYPE = "campaign_strategy";

/**
 * Orquestra uma sessão completa do Intelligence Hub para estratégia de
 * campanha (Fluxo 10): resolve o painel via Specialist Registry, aciona cada
 * especialista em paralelo, aciona o Coordinator, e grava tudo. Nenhuma
 * campanha existe sem sessão do Intelligence Hub (Princípio do Consultor
 * Permanente, PRD §1.1, item 7) — por isso a sessão nasce antes da campanha,
 * com o id da campanha pré-gerado (ver nota sobre a ordem abaixo).
 */
export async function runCampaignStrategySession(
  params: RunCampaignStrategySessionParams,
): Promise<RunCampaignStrategySessionResult> {
  const brandBrainRepository = new BrandBrainRepository(params.db);
  const specialistRepository = new SpecialistRepository(params.serviceRoleDb);
  const sessionRepository = new IntelligenceHubSessionRepository(params.db);
  const campaignRepository = new CampaignRepository(params.db);

  const profile = await brandBrainRepository.findByBrandId(params.brandId);
  const knownFields = knownFieldsFromProfile(profile);

  // `campaigns.intelligence_hub_session_id` é NOT NULL, mas a sessão precisa
  // referenciar a campanha em `related_entity_id` (polimórfico, sem FK real) —
  // por isso o id da campanha é gerado antes de qualquer INSERT, resolvendo a
  // dependência circular sem afrouxar a constraint.
  const campaignId = crypto.randomUUID();

  const session = await sessionRepository.create({
    brand_id: params.brandId,
    related_entity_type: "campaign",
    related_entity_id: campaignId,
    trigger_reason: CAMPAIGN_STRATEGY_DECISION_TYPE,
  });

  try {
    await campaignRepository.create({
      id: campaignId,
      brand_id: params.brandId,
      intelligence_hub_session_id: session.id,
      title: deriveCampaignTitle(params.objective),
      status: "draft",
      created_by: params.actorUserId,
    });

    const [specialists, coordinator] = await Promise.all([
      specialistRepository.findApplicable(CAMPAIGN_STRATEGY_DECISION_TYPE),
      specialistRepository.findCoordinator(),
    ]);

    if (specialists.length === 0) {
      throw new Error(
        `Nenhum especialista ativo aplicável a "${CAMPAIGN_STRATEGY_DECISION_TYPE}" no Specialist Registry.`,
      );
    }
    if (!coordinator) {
      throw new Error("Nenhum Coordinator ativo no Specialist Registry.");
    }

    const opinions = await runSpecialistPanel({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      sessionId: session.id,
      brandName: params.brandName,
      knownFields,
      objective: params.objective,
      specialists,
    });

    const coordinatorResult = await runCoordinator({
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      coordinator,
      brandName: params.brandName,
      knownFields,
      objective: params.objective,
      opinions,
    });

    const consolidatedResult = {
      consolidated_strategy: coordinatorResult.consolidatedStrategy,
      rationale: coordinatorResult.rationale,
      divergences: coordinatorResult.divergences,
    };

    await sessionRepository.update(session.id, {
      status: "completed",
      consolidated_result: consolidatedResult,
      coordinator_provider_key: coordinatorResult.providerKey,
      completed_at: new Date().toISOString(),
    });

    await campaignRepository.update(campaignId, {
      strategy_summary: consolidatedResult,
      status: "ready_for_review",
    });

    return {
      campaignId,
      sessionId: session.id,
      opinions,
      consolidatedStrategy: coordinatorResult.consolidatedStrategy,
      rationale: coordinatorResult.rationale,
      divergences: coordinatorResult.divergences,
    };
  } catch (error) {
    await sessionRepository.update(session.id, { status: "failed" }).catch(() => undefined);
    await campaignRepository.update(campaignId, { status: "failed" }).catch(() => undefined);
    throw error;
  }
}

function deriveCampaignTitle(objective: string): string {
  const trimmed = objective.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}
