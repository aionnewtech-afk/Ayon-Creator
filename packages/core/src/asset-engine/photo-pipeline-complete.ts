import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { recordConsumption } from "../billing/credit-gate";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { ContentVersionRepository } from "../repositories/content-version.repository";
import { CreditPricingRepository } from "../repositories/credit-pricing.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";
import type { ComposedPhotoOption } from "./photo-pipeline-compose";

const IMAGE_GENERATION_TRIGGER_REASON = "image_generation";

export interface CompletePhotoPipelineSuccessParams {
  /** Client de service role — webhook do n8n não tem sessão de usuário. */
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  contentPieceId: string;
  pipelineRunId: string;
  tier: ProviderTier;
  options: ComposedPhotoOption[];
}

/**
 * Finaliza o pipeline de foto com sucesso (Fluxo 15, arch. §14.4.2) — 1
 * `content_versions` por candidato/opção gerado na rodada (múltiplas
 * opções, nunca uma única versão forçada). `content_pieces.selected_version_id`
 * fica `null` até o usuário escolher — enquanto isso, a versão mais recente
 * (a última opção criada) seguiria sendo a "ativa" pela regra padrão, mas a
 * UI (ux-design.md §4.6) sempre mostra a grade de opções quando há mais de
 * uma, nunca decide sozinha. Cobrança em créditos 1x por rodada (não por
 * candidato) — `related_pipeline_run_id` (idempotente) garante isso mesmo
 * numa reentrega do webhook.
 */
export async function completePhotoPipelineSuccess(params: CompletePhotoPipelineSuccessParams): Promise<void> {
  const contentPieceRepository = new ContentPieceRepository(params.serviceRoleDb);
  const contentVersionRepository = new ContentVersionRepository(params.serviceRoleDb);
  const pipelineRunRepository = new PipelineRunRepository(params.serviceRoleDb);
  const creditPricingRepository = new CreditPricingRepository(params.serviceRoleDb);

  const pricing = await creditPricingRepository.findActive(IMAGE_GENERATION_TRIGGER_REASON, params.tier);
  if (!pricing) {
    throw new Error(`Nenhum credit_pricing ativo para (trigger_reason=image_generation, tier=${params.tier}).`);
  }

  let latest = await contentVersionRepository.findLatestByContentPieceId(params.contentPieceId);

  for (const option of params.options) {
    latest = await contentVersionRepository.create({
      content_piece_id: params.contentPieceId,
      version_number: (latest?.version_number ?? 0) + 1,
      output_storage_path: option.storagePath,
      generation_metadata: {
        media_provider_key: option.mediaProviderKey,
        video_render_provider_key: option.videoRenderProviderKey,
        tier: params.tier,
      },
    });
  }

  await contentPieceRepository.update(params.contentPieceId, { status: "ready_for_review" });

  const pipelineRun = await pipelineRunRepository.update(params.pipelineRunId, {
    status: "completed",
    finished_at: new Date().toISOString(),
  });

  await recordConsumption({
    serviceRoleDb: params.serviceRoleDb,
    organizationId: params.organizationId,
    // ★ Missão 12 — ver mesmo comentário em video-pipeline-complete.ts.
    actorUserId: pipelineRun.actor_user_id ?? "",
    costCredits: pricing.credits,
    pipelineRunId: params.pipelineRunId,
    description: `Geração automática de imagem (licensed_stock_photo, ${params.options.length} opção(ões))`,
  });
}
