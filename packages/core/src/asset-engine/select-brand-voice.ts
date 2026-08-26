import { logger } from "../logger";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";
import { DEFAULT_VOICE_CATALOG_ENTRY, VOICE_CATALOG, findVoiceCatalogEntry } from "./voice-catalog";

export interface SelectBrandVoiceParams {
  llmProvider: LlmProvider;
  niche: string | null;
  toneOfVoice: string | null;
  targetAudience: string | null;
  visualStyle: string | null;
}

/**
 * Escolhe a voz mais adequada para a marca no catálogo curado (arch.
 * §14.3), considerando nicho, tom de voz, público e estilo visual — nunca
 * idioma (produto é pt-BR único até hoje, decisão registrada, não uma
 * lacuna). Chamado só quando `brand_brain_profiles.default_voice_ref` ainda
 * não existe (1ª geração de vídeo/foto da marca) — o resultado é persistido
 * pelo chamador para as gerações seguintes reaproveitarem sem chamar o LLM
 * de novo.
 *
 * Nunca bloqueia o pipeline: qualquer falha de parsing/resposta inesperada
 * cai no catálogo padrão (`DEFAULT_VOICE_CATALOG_ENTRY`), mesmo espírito
 * defensivo já usado em outros pontos do Asset Engine.
 */
export async function selectBrandVoice(params: SelectBrandVoiceParams): Promise<string> {
  const catalogDescription = VOICE_CATALOG.map((entry) => `- ${entry.voiceId}: ${entry.description}`).join("\n");

  const brandContext = [
    params.niche ? `Nicho: ${params.niche}` : null,
    params.toneOfVoice ? `Tom de voz: ${params.toneOfVoice}` : null,
    params.targetAudience ? `Público-alvo: ${params.targetAudience}` : null,
    params.visualStyle ? `Estilo visual: ${params.visualStyle}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (!brandContext) return DEFAULT_VOICE_CATALOG_ENTRY.voiceId;

  try {
    const result = await params.llmProvider.complete({
      system:
        "Você escolhe a voz de narração mais adequada para uma marca, a partir de um catálogo fixo. " +
        "Responda só com um JSON no formato {\"voiceId\": \"...\"}, usando exatamente um dos ids do catálogo abaixo.\n\n" +
        `Catálogo:\n${catalogDescription}`,
      messages: [{ role: "user", content: brandContext }],
      // ★ Achado real (validação): 100 é pequeno demais para o Gemini 3 — o
      // gasto residual de "pensamento" (mesmo com reasoning_effort: "low" em
      // gemini-llm-provider.ts) cortava a resposta antes do JSON fechar,
      // caindo sempre no catálogo padrão em silêncio — a seleção "inteligente"
      // nunca rodava de verdade, toda marca ficava com a voz genérica.
      maxTokens: 300,
    });

    const parsed = parseLlmJson(result.text) as { voiceId?: string };
    if (parsed.voiceId && findVoiceCatalogEntry(parsed.voiceId)) return parsed.voiceId;

    logger.warn("asset_engine.select_brand_voice.unexpected_response", { rawText: result.text });
  } catch (error) {
    // Defensivo: resposta fora do formato esperado não deve travar a
    // geração de vídeo/foto — cai no padrão abaixo. Sempre registrado, para
    // não mascarar uma falha real de configuração/fornecedor em produção.
    logger.warn("asset_engine.select_brand_voice.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return DEFAULT_VOICE_CATALOG_ENTRY.voiceId;
}
