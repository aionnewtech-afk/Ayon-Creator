/**
 * Contrato de capacidade `llm` (architecture.md §5) — nenhum Core Engine
 * conhece o fornecedor concreto por trás desta interface, apenas a
 * capacidade. Ver anthropic-llm-provider.ts para a implementação inicial.
 */
export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmCompletionRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface LlmCompletionResult {
  text: string;
  providerKey: string;
}

export interface LlmProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}
