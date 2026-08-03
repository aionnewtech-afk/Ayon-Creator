import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveLlmProvider } from "../providers/provider-gateway";
import { parseLlmJson } from "../shared/llm-json";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import type { TrendCandidate } from "../providers/trend-source-provider";
import { buildTrendRankingCoordinatorMessage } from "./trend-ranking-prompts";
import type { SpecialistOpinionResult } from "../intelligence-hub/run-specialist-panel";

type SpecialistRow = Database["public"]["Tables"]["specialists"]["Row"];

const TrendCoordinatorResponseSchema = z.object({
  rankings: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        rationale: z.string().min(1),
        source_url: z.string().nullable().default(null),
      }),
    )
    .max(10),
  overall_rationale: z.string().min(1),
});

export interface RankedTrend {
  title: string;
  summary: string;
  rationale: string;
  sourceUrl: string | null;
}

export interface TrendCoordinatorResult {
  rankings: RankedTrend[];
  overallRationale: string;
  providerKey: string;
}

export interface RunTrendCoordinatorParams {
  /** Client de service role — resolve provider_configs para o Coordinator. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  coordinator: SpecialistRow;
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  candidates: TrendCandidate[];
  opinions: SpecialistOpinionResult[];
}

/**
 * Aciona o Coordinator do Specialist Registry para consolidar o
 * ranqueamento final de tendências (architecture.md §3.3, regra
 * inegociável: nenhuma tendência é exibida sem passar por aqui).
 */
export async function runTrendCoordinator(params: RunTrendCoordinatorParams): Promise<TrendCoordinatorResult> {
  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier, params.coordinator.id);

  const successfulOpinions = params.opinions.filter(
    (opinion): opinion is SpecialistOpinionResult & { failed: false } => !opinion.failed,
  );

  const userMessage = buildTrendRankingCoordinatorMessage({
    brandName: params.brandName,
    knownFields: params.knownFields,
    candidates: params.candidates,
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

  const parsed = TrendCoordinatorResponseSchema.parse(parseLlmJson(completion.text));

  return {
    rankings: parsed.rankings.map((ranking) => ({
      title: ranking.title,
      summary: ranking.summary,
      rationale: ranking.rationale,
      sourceUrl: ranking.source_url,
    })),
    overallRationale: parsed.overall_rationale,
    providerKey: completion.providerKey,
  };
}
