import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { LlmCompletionRequest, LlmCompletionResult, LlmProvider } from "./llm-provider";
import { logProviderCall } from "./log-provider-call";
import { fetchWithRetry } from "../shared/fetch-with-retry";

const GEMINI_OPENAI_COMPAT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

interface GeminiChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Adapter concreto do LLM Provider (architecture.md §5) para o Gemini, via
 * sua camada de compatibilidade OpenAI (`/v1beta/openai/chat/completions` —
 * https://ai.google.dev/gemini-api/docs/openai) em vez do SDK nativo do
 * Gemini — nenhuma dependência nova (só `fetch`/`fetchWithRetry`, já
 * usados por ElevenLabs/Pexels/Shotstack). Mesmo contrato `LlmProvider` de
 * `anthropic-llm-provider.ts` — nenhum call site (Intelligence Hub, Asset
 * Engine, Trend Engine, Learning Engine) precisa saber qual dos dois está
 * ativo, só `resolveLlmProvider` (provider-gateway.ts).
 *
 * ★ Troca temporária de fornecedor (conta Anthropic sem créditos, conta
 * Gemini com créditos disponíveis) — ver `resolveLlmProvider` para a chave
 * de ativação (`LLM_PROVIDER=gemini`). Reversível a qualquer momento.
 */
export class GeminiLlmProvider implements LlmProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
    /** ★ Missão 12 (architecture.md §15.7) — mesmo client de service role já usado para resolver este adapter; instrumentação real via `logProviderCall`, nunca bloqueia a chamada real se falhar. */
    private readonly serviceRoleDb?: SupabaseClient<Database>,
  ) {}

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const startedAt = new Date();
    let errorMessage: string | undefined;
    let tokensInput: number | undefined;
    let tokensOutput: number | undefined;

    try {
      const response = await fetchWithRetry(`${GEMINI_OPENAI_COMPAT_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.providerKey,
          max_tokens: request.maxTokens ?? 1024,
          // ★ Achado real (validação direta na API, 2 rodadas): modelos
          // Gemini 3 gastam parte do `max_tokens` em tokens de "pensamento"
          // invisíveis antes da resposta visível — com vários call sites já
          // usando `maxTokens` pequeno (60-300, ex. resolve-visual-brief.ts,
          // select-brand-voice.ts, derive-photo-search-query.ts), respostas
          // vinham cortadas no meio do JSON mesmo com `reasoning_effort:
          // "low"` (1ª rodada de correção — insuficiente, achado real ao
          // investigar um relato de bug do usuário: título de thumbnail
          // sempre cortado, geração de voz sempre caindo no padrão). Testado
          // `"none"` direto na API, nos dois extremos: numa chamada minúscula
          // (~150 tokens de contexto) E numa de síntese complexa (~1000
          // tokens, 3 opiniões + coordinator) — zero truncamento nos dois, e
          // a qualidade da síntese complexa não regrediu (resposta coerente,
          // completa, nenhum campo faltando). `"none"` elimina o gasto
          // invisível por completo, em vez de só reduzi-lo — mais barato e
          // mais confiável que "low" para todo call site existente.
          reasoning_effort: "none",
          // Camada OpenAI-compatible do Gemini: `system` vira a 1ª mensagem
          // (role "system"), mesma convenção do Chat Completions da OpenAI —
          // nenhuma mudança de prompt, só de transporte.
          messages: [{ role: "system", content: request.system }, ...request.messages],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        errorMessage = `Gemini (OpenAI-compat) respondeu ${response.status}: ${errorBody}`;
        throw new Error(errorMessage);
      }

      const payload = (await response.json()) as GeminiChatCompletionResponse;
      tokensInput = payload.usage?.prompt_tokens;
      tokensOutput = payload.usage?.completion_tokens;

      const text = payload.choices?.[0]?.message?.content ?? "";

      return { text, providerKey: this.providerKey };
    } catch (error) {
      errorMessage ??= error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (this.serviceRoleDb) {
        await logProviderCall({
          serviceRoleDb: this.serviceRoleDb,
          providerKey: this.providerKey,
          capability: "llm",
          model: this.providerKey,
          endpoint: "chat.completions (OpenAI-compat)",
          startedAt,
          finishedAt: new Date(),
          ok: !errorMessage,
          errorMessage,
          tokensInput,
          tokensOutput,
        });
      }
    }
  }
}
