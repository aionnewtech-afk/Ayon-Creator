import { logger } from "../logger";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";

const SYSTEM_PROMPT =
  // ★ Achado real (validação): o banco de imagens (Pexels) é indexado majoritariamente
  // em inglês — a mesma busca em português retorna correspondência fraca por
  // palavra-chave solta (ex.: "natal viagem em família" trouxe uma foto de uma rua
  // chamada "Av. Boa Viagem", sem nenhuma relação com o tema real), enquanto o
  // equivalente em inglês retorna fotos genuinamente relevantes (testado
  // diretamente na API do Pexels). O texto da peça continua em português —
  // só o termo de busca (nunca visto pelo usuário) muda de idioma.
  "You extract a short, specific search term (2-4 words, in English, no jargon) to find a real photo matching " +
  "the theme of a marketing campaign, in a stock photo database — never a generic paraphrase of the whole theme. " +
  "Prefer a concrete place/attraction/activity/audience. Never use abstract office/planning terms (like 'travel " +
  "planning', 'itinerary', 'map') — they tend to bring back photos with no relation to the real subject. The " +
  "campaign theme you'll receive may be in Portuguese — always translate the concept into an English search term " +
  "regardless. Reply ONLY with JSON in the format {\"searchQuery\": \"...\"}.";

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
      // ★ Achado real (validação): 128 é pequeno demais para o Gemini 3 — o
      // gasto residual de "pensamento" (mesmo com reasoning_effort: "low" em
      // gemini-llm-provider.ts) cortava a resposta antes do JSON fechar,
      // caindo sempre no fallback genérico em silêncio — causa real de
      // "imagens sem relação com o tema" além da derivação de query em si.
      maxTokens: 300,
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
