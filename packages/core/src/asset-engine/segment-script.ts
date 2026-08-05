import { logger } from "../logger";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";

export interface ScriptSegment {
  text: string;
  /** Termo de busca curto e específico (destino/lugar/assunto concreto), extraído do trecho — nunca uma paráfrase genérica. */
  searchQuery: string;
}

function buildSystemPrompt(context: string): string {
  return (
    "Você divide um roteiro de narração em trechos lógicos para escolher uma cena de vídeo para cada um. " +
    "Cada trecho deve corresponder a uma ideia/lugar/assunto concreto do roteiro (ex.: um destino, uma atração, um prato). " +
    "Para cada trecho, extraia um termo de busca curto e específico (2-4 palavras, em português, sem jargão) que encontraria um vídeo real correspondente num banco de imagens — nunca uma paráfrase genérica do roteiro inteiro. " +
    `Contexto da campanha (destino/nicho): "${context}". ` +
    "Para trechos que NÃO mencionam um lugar/atração concreto (ex.: encerramento, chamada para ação, promessa de suporte), NÃO use termos abstratos de escritório/planejamento (como 'planejamento de viagem', 'mapa', 'agenda') — eles tendem a trazer clipes de estoque com texto ou bandeiras de outros países, quebrando a identidade da campanha. Prefira um termo visual ligado ao contexto da campanha acima (ex.: paisagem, atividade ou público do destino). " +
    "Responda só com um JSON no formato {\"segments\": [{\"text\": \"...\", \"searchQuery\": \"...\"}]}, cobrindo o roteiro inteiro (a concatenação dos `text` deve reconstruir o roteiro), com pelo menos 2 e no máximo 6 trechos."
  );
}

/**
 * Segmenta o roteiro em trechos com termo de busca próprio (arch. §14.7) —
 * substitui a busca única por `campaign.title` da Etapa 1 original. Cada
 * trecho vira uma busca separada no Media Provider (video-pipeline-scenes.ts),
 * em vez de uma única cena genérica repetida para o vídeo inteiro.
 *
 * `context` (destino/nicho da campanha) é injetado no prompt para blindar
 * trechos sem lugar concreto (ex.: fechamento/CTA) contra buscas genéricas
 * demais — ★ achado real da validação da Missão 11 (task 15): um trecho de
 * fechamento sem contexto gerou a busca "planejamento de viagem", que
 * trouxe um clipe de estoque com um cartão escrito "USA", destoando de uma
 * campanha sobre um destino brasileiro.
 *
 * Nunca bloqueia o pipeline: qualquer falha de parsing/resposta inesperada
 * cai num único segmento cobrindo o roteiro inteiro, usando `fallbackQuery`
 * (nicho da marca) — pior caso é o comportamento da Etapa 1 original, nunca
 * uma falha.
 */
export async function segmentScript(
  script: string,
  llmProvider: LlmProvider,
  fallbackQuery: string,
  context: string,
): Promise<ScriptSegment[]> {
  try {
    const result = await llmProvider.complete({
      system: buildSystemPrompt(context),
      messages: [{ role: "user", content: script }],
      maxTokens: 1024,
    });

    const parsed = parseLlmJson(result.text) as { segments?: ScriptSegment[] };
    if (parsed.segments?.length && parsed.segments.every((s) => s.text && s.searchQuery)) {
      return parsed.segments;
    }

    logger.warn("asset_engine.segment_script.unexpected_response", { rawText: result.text });
  } catch (error) {
    logger.warn("asset_engine.segment_script.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return [{ text: script, searchQuery: fallbackQuery }];
}
