/**
 * Parsing compartilhado de respostas JSON de LLM (docs/engine-behavior.md §7
 * — contrato de saída comum a todo Engine). Usado pelo Brand Brain
 * (process-onboarding-turn.ts) e pelo Intelligence Hub — qualquer Engine
 * futuro que espera JSON estrito de volta do LLM Provider deve reusar isto,
 * não reimplementar a extração/parsing.
 */
export class LlmJsonParseError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
  ) {
    super(message);
    this.name = "LlmJsonParseError";
  }
}

/** Extrai o bloco JSON de uma resposta, tolerando cerca ```json ou texto ao redor. */
export function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return trimmed;

  return trimmed.slice(firstBrace, lastBrace + 1);
}

export function parseLlmJson(rawText: string): unknown {
  const jsonText = extractJsonBlock(rawText);

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new LlmJsonParseError("Resposta do LLM não era um JSON válido.", rawText);
  }
}
