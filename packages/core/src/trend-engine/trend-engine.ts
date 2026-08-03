import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { BrandBrainRepository } from "../repositories/brand-brain.repository";
import { SpecialistRepository } from "../repositories/specialist.repository";
import { IntelligenceHubSessionRepository } from "../repositories/intelligence-hub-session.repository";
import { TrendResearchRepository } from "../repositories/trend-research.repository";
import { knownFieldsFromProfile } from "../brand-brain/onboarding-themes";
import { resolveTrendSourceProvider } from "../providers/provider-gateway";
import { runTrendRankingPanel } from "./run-trend-ranking-panel";
import { runTrendCoordinator, type RankedTrend } from "./run-trend-coordinator";

export interface RunTrendDiscoveryParams {
  /** Client de sessão (RLS) — grava trend_research/intelligence_hub_sessions/specialist_opinions. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve Specialist Registry e provider_configs. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  brandId: string;
  brandName: string;
  niche: string;
  actorUserId: string;
}

export interface RunTrendDiscoveryResult {
  trendResearchId: string;
  sessionId: string;
  rankings: RankedTrend[];
  overallRationale: string;
  candidateCount: number;
}

const TREND_RANKING_DECISION_TYPE = "trend_ranking";

/**
 * Orquestra uma descoberta de tendências completa (Fluxo 2): resolve o Trend
 * Source Provider (via Provider Gateway, nunca conhece o fornecedor
 * concreto), consulta candidatos, e envia ao Intelligence Hub para
 * ranqueamento estratégico — regra inegociável (architecture.md §3.3):
 * nenhuma tendência é exibida ao usuário sem passar por aqui. Mesmo padrão
 * de runCampaignStrategySession (intelligence-hub-engine.ts), adaptado para
 * trend_research em vez de campaigns.
 */
export async function runTrendDiscovery(params: RunTrendDiscoveryParams): Promise<RunTrendDiscoveryResult> {
  const brandBrainRepository = new BrandBrainRepository(params.db);
  const specialistRepository = new SpecialistRepository(params.serviceRoleDb);
  const sessionRepository = new IntelligenceHubSessionRepository(params.db);
  const trendResearchRepository = new TrendResearchRepository(params.db);

  const profile = await brandBrainRepository.findByBrandId(params.brandId);
  const knownFields = knownFieldsFromProfile(profile);

  const trendResearch = await trendResearchRepository.create({
    brand_id: params.brandId,
    status: "pending",
    created_by: params.actorUserId,
  });

  // Referenciada no catch — se a sessão já foi criada quando o erro
  // acontece, ela também precisa ser marcada como failed, senão fica presa
  // em "running" para sempre (achado durante a validação real da Missão 5).
  let session: Awaited<ReturnType<typeof sessionRepository.create>> | undefined;

  try {
    const trendSourceProvider = await resolveTrendSourceProvider(params.serviceRoleDb, params.tier);
    const candidateResult = await trendSourceProvider.findCandidates({
      niche: params.niche,
      brandName: params.brandName,
    });

    session = await sessionRepository.create({
      brand_id: params.brandId,
      related_entity_type: "trend_research",
      related_entity_id: trendResearch.id,
      trigger_reason: TREND_RANKING_DECISION_TYPE,
    });

    const [specialists, coordinator] = await Promise.all([
      specialistRepository.findApplicable(TREND_RANKING_DECISION_TYPE),
      specialistRepository.findCoordinator(),
    ]);

    if (specialists.length === 0) {
      throw new Error(
        `Nenhum especialista ativo aplicável a "${TREND_RANKING_DECISION_TYPE}" no Specialist Registry.`,
      );
    }
    if (!coordinator) {
      throw new Error("Nenhum Coordinator ativo no Specialist Registry.");
    }

    const opinions = await runTrendRankingPanel({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      sessionId: session.id,
      brandName: params.brandName,
      knownFields,
      candidates: candidateResult.candidates,
      specialists,
    });

    const coordinatorResult = await runTrendCoordinator({
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      coordinator,
      brandName: params.brandName,
      knownFields,
      candidates: candidateResult.candidates,
      opinions,
    });

    const consolidatedResult = {
      rankings: coordinatorResult.rankings,
      overall_rationale: coordinatorResult.overallRationale,
    };

    await sessionRepository.update(session.id, {
      status: "completed",
      consolidated_result: consolidatedResult,
      coordinator_provider_key: coordinatorResult.providerKey,
      completed_at: new Date().toISOString(),
    });

    await trendResearchRepository.update(trendResearch.id, {
      provider_key: candidateResult.providerKey,
      summary: consolidatedResult,
      intelligence_hub_session_id: session.id,
      status: "completed",
    });

    return {
      trendResearchId: trendResearch.id,
      sessionId: session.id,
      rankings: coordinatorResult.rankings,
      overallRationale: coordinatorResult.overallRationale,
      candidateCount: candidateResult.candidates.length,
    };
  } catch (error) {
    await trendResearchRepository.update(trendResearch.id, { status: "failed" }).catch(() => undefined);
    if (session) {
      await sessionRepository.update(session.id, { status: "failed" }).catch(() => undefined);
    }
    throw error;
  }
}
