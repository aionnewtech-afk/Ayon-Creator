import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LearningInsightAppliedTo, ProviderTier } from "@ayon/types";
import { LEARNING_INSIGHT_APPLIED_TO } from "@ayon/types";
import { resolveLlmProvider } from "../providers/provider-gateway";
import { parseLlmJson } from "../shared/llm-json";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import { buildLearningAnalysisCoordinatorMessage } from "./learning-engine-prompts";
import type { SpecialistOpinionResult } from "../intelligence-hub/run-specialist-panel";

type SpecialistRow = Database["public"]["Tables"]["specialists"]["Row"];
type LearningSignalRow = Database["public"]["Tables"]["learning_signals"]["Row"];

const LearningCoordinatorResponseSchema = z.object({
  insights: z
    .array(
      z.object({
        insight_type: z.string().min(1),
        summary: z.string().min(1),
        rationale: z.string().min(1),
        applied_to: z.enum(LEARNING_INSIGHT_APPLIED_TO),
      }),
    )
    .max(5),
  overall_rationale: z.string().min(1),
});

export interface CandidateLearningInsight {
  insightType: string;
  summary: string;
  rationale: string;
  appliedTo: LearningInsightAppliedTo;
}

export interface LearningCoordinatorResult {
  insights: CandidateLearningInsight[];
  overallRationale: string;
  providerKey: string;
}

export interface RunLearningCoordinatorParams {
  /** Client de service role — resolve provider_configs para o Coordinator. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  coordinator: SpecialistRow;
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  signals: LearningSignalRow[];
  opinions: SpecialistOpinionResult[];
}

/**
 * Aciona o Coordinator do Specialist Registry para consolidar os candidatos a
 * `learning_insights` (architecture.md §3.6, Fluxo 8) — mesmo Coordinator
 * generalizado usado por campaign_strategy/trend_ranking (migration 0007),
 * só o formato de saída muda, declarado na mensagem, não no system_prompt.
 */
export async function runLearningCoordinator(params: RunLearningCoordinatorParams): Promise<LearningCoordinatorResult> {
  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier, params.coordinator.id);

  const successfulOpinions = params.opinions.filter(
    (opinion): opinion is SpecialistOpinionResult & { failed: false } => !opinion.failed,
  );

  const userMessage = buildLearningAnalysisCoordinatorMessage({
    brandName: params.brandName,
    knownFields: params.knownFields,
    signals: params.signals,
    opinions: successfulOpinions.map((opinion) => ({
      specialistName: opinion.specialistName,
      opinion: opinion.opinion,
      rationale: opinion.rationale,
    })),
  });

  const completion = await llmProvider.complete({
    system: params.coordinator.system_prompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1536,
  });

  const parsed = LearningCoordinatorResponseSchema.parse(parseLlmJson(completion.text));

  return {
    insights: parsed.insights.map((insight) => ({
      insightType: insight.insight_type,
      summary: insight.summary,
      rationale: insight.rationale,
      appliedTo: insight.applied_to,
    })),
    overallRationale: parsed.overall_rationale,
    providerKey: completion.providerKey,
  };
}
