import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { SpecialistOpinionRepository } from "../repositories/specialist-opinion.repository";
import { resolveLlmProvider } from "../providers/provider-gateway";
import { parseLlmJson } from "../shared/llm-json";
import { logger } from "../logger";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import { buildLearningAnalysisSpecialistMessage } from "./learning-engine-prompts";
import type { SpecialistOpinionResult } from "../intelligence-hub/run-specialist-panel";

type SpecialistRow = Database["public"]["Tables"]["specialists"]["Row"];
type LearningSignalRow = Database["public"]["Tables"]["learning_signals"]["Row"];

const LearningOpinionSchema = z.object({
  opinion: z.string().min(1),
  rationale: z.string().min(1),
});

export interface RunLearningAnalysisPanelParams {
  /** Client de sessão (RLS) — grava specialist_opinions. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve provider_configs por especialista. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  sessionId: string;
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  signals: LearningSignalRow[];
  specialists: SpecialistRow[];
}

/**
 * Aciona cada especialista aplicável a `learning_analysis` em paralelo
 * (Promise.allSettled, mesmo padrão de run-specialist-panel.ts/
 * run-trend-ranking-panel.ts — a falha de um nunca bloqueia os demais nem o
 * Coordinator).
 */
export async function runLearningAnalysisPanel(params: RunLearningAnalysisPanelParams): Promise<SpecialistOpinionResult[]> {
  const opinionRepository = new SpecialistOpinionRepository(params.db);

  const settled = await Promise.allSettled(
    params.specialists.map(async (specialist) => {
      const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier, specialist.id);

      const userMessage = buildLearningAnalysisSpecialistMessage({
        brandName: params.brandName,
        knownFields: params.knownFields,
        signals: params.signals,
      });

      const completion = await llmProvider.complete({
        system: specialist.system_prompt,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 1024,
      });

      const parsed = LearningOpinionSchema.parse(parseLlmJson(completion.text));

      await opinionRepository.create({
        session_id: params.sessionId,
        specialist_id: specialist.id,
        opinion: { opinion: parsed.opinion, rationale: parsed.rationale },
        llm_provider_key: completion.providerKey,
      });

      return { opinion: parsed.opinion, rationale: parsed.rationale };
    }),
  );

  return settled.map((result, index): SpecialistOpinionResult => {
    const specialist = params.specialists[index];
    if (!specialist) throw new Error(`Especialista no índice ${index} não encontrado — estado inesperado.`);

    if (result.status === "fulfilled") {
      return {
        specialistId: specialist.id,
        specialistName: specialist.name,
        failed: false,
        opinion: result.value.opinion,
        rationale: result.value.rationale,
      };
    }

    logger.warn("learning_engine.specialist_failed", {
      specialistId: specialist.id,
      specialistKey: specialist.key,
      reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });

    return {
      specialistId: specialist.id,
      specialistName: specialist.name,
      failed: true,
      opinion: null,
      rationale: null,
    };
  });
}
