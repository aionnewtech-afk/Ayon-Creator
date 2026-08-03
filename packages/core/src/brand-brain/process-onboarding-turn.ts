import { z } from "zod";
import { ONBOARDING_QUESTION_KEYS, type OnboardingQuestionKey } from "@ayon/types";
import type { LlmMessage, LlmProvider } from "../providers/llm-provider";
import { buildOnboardingSystemPrompt, type KnownFieldsSnapshot } from "./onboarding-prompt";

export interface ConversationTurn {
  role: "user" | "ayon";
  text: string;
}

export interface ProcessOnboardingTurnParams {
  llmProvider: LlmProvider;
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  /** Turnos anteriores, do mais antigo para o mais recente. Vazio no kickoff. */
  history: ConversationTurn[];
  /** `null` apenas no turno de abertura, antes de qualquer mensagem do usuário. */
  userMessage: string | null;
}

export interface ExtractedField {
  questionKey: OnboardingQuestionKey;
  value: string;
}

export interface ProcessOnboardingTurnResult {
  reply: string;
  extractedFields: ExtractedField[];
  knowledgeChip: string | null;
  conversationComplete: boolean;
}

export class OnboardingTurnParseError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
  ) {
    super(message);
    this.name = "OnboardingTurnParseError";
  }
}

const OnboardingTurnResponseSchema = z.object({
  reply: z.string().min(1),
  extracted_fields: z
    .array(
      z.object({
        question_key: z.enum(ONBOARDING_QUESTION_KEYS),
        value: z.string().min(1),
      }),
    )
    .default([]),
  knowledge_chip: z.string().nullable().default(null),
  conversation_complete: z.boolean().default(false),
});

const KICKOFF_MESSAGE =
  "[Este é o início da conversa — ainda não há nada do usuário. Comece com a abertura do primeiro tema, seguindo as regras do system prompt. Não invente nada sobre a empresa que você ainda não sabe.]";

/**
 * Motor da conversa "Conheça sua empresa" (Fluxo 1, PRD §1.1). Ponto único
 * onde o comportamento de consultor (reação, memória, callback) vira uma
 * chamada real ao LLM Provider — nunca acionado sem o Brand Brain como
 * contexto (Princípio do Consultor Permanente, item 7): mesmo no primeiro
 * turno, o prompt já carrega o que a Ayon sabe até agora (`knownFields`).
 */
export async function processOnboardingTurn(
  params: ProcessOnboardingTurnParams,
): Promise<ProcessOnboardingTurnResult> {
  const system = buildOnboardingSystemPrompt({
    brandName: params.brandName,
    knownFields: params.knownFields,
  });

  const messages: LlmMessage[] = params.history.map((turn) => ({
    role: turn.role === "user" ? "user" : "assistant",
    content: turn.text,
  }));

  messages.push({ role: "user", content: params.userMessage ?? KICKOFF_MESSAGE });

  const completion = await params.llmProvider.complete({
    system,
    messages,
    maxTokens: 1024,
  });

  const parsed = parseOnboardingTurnResponse(completion.text);

  return {
    reply: parsed.reply,
    extractedFields: parsed.extracted_fields.map((field) => ({
      questionKey: field.question_key,
      value: field.value,
    })),
    knowledgeChip: parsed.knowledge_chip,
    conversationComplete: parsed.conversation_complete,
  };
}

function parseOnboardingTurnResponse(rawText: string): z.infer<typeof OnboardingTurnResponseSchema> {
  const jsonText = extractJsonBlock(rawText);

  let json: unknown;
  try {
    json = JSON.parse(jsonText);
  } catch (cause) {
    throw new OnboardingTurnParseError("Resposta da Ayon não era um JSON válido.", rawText);
  }

  const result = OnboardingTurnResponseSchema.safeParse(json);
  if (!result.success) {
    throw new OnboardingTurnParseError(
      `Resposta da Ayon não seguiu o formato esperado: ${result.error.message}`,
      rawText,
    );
  }

  return result.data;
}

/** Extrai o bloco JSON da resposta, tolerando cerca ```json ou texto ao redor. */
function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return trimmed;

  return trimmed.slice(firstBrace, lastBrace + 1);
}
