import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { SpecialistOpinionRepository } from "../repositories/specialist-opinion.repository";
import { resolveLlmProvider } from "../providers/provider-gateway";
import { parseLlmJson } from "../shared/llm-json";
import { logger } from "../logger";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import { buildSpecialistUserMessage } from "./intelligence-hub-prompts";

type SpecialistRow = Database["public"]["Tables"]["specialists"]["Row"];

const SpecialistOpinionSchema = z.object({
  opinion: z.string().min(1),
  rationale: z.string().min(1),
});

export type SpecialistOpinionResult =
  | { specialistId: string; specialistName: string; failed: false; opinion: string; rationale: string }
  | { specialistId: string; specialistName: string; failed: true; opinion: null; rationale: null };

export interface RunSpecialistPanelParams {
  /** Client de sessão (RLS) — grava specialist_opinions. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve provider_configs por especialista. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  sessionId: string;
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  learnedPreferencesText?: string;
  objective: string;
  /** ★ Achado real (pedido direto do usuário — "a pesquisa tem que de fato valer a pena"): fatos reais de `researchCampaignObjective`, quando disponíveis — repassados pra cada especialista via `buildSpecialistUserMessage`. */
  researchNotes?: string;
  specialists: SpecialistRow[];
}

/**
 * Aciona cada especialista aplicável em paralelo (Promise.allSettled — a
 * falha de um nunca bloqueia os demais, Fluxo 10 passo 7). Cada especialista
 * usa o `system_prompt` do Specialist Registry como está, sem nenhum texto
 * hardcoded de papel aqui — este arquivo só monta o contexto compartilhado.
 */
export async function runSpecialistPanel(params: RunSpecialistPanelParams): Promise<SpecialistOpinionResult[]> {
  const opinionRepository = new SpecialistOpinionRepository(params.db);

  const settled = await Promise.allSettled(
    params.specialists.map(async (specialist) => {
      const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier, specialist.id);

      const userMessage = buildSpecialistUserMessage({
        brandName: params.brandName,
        knownFields: params.knownFields,
        learnedPreferencesText: params.learnedPreferencesText,
        objective: params.objective,
        researchNotes: params.researchNotes,
      });

      const completion = await llmProvider.complete({
        system: specialist.system_prompt,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 1024,
      });

      const parsed = SpecialistOpinionSchema.parse(parseLlmJson(completion.text));

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

    logger.warn("intelligence_hub.specialist_failed", {
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
