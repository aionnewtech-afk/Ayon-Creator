import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ensureSufficientCredits } from "../billing/credit-gate";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";
import { N8nDispatchError } from "./video-pipeline-trigger";

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
}

export interface TriggerPhotoGenerationResult {
  pipelineRunId: string;
}

/**
 * Dispara o pipeline assíncrono de geração de foto (Fluxo 15, passo 1) —
 * mesmo desenho do Fluxo 13 (vídeo, `video-pipeline-trigger.ts`), reaproveitado
 * para `stories`/`carousel`/`thumbnail`. Cobrança em créditos por rodada
 * (não por candidato) — `related_pipeline_run_id` (idempotente) já garante
 * 1 cobrança por rodada, mesmo padrão do vídeo.
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
    status: "queued",
    actor_user_id: params.actorUserId,
  });

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    const reason = "N8N_WEBHOOK_URL/N8N_WEBHOOK_SECRET não configuradas — provisione o n8n antes de disparar o pipeline.";
    await pipelineRunRepository.update(pipelineRun.id, { status: "failed", error: reason, finished_at: new Date().toISOString() });
    await contentPieceRepository.update(params.contentPieceId, { status: "failed" });
    throw new N8nDispatchError(reason);
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ayon-webhook-secret": webhookSecret },
      body: JSON.stringify({
        kind: "photo",
        contentPieceId: params.contentPieceId,
        campaignId: params.campaignId,
        pipelineRunId: pipelineRun.id,
        organizationId: params.organizationId,
        tier: params.tier,
      }),
    });
    if (!response.ok) throw new Error(`n8n respondeu ${response.status}`);
  } catch (error) {
    await pipelineRunRepository.update(pipelineRun.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finished_at: new Date().toISOString(),
    });
    await contentPieceRepository.update(params.contentPieceId, { status: "failed" });
    throw new N8nDispatchError(error);
  }

  return { pipelineRunId: pipelineRun.id };
}
