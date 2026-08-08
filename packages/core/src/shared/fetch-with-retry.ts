const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

export interface FetchWithRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  retryableStatusCodes?: number[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Substituto direto de `fetch()` com retry automático (achado real, sprint
 * de estabilização — item explícito do pedido: "retry automático para
 * falhas temporárias de Anthropic/ElevenLabs/Pexels/Shotstack/n8n").
 * Anthropic já tem retry embutido no SDK oficial (2 tentativas por padrão,
 * `maxRetries` nunca sobrescrito em `anthropic-llm-provider.ts`) — este
 * helper cobre os fornecedores que só falam HTTP cru (`fetch`), sem SDK.
 *
 * Só tenta de novo em falha de rede (o próprio `fetch` lançando) ou em
 * status HTTP tipicamente transitório (429/5xx) — nunca em 4xx que não seja
 * 429 (ex.: 400/401/404), porque repetir uma chave inválida ou um corpo
 * malformado nunca muda o resultado, só atrasa o erro real. Backoff
 * exponencial simples (500ms, 1s, 2s...), sem dependência nova.
 *
 * Em caso de esgotar as tentativas, retorna a última `Response` obtida
 * (para status HTTP) ou relança o último erro (para falha de rede) — quem
 * chama continua com exatamente o mesmo tratamento de erro que já tinha
 * (`if (!response.ok) throw ...`), nenhuma mudança de contrato.
 */
export async function fetchWithRetry(input: string | URL, init?: RequestInit, options: FetchWithRetryOptions = {}): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const retryableStatusCodes = options.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(input, init);
      const isLastAttempt = attempt === maxAttempts;
      if (response.ok || !retryableStatusCodes.includes(response.status) || isLastAttempt) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
    }

    await sleep(baseDelayMs * 2 ** (attempt - 1));
  }

  // Inalcançável na prática (o loop sempre retorna ou lança antes) — só para satisfazer o compilador.
  throw lastError ?? new Error("fetchWithRetry esgotou as tentativas sem resposta nem erro.");
}
