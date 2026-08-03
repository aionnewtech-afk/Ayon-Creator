import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveLlmProvider } from "../providers/provider-gateway";
import { parseLlmJson } from "../shared/llm-json";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import { buildCoordinatorUserMessage } from "./intelligence-hub-prompts";
import type { SpecialistOpinionResult } from "./run-specialist-panel";

type SpecialistRow = Database["public"]["Tables"]["specialists"]["Row"];

const CoordinatorResponseSchema = z.object({
  consolidated_strategy: z.string().min(1),
  rationale: z.string().min(1),
  divergences: z.string().nullable().default(null),
});

export interface CoordinatorResult {
  consolidatedStrategy: string;
  rationale: string;
  divergences: string | null;
  providerKey: string;
}

export interface RunCoordinatorParams {
  /** Client de service role — resolve provider_configs para o Coordinator. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  coordinator: SpecialistRow;
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  objective: string;
  opinions: SpecialistOpinionResult[];
}

/**
 * Aciona o Coordinator do Specialist Registry (`role = coordinator`) — nunca
 * hardcoded. Recebe só as opiniões que tiveram sucesso; se um especialista
 * falhou, o Coordinator segue em frente com os demais (Fluxo 10, passo 7).
 */
export async function runCoordinator(params: RunCoordinatorParams): Promise<CoordinatorResult> {
  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier, params.coordinator.id);

  const successfulOpinions = params.opinions.filter(
    (opinion): opinion is SpecialistOpinionResult & { failed: false } => !opinion.failed,
  );

  const userMessage = buildCoordinatorUserMessage({
    brandName: params.brandName,
    knownFields: params.knownFields,
    objective: params.objective,
    opinions: successfulOpinions.map((opinion) => ({
      specialistName: opinion.specialistName,
      opinion: opinion.opinion,
      rationale: opinion.rationale,
    })),
  });

  const completion = await llmProvider.complete({
    system: params.coordinator.system_prompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1024,
  });

  const parsed = CoordinatorResponseSchema.parse(parseLlmJson(completion.text));

  return {
    consolidatedStrategy: parsed.consolidated_strategy,
    rationale: parsed.rationale,
    divergences: parsed.divergences,
    providerKey: completion.providerKey,
  };
}
