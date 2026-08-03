import type { KnowledgeBaseSourceType } from "@ayon/types";

/** Rótulo em linguagem de negócio para cada `source_type` — nunca jargão técnico na UI (PRD §2). */
export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeBaseSourceType, string> = {
  document: "Documento",
  past_content: "Conteúdo antigo",
  faq: "Pergunta frequente",
  performance_note: "Nota de performance",
  manual_note: "Nota",
  onboarding_conversation: "Conversa com a Ayon",
};

/** `source_type`s que o usuário pode escolher ao adicionar conhecimento em KB-2 — `onboarding_conversation` é gerado só pela conversa, nunca por upload manual. */
export const SELECTABLE_KNOWLEDGE_SOURCE_TYPES = [
  "document",
  "past_content",
  "faq",
  "performance_note",
  "manual_note",
] as const satisfies readonly KnowledgeBaseSourceType[];
