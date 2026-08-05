import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";
import { logger } from "../logger";
import { CampaignRepository } from "../repositories/campaign.repository";

export interface VisualBrief {
  /** Resumo curto do tema da campanha (poucas palavras) — usado como título em thumbnail/stories/carousel (arch. §14.5). */
  shortTitle: string;
}

/**
 * Resolve o `visual_brief` da campanha (arch. §14.4.3) — parâmetros de
 * composição decididos por IA **uma vez por campanha**, nunca peça a peça,
 * para toda peça visual gerada depois compartilhar a mesma identidade
 * (mesmo título curto, nunca um por peça). Idempotente: se já resolvido,
 * lê e devolve sem chamar o LLM de novo.
 */
export async function resolveVisualBrief(
  db: SupabaseClient<Database>,
  campaignId: string,
  llmProvider: LlmProvider,
): Promise<VisualBrief> {
  const campaignRepository = new CampaignRepository(db);
  const campaign = await campaignRepository.findById(campaignId);
  if (!campaign) return { shortTitle: "" };

  const existing = campaign.visual_brief as VisualBrief | null;
  if (existing?.shortTitle) return existing;

  const shortTitle = await generateShortTitle(campaign.title, llmProvider);
  const visualBrief: VisualBrief = { shortTitle };

  await campaignRepository.update(campaignId, { visual_brief: visualBrief as unknown as Record<string, unknown> });

  return visualBrief;
}

async function generateShortTitle(campaignTitle: string, llmProvider: LlmProvider): Promise<string> {
  try {
    const result = await llmProvider.complete({
      system:
        "Você resume o tema de uma campanha de marketing num título bem curto (2-5 palavras), " +
        "para uso como título sobreposto numa thumbnail/imagem — nunca o objetivo completo digitado pelo usuário. " +
        "Responda só com um JSON no formato {\"shortTitle\": \"...\"}.",
      messages: [{ role: "user", content: campaignTitle }],
      maxTokens: 60,
    });

    const parsed = parseLlmJson(result.text) as { shortTitle?: string };
    if (parsed.shortTitle) return parsed.shortTitle;

    logger.warn("asset_engine.generate_short_title.unexpected_response", { rawText: result.text });
  } catch (error) {
    logger.warn("asset_engine.generate_short_title.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return campaignTitle.slice(0, 40);
}
