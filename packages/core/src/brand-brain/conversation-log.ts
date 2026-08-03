import type { Database } from "@ayon/types";
import type { ConversationTurn } from "./process-onboarding-turn";

type KnowledgeBaseItemRow = Database["public"]["Tables"]["knowledge_base_items"]["Row"];

interface ConversationLogPayload {
  /** Ausente no turno de abertura (kickoff) — não há mensagem do usuário ainda. */
  user?: string;
  ayon: string;
}

/**
 * A transcrição bruta da conversa "Conheça sua empresa" vive em
 * `knowledge_base_items` (source_type = onboarding_conversation) — arquitetura
 * §3.2/§6 — um item por turno, para não criar uma tabela nova só para
 * reconstrução de UI. Estas funções são o único lugar que conhece o formato
 * de `content_text`.
 *
 * Importante (bug encontrado em teste E2E real): o turno de abertura (kickoff,
 * `userMessage === null`) precisa ser persistido igual a qualquer outro —
 * caso contrário, ao recarregar a página antes da primeira resposta do
 * usuário, o histórico reconstruído fica vazio e a conversa reinicia do
 * zero (gerando um novo kickoff a cada reload, cada um potencialmente
 * diferente). `encodeConversationTurnLog` por isso aceita `userMessage: null`.
 */
export function encodeConversationTurnLog(userMessage: string | null, ayonReply: string): string {
  const payload: ConversationLogPayload =
    userMessage === null ? { ayon: ayonReply } : { user: userMessage, ayon: ayonReply };
  return JSON.stringify(payload);
}

export function decodeConversationLog(items: KnowledgeBaseItemRow[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (const item of items) {
    if (item.source_type !== "onboarding_conversation" || !item.content_text) continue;

    try {
      const payload = JSON.parse(item.content_text) as Partial<ConversationLogPayload>;
      if (typeof payload.user === "string" && payload.user.length > 0) {
        turns.push({ role: "user", text: payload.user });
      }
      if (typeof payload.ayon === "string") turns.push({ role: "ayon", text: payload.ayon });
    } catch {
      // Item pré-existente em formato inesperado — ignora na reconstrução da
      // UI, mas não quebra a conversa (retrieval futuro do Knowledge Base
      // continua funcionando independentemente deste parsing).
    }
  }

  return turns;
}
