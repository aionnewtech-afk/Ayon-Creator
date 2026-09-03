import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ensureSufficientCredits } from "../billing/credit-gate";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";
import { composePhotoContentPiece } from "./photo-pipeline-compose";
import { completePhotoPipelineSuccess } from "./photo-pipeline-complete";
import { selectPhotoCandidates } from "./photo-pipeline-select";

const IMAGE_GENERATION_TRIGGER_REASON = "image_generation";

export interface TriggerPhotoGenerationParams {
  /** Client de sessão (RLS) — grava content_pieces/pipeline_runs. */
  db: SupabaseClient<Database>;
  /** Client de service role — checa o portão de crédito. */
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  /** ★ Missão 12 — ator autenticado disparando a geração; gravado em `pipeline_runs.actor_user_id` (architecture.md §15.5). */
  actorUserId: string;
  campaignId: string;
  tier: ProviderTier;
  contentPieceId: string;
  /** Nicho/tema informado pelo usuário ao regenerar (ex.: "praia", "shows") — repassado direto pra `selectPhotoCandidates`. */
  nicheOverride?: string | null;
}

export interface TriggerPhotoGenerationResult {
  pipelineRunId: string;
}

/**
 * Dispara o pipeline de geração de foto (Fluxo 15) para `stories`/`carousel`/
 * `thumbnail`. Cobrança em créditos por rodada (não por candidato).
 *
 * ★ Achado real (produção — "carrossel e storie não geram quando clico,
 * nada acontece"): até aqui, esta função só disparava um webhook pro n8n
 * (`N8N_WEBHOOK_URL`/`N8N_WEBHOOK_SECRET`) e esperava ele chamar de volta as
 * rotas internas `/api/pipeline/photo/{select,compose}` — só que o n8n nunca
 * foi provisionado (variáveis vazias, tanto local quanto em produção), então
 * TODA geração de foto falhava silenciosamente na primeira etapa. O vídeo já
 * tinha passado por essa mesma migração antes (ver comentário em
 * `video-pipeline-plan.ts`, "o pipeline de vídeo até aqui era 100%
 * orquestrado pelo n8n") — mesmo tratamento aqui: roda
 * `selectPhotoCandidates`→`composePhotoContentPiece`→`completePhotoPipelineSuccess`
 * diretamente, síncrono, sem n8n. As rotas `/api/pipeline/photo/*` continuam
 * existindo (não fazem mal, só deixam de ser chamadas por ninguém).
 */
export async function triggerPhotoGeneration(
  params: TriggerPhotoGenerationParams,
): Promise<TriggerPhotoGenerationResult> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const pipelineRunRepository = new PipelineRunRepository(params.db);

  await ensureSufficientCredits({
    serviceRoleDb: params.serviceRoleDb,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    triggerReason: IMAGE_GENERATION_TRIGGER_REASON,
    tier: params.tier,
  });

  await contentPieceRepository.update(params.contentPieceId, { status: "generating" });

  const pipelineRun = await pipelineRunRepository.create({
    entity_type: "content_piece",
    entity_id: params.contentPieceId,
    engine: "asset_engine",
    status: "running",
    actor_user_id: params.actorUserId,
  });

  try {
    await pipelineRunRepository.update(pipelineRun.id, { stage: "selecting_photos" });
    const selectResult = await selectPhotoCandidates({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      campaignId: params.campaignId,
      contentPieceId: params.contentPieceId,
      nicheOverride: params.nicheOverride ?? null,
    });

    await pipelineRunRepository.update(pipelineRun.id, { stage: "rendering" });
    const options = await composePhotoContentPiece({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      contentPieceId: params.contentPieceId,
      format: selectResult.format,
      candidates: selectResult.candidates,
    });

    await completePhotoPipelineSuccess({
      serviceRoleDb: params.serviceRoleDb,
      organizationId: params.organizationId,
      contentPieceId: params.contentPieceId,
      pipelineRunId: pipelineRun.id,
      tier: params.tier,
      options,
    });

    return { pipelineRunId: pipelineRun.id };
  } catch (error) {
    await pipelineRunRepository.update(pipelineRun.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finished_at: new Date().toISOString(),
    });
    await contentPieceRepository.update(params.contentPieceId, { status: "failed" });
    throw error;
  }
}
