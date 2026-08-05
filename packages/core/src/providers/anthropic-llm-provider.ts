import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { LlmCompletionRequest, LlmCompletionResult, LlmProvider } from "./llm-provider";
import { logProviderCall } from "./log-provider-call";

/**
 * Adapter concreto do LLM Provider (architecture.md §5) para a Anthropic.
 * Único arquivo do monorepo que importa o SDK da Anthropic — trocar de
 * fornecedor (ex.: adicionar um OpenAiLlmProvider) nunca exige mudar quem
 * chama `LlmProvider`, só o resultado da resolução em provider-gateway.ts.
 */
export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;

  constructor(
    private readonly providerKey: string,
    apiKey: string,
    /** ★ Missão 12 (architecture.md §15.7) — mesmo client de service role já usado para resolver este adapter; instrumentação real via `logProviderCall`, nunca bloqueia a chamada real se falhar. */
    private readonly serviceRoleDb?: SupabaseClient<Database>,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const startedAt = new Date();
    let errorMessage: string | undefined;
    let tokensInput: number | undefined;
    let tokensOutput: number | undefined;

    try {
      const response = await this.client.messages.create({
        model: this.providerKey,
        max_tokens: request.maxTokens ?? 1024,
        system: request.system,
        messages: request.messages,
      });

      tokensInput = response.usage.input_tokens;
      tokensOutput = response.usage.output_tokens;

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return { text, providerKey: this.providerKey };
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (this.serviceRoleDb) {
        await logProviderCall({
          serviceRoleDb: this.serviceRoleDb,
          providerKey: this.providerKey,
          capability: "llm",
          model: this.providerKey,
          endpoint: "messages.create",
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
