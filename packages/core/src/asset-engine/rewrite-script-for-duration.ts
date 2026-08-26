import { logger } from "../logger";
import type { LlmProvider } from "../providers/llm-provider";

/** ★ Achado real (ritmo médio de narração publicitária em pt-BR): ~2,5 palavras/segundo (~150 palavras/min) — só um alvo aproximado pro LLM mirar, nunca uma duração exata (o TTS real varia por pontuação/pausas). */
const WORDS_PER_SECOND = 2.5;

export interface RewriteScriptForDurationParams {
  script: string;
  targetDurationSeconds: number;
  llmProvider: LlmProvider;
}

/**
 * ★ Achado real (pedido direto do usuário — "eu quero poder escolher a
 * duração do vídeo"): a duração final é 100% derivada do tamanho do
 * roteiro — a narração (TTS) só lê o texto que existe, nunca corta ou
 * estica por conta própria. Pra "escolher duração" ter efeito real, o
 * roteiro em si precisa ser reescrito mirando esse tamanho ANTES de narrar
 * (`video-pipeline-narrate.ts`) ou gerar vídeo de avatar
 * (`video-pipeline-avatar.ts`) — nunca truncado/preenchido mecanicamente
 * (quebraria frases no meio), sempre reescrito pelo LLM preservando a
 * mensagem central. Nunca bloqueia o pipeline: qualquer falha aqui cai no
 * roteiro original, sem interromper a geração.
 */
export async function rewriteScriptForDuration(params: RewriteScriptForDurationParams): Promise<string> {
  const targetWords = Math.max(5, Math.round(params.targetDurationSeconds * WORDS_PER_SECOND));

  try {
    const result = await params.llmProvider.complete({
      system:
        "Você reescreve roteiros de narração em português do Brasil pra caber num tempo alvo, quando lidos em voz " +
        "alta num ritmo natural de publicidade (~2,5 palavras por segundo). Preserve a mensagem central, o tom e o " +
        "CTA do roteiro original — nunca invente fatos novos, só reescreva mais curto ou mais longo pra caber no " +
        "alvo. Responda só com o roteiro reescrito, sem aspas, sem comentário, sem marcação.",
      messages: [
        {
          role: "user",
          content: `Roteiro original:\n${params.script}\n\nReescreva para ficar em torno de ${targetWords} palavras (alvo: ${params.targetDurationSeconds}s de narração).`,
        },
      ],
      maxTokens: Math.max(500, targetWords * 3),
    });

    const rewritten = result.text.trim();
    return rewritten || params.script;
  } catch (error) {
    logger.warn("asset_engine.rewrite_script_for_duration.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return params.script;
  }
}
