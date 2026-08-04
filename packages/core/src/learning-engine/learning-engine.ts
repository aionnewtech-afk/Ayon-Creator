import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { BrandBrainRepository } from "../repositories/brand-brain.repository";
import { SpecialistRepository } from "../repositories/specialist.repository";
import { IntelligenceHubSessionRepository } from "../repositories/intelligence-hub-session.repository";
import { LearningSignalRepository } from "../repositories/learning-signal.repository";
import { LearningInsightRepository } from "../repositories/learning-insight.repository";
import { knownFieldsFromProfile } from "../brand-brain/onboarding-themes";
import { runLearningAnalysisPanel } from "./run-learning-analysis-panel";
import { runLearningCoordinator, type CandidateLearningInsight } from "./run-learning-coordinator";

type LearningInsightRow = Database["public"]["Tables"]["learning_insights"]["Row"];

export const MINIMUM_UNUSED_SIGNALS = 5;
const LEARNING_ANALYSIS_DECISION_TYPE = "learning_analysis";

export class InsufficientSignalsError extends Error {
  constructor(
    public readonly available: number,
    public readonly required: number,
  ) {
    super(`Sinais insuficientes para uma nova análise: ${available}/${required}.`);
    this.name = "InsufficientSignalsError";
  }
}

export interface RunLearningAnalysisParams {
  /** Client de sessão (RLS) — grava intelligence_hub_sessions/specialist_opinions/learning_insights. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve Specialist Registry e provider_configs. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  brandId: string;
  brandName: string;
}

export interface RunLearningAnalysisResult {
  sessionId: string;
  signalCount: number;
  insights: LearningInsightRow[];
  overallRationale: string;
}

/**
 * Orquestra uma análise de Brand Evolution completa (Fluxo 8): agrega os
 * `learning_signals` ainda não usados numa análise anterior e aciona o
 * Intelligence Hub — `learning_analysis` é só mais um tipo de decisão dele
 * (painel Marketing + Branding + Coordinator generalizado), mesma trilha de
 * auditoria de campaign_strategy/trend_ranking (intelligence_hub_sessions com
 * related_entity_type = 'brand', já que a análise é em nível de marca, não de
 * uma campanha/peça/pesquisa específica). Síncrono, sob demanda, gratuito
 * (arch. §3.6) — lança `InsufficientSignalsError` se não houver os 5 sinais
 * mínimos aprovados pelo dono do produto.
 */
export async function runLearningAnalysis(params: RunLearningAnalysisParams): Promise<RunLearningAnalysisResult> {
  const brandBrainRepository = new BrandBrainRepository(params.db);
  const specialistRepository = new SpecialistRepository(params.serviceRoleDb);
  const sessionRepository = new IntelligenceHubSessionRepository(params.db);
  const learningSignalRepository = new LearningSignalRepository(params.db);
  const learningInsightRepository = new LearningInsightRepository(params.db);

  const signals = await learningSignalRepository.findUnusedByBrandId(params.brandId);
  if (signals.length < MINIMUM_UNUSED_SIGNALS) {
    throw new InsufficientSignalsError(signals.length, MINIMUM_UNUSED_SIGNALS);
  }

  const profile = await brandBrainRepository.findByBrandId(params.brandId);
  const knownFields = knownFieldsFromProfile(profile);

  const session = await sessionRepository.create({
    brand_id: params.brandId,
    related_entity_type: "brand",
    related_entity_id: params.brandId,
    trigger_reason: LEARNING_ANALYSIS_DECISION_TYPE,
  });

  try {
    const [specialists, coordinator] = await Promise.all([
      specialistRepository.findApplicable(LEARNING_ANALYSIS_DECISION_TYPE),
      specialistRepository.findCoordinator(),
    ]);

    if (specialists.length === 0) {
      throw new Error(`Nenhum especialista ativo aplicável a "${LEARNING_ANALYSIS_DECISION_TYPE}" no Specialist Registry.`);
    }
    if (!coordinator) {
      throw new Error("Nenhum Coordinator ativo no Specialist Registry.");
    }

    const opinions = await runLearningAnalysisPanel({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      sessionId: session.id,
      brandName: params.brandName,
      knownFields,
      signals,
      specialists,
    });

    const coordinatorResult = await runLearningCoordinator({
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      coordinator,
      brandName: params.brandName,
      knownFields,
      signals,
      opinions,
    });

    const consolidatedResult = {
      insights: coordinatorResult.insights,
      overall_rationale: coordinatorResult.overallRationale,
    };

    await sessionRepository.update(session.id, {
      status: "completed",
      consolidated_result: consolidatedResult,
      coordinator_provider_key: coordinatorResult.providerKey,
      completed_at: new Date().toISOString(),
    });

    const createdInsights = await Promise.all(
      coordinatorResult.insights.map((insight: CandidateLearningInsight) =>
        learningInsightRepository.create({
          brand_id: params.brandId,
          insight_type: insight.insightType,
          summary: { text: insight.summary, rationale: insight.rationale },
          applied_to: insight.appliedTo,
        }),
      ),
    );

    return {
      sessionId: session.id,
      signalCount: signals.length,
      insights: createdInsights,
      overallRationale: coordinatorResult.overallRationale,
    };
  } catch (error) {
    await sessionRepository.update(session.id, { status: "failed" }).catch(() => undefined);
    throw error;
  }
}
