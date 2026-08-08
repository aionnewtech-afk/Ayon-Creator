import { logger } from "../logger";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";

const SYSTEM_PROMPT =
  "Você extrai um termo de busca curto e específico (2-4 palavras, em português, sem jargão) para encontrar uma " +
  "foto real correspondente ao tema de uma campanha, num banco de imagens de estoque — nunca uma paráfrase " +
  "genérica do tema inteiro. Prefira um lugar/atração/atividade/público concretos. Não use termos abstratos de " +
  "escritório/planejamento (como 'planejamento de viagem', 'agenda', 'mapa') — eles tendem a trazer fotos sem " +
  "relação nenhuma com o assunto real. Responda só com um JSON no formato {\"searchQuery\": \"...\"}.";

/**
 * Deriva um termo de busca curto para o Media Provider a partir do tema da
 * campanha + nicho da marca — mesma técnica já usada pelo pipeline de vídeo
 * (`segmentScript`, arch. §14.7), nunca aplicada ao de foto (achado real:
 * `selectPhotoCandidates` concatenava `brand.niche` + `campaign.title` bruto
 * como busca literal — um título de campanha em frase completa ("Quero que
 * as pessoas entendam que é possível com Planejamento Antecipado...")
 * produzia resultados sem relação nenhuma com viagem, como um carro de
 * corrida). Mesma rede de segurança do vídeo: qualquer falha de
 * parsing/resposta cai no fallback (comportamento anterior), nunca bloqueia
 * o pipeline.
 */
export async function derivePhotoSearchQuery(theme: string, llmProvider: LlmProvider, fallbackQuery: string): Promise<string> {
  try {
    const result = await llmProvider.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: theme }],
      maxTokens: 128,
    });

    const parsed = parseLlmJson(result.text) as { searchQuery?: string };
    if (parsed.searchQuery) return parsed.searchQuery;

    logger.warn("asset_engine.derive_photo_search_query.unexpected_response", { rawText: result.text });
  } catch (error) {
    logger.warn("asset_engine.derive_photo_search_query.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return fallbackQuery;
}
