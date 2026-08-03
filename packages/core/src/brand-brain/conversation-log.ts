import type { Database } from "@ayon/types";
import type { ConversationTurn } from "./process-onboarding-turn";

type KnowledgeBaseItemRow = Database["public"]["Tables"]["knowledge_base_items"]["Row"];

interface ConversationLogPayload {
  user: string;
  ayon: string;
}

/**
 * A transcrição bruta da conversa "Conheça sua empresa" vive em
 * `knowledge_base_items` (source_type = onboarding_conversation) — arquitetura
 * §3.2/§6 — um item por turno, para não criar uma tabela nova só para
 * reconstrução de UI. Estas funções são o único lugar que conhece o formato
 * de `content_text`.
 */
export function encodeConversationTurnLog(userMessage: string, ayonReply: string): string {
  const payload: ConversationLogPayload = { user: userMessage, ayon: ayonReply };
  return JSON.stringify(payload);
}

export function decodeConversationLog(items: KnowledgeBaseItemRow[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (const item of items) {
    if (item.source_type !== "onboarding_conversation" || !item.content_text) continue;

    try {
      const payload = JSON.parse(item.content_text) as Partial<ConversationLogPayload>;
      if (typeof payload.user === "string") turns.push({ role: "user", text: payload.user });
      if (typeof payload.ayon === "string") turns.push({ role: "ayon", text: payload.ayon });
    } catch {
      // Item pré-existente em formato inesperado — ignora na reconstrução da
      // UI, mas não quebra a conversa (retrieval futuro do Knowledge Base
      // continua funcionando independentemente deste parsing).
    }
  }

  return turns;
}
