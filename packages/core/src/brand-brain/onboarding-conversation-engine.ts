import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { BrandBrainRepository } from "../repositories/brand-brain.repository";
import { BrandOnboardingAnswerRepository } from "../repositories/brand-onboarding-answer.repository";
import { KnowledgeBaseItemRepository } from "../repositories/knowledge-base-item.repository";
import type { LlmProvider } from "../providers/llm-provider";
import { processOnboardingTurn } from "./process-onboarding-turn";
import { knownFieldsFromProfile } from "./onboarding-themes";
import { applyExtractedFieldsToProfilePatch } from "./apply-extracted-fields";
import { buildOnboardingSynthesis, type SynthesisFieldEntry } from "./build-onboarding-synthesis";
import { decodeConversationLog, encodeConversationTurnLog } from "./conversation-log";

export interface RunOnboardingTurnParams {
  /** Client de sessão (RLS aplicada) — nunca o service role aqui. */
  db: SupabaseClient<Database>;
  llmProvider: LlmProvider;
  brandId: string;
  brandName: string;
  actorUserId: string;
  /** `null` apenas para o turno de abertura (kickoff), antes de qualquer mensagem do usuário. */
  userMessage: string | null;
}

export interface RunOnboardingTurnResult {
  reply: string;
  knowledgeChip: string | null;
  conversationComplete: boolean;
  /** Presente somente quando esta chamada acabou de concluir a conversa. */
  synthesis?: SynthesisFieldEntry[];
}

/**
 * Orquestra um turno completo da conversa "Conheça sua empresa" (Fluxo 1):
 * carrega o estado atual (Brand Brain + histórico), chama o motor de
 * conversa, persiste o que foi extraído e, se for o turno final, monta a
 * síntese de ONB-3. Ponto único chamado pelo Server Action — nenhuma lógica
 * de negócio deste fluxo vive em `apps/web`.
 */
export async function runOnboardingTurn(params: RunOnboardingTurnParams): Promise<RunOnboardingTurnResult> {
  const brandBrainRepository = new BrandBrainRepository(params.db);
  const answersRepository = new BrandOnboardingAnswerRepository(params.db);
  const knowledgeBaseRepository = new KnowledgeBaseItemRepository(params.db);

  const [currentProfile, knowledgeBaseItems] = await Promise.all([
    brandBrainRepository.findByBrandId(params.brandId),
    knowledgeBaseRepository.findByBrandId(params.brandId),
  ]);

  const conversationItems = knowledgeBaseItems.filter((item) => item.source_type === "onboarding_conversation");
  const history = decodeConversationLog(conversationItems);
  const knownFields = knownFieldsFromProfile(currentProfile);

  const turn = await processOnboardingTurn({
    llmProvider: params.llmProvider,
    brandName: params.brandName,
    knownFields,
    history,
    userMessage: params.userMessage,
  });

  // Persiste histórico bruto (um registro por campo estruturado — architecture.md §6).
  if (turn.extractedFields.length > 0) {
    await answersRepository.createMany(
      turn.extractedFields.map((field) => ({
        brand_id: params.brandId,
        question_key: field.questionKey,
        answer_text: params.userMessage ?? "",
      })),
    );
  }

  // Atualiza o estado sintetizado do Brand Brain.
  let updatedProfile = currentProfile;
  const profilePatch = applyExtractedFieldsToProfilePatch(turn.extractedFields, currentProfile);
  if (Object.keys(profilePatch).length > 0 || !currentProfile) {
    updatedProfile = await brandBrainRepository.upsertByBrandId(params.brandId, {
      ...profilePatch,
      created_by: params.actorUserId,
    });
  }

  // Transcrição bruta do turno (para reconstrução da UI e retrieval futuro) —
  // inclusive o turno de abertura (kickoff), para que a retomada nunca perca
  // a primeira mensagem da Ayon (bug encontrado em teste E2E real).
  await knowledgeBaseRepository.create({
    brand_id: params.brandId,
    source_type: "onboarding_conversation",
    title: "Conversa — Conheça sua empresa",
    content_text: encodeConversationTurnLog(params.userMessage, turn.reply),
    created_by: params.actorUserId,
  });

  if (!turn.conversationComplete) {
    return { reply: turn.reply, knowledgeChip: turn.knowledgeChip, conversationComplete: false };
  }

  // Turno final: monta a síntese de ONB-3 e marca a conversa como concluída
  // (aguardando confirmação explícita do usuário — nunca automática).
  const allAnswers = await answersRepository.findByBrandId(params.brandId);
  const finalProfile =
    updatedProfile ?? (await brandBrainRepository.findByBrandId(params.brandId)) ?? undefined;

  if (!finalProfile) {
    throw new Error("Conversa concluída sem nenhum Brand Brain profile — estado inesperado.");
  }

  const synthesis = buildOnboardingSynthesis(finalProfile, allAnswers);

  await brandBrainRepository.upsertByBrandId(params.brandId, {
    onboarding_completed_at: new Date().toISOString(),
    onboarding_synthesis: synthesis,
    created_by: params.actorUserId,
  });

  return {
    reply: turn.reply,
    knowledgeChip: turn.knowledgeChip,
    conversationComplete: true,
    synthesis,
  };
}
