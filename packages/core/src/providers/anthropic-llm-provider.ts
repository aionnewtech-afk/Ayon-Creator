import Anthropic from "@anthropic-ai/sdk";
import type { LlmCompletionRequest, LlmCompletionResult, LlmProvider } from "./llm-provider";

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
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const response = await this.client.messages.create({
      model: this.providerKey,
      max_tokens: request.maxTokens ?? 1024,
      system: request.system,
      messages: request.messages,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return { text, providerKey: this.providerKey };
  }
}
