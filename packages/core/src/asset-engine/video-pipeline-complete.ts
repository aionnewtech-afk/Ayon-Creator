import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { recordConsumption } from "../billing/credit-gate";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { ContentVersionRepository } from "../repositories/content-version.repository";
import { CreditPricingRepository } from "../repositories/credit-pricing.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";

const VIDEO_GENERATION_TRIGGER_REASON = "video_generation";

export interface CompleteVideoPipelineSuccessParams {
  /** Client de service role — webhook do n8n não tem sessão de usuário. */
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  contentPieceId: string;
  pipelineRunId: string;
  tier: ProviderTier;
  videoStoragePath: string;
  voiceProviderKey: string;
  mediaProviderKey: string;
  videoRenderProviderKey: string;
}

/**
 * Finaliza o pipeline com sucesso (Fluxo 13, passos 5-6) — chamado pelo
 * webhook de conclusão do n8n, nunca pela Server Action que disparou o
 * pipeline (a operação não termina dentro dela). Cobrança em créditos só
 * acontece aqui, depois do sucesso — mesmo princípio de sempre (Fluxo 6).
 */
export async function completeVideoPipelineSuccess(params: CompleteVideoPipelineSuccessParams): Promise<void> {
  const contentPieceRepository = new ContentPieceRepository(params.serviceRoleDb);
  const contentVersionRepository = new ContentVersionRepository(params.serviceRoleDb);
  const pipelineRunRepository = new PipelineRunRepository(params.serviceRoleDb);
  const creditPricingRepository = new CreditPricingRepository(params.serviceRoleDb);

  const pricing = await creditPricingRepository.findActive(VIDEO_GENERATION_TRIGGER_REASON, params.tier);
  if (!pricing) {
    throw new Error(`Nenhum credit_pricing ativo para (trigger_reason=video_generation, tier=${params.tier}).`);
  }

  const latest = await contentVersionRepository.findLatestByContentPieceId(params.contentPieceId);

  await contentVersionRepository.create({
    content_piece_id: params.contentPieceId,
    version_number: (latest?.version_number ?? 0) + 1,
    output_storage_path: params.videoStoragePath,
    generation_metadata: {
      voice_provider_key: params.voiceProviderKey,
      media_provider_key: params.mediaProviderKey,
      video_render_provider_key: params.videoRenderProviderKey,
      tier: params.tier,
    },
  });

  await contentPieceRepository.update(params.contentPieceId, { status: "ready_for_review" });

  await pipelineRunRepository.update(params.pipelineRunId, { status: "completed", finished_at: new Date().toISOString() });

  await recordConsumption({
    serviceRoleDb: params.serviceRoleDb,
    organizationId: params.organizationId,
    costCredits: pricing.credits,
    pipelineRunId: params.pipelineRunId,
    description: "Geração automática de vídeo (licensed_stock_video)",
  });
}

export interface CompleteVideoPipelineFailureParams {
  serviceRoleDb: SupabaseClient<Database>;
  contentPieceId: string;
  pipelineRunId: string;
  errorMessage: string;
}

/** Finaliza o pipeline com falha (Fluxo 13, passo 5) — nunca gera cobrança. */
export async function completeVideoPipelineFailure(params: CompleteVideoPipelineFailureParams): Promise<void> {
  const contentPieceRepository = new ContentPieceRepository(params.serviceRoleDb);
  const pipelineRunRepository = new PipelineRunRepository(params.serviceRoleDb);

  await contentPieceRepository.update(params.contentPieceId, { status: "failed" });
  await pipelineRunRepository.update(params.pipelineRunId, {
    status: "failed",
    error: params.errorMessage,
    finished_at: new Date().toISOString(),
  });
}
