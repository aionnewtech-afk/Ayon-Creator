import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ensureSufficientCredits } from "../billing/credit-gate";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";

const VIDEO_GENERATION_TRIGGER_REASON = "video_generation";

export class N8nDispatchError extends Error {
  constructor(cause: unknown) {
    super(`Falha ao disparar o workflow do n8n: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "N8nDispatchError";
  }
}

export interface TriggerVideoGenerationParams {
  /** Client de sessão (RLS) — grava content_pieces/pipeline_runs. */
  db: SupabaseClient<Database>;
  /** Client de service role — checa o portão de crédito. */
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  campaignId: string;
  tier: ProviderTier;
  contentPieceId: string;
  /** Termo de busca para a etapa de cenas (Fluxo 13, passo 3) — repassado ao n8n, que o encaminha para `/api/pipeline/video/scenes`. */
  searchQuery: string;
}

export interface TriggerVideoGenerationResult {
  pipelineRunId: string;
}

/**
 * Dispara o pipeline assíncrono de geração de vídeo (Fluxo 13, passo 1) —
 * checa o portão de crédito, marca a peça como `generating`, cria a linha de
 * `pipeline_runs` (`queued`) e aciona o n8n via webhook autenticado.
 * Cobrança real só acontece no webhook de conclusão
 * (`completeVideoPipelineSuccess`), nunca aqui — mesmo princípio de sempre
 * (Fluxo 6): nunca cobrar antes do trabalho estar de fato feito.
 */
export async function triggerVideoGeneration(
  params: TriggerVideoGenerationParams,
): Promise<TriggerVideoGenerationResult> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const pipelineRunRepository = new PipelineRunRepository(params.db);

  await ensureSufficientCredits({
    serviceRoleDb: params.serviceRoleDb,
    organizationId: params.organizationId,
    triggerReason: VIDEO_GENERATION_TRIGGER_REASON,
    tier: params.tier,
  });

  await contentPieceRepository.update(params.contentPieceId, { status: "generating" });

  const pipelineRun = await pipelineRunRepository.create({
    entity_type: "content_piece",
    entity_id: params.contentPieceId,
    engine: "asset_engine",
    status: "queued",
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
        contentPieceId: params.contentPieceId,
        campaignId: params.campaignId,
        pipelineRunId: pipelineRun.id,
        organizationId: params.organizationId,
        tier: params.tier,
        searchQuery: params.searchQuery,
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
