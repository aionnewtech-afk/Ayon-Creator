import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ensureSufficientCredits } from "../billing/credit-gate";
import { resolveVoiceProvider } from "../providers/provider-gateway";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { ContentVersionRepository } from "../repositories/content-version.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";
import { sanitizeNarrationText } from "../shared/sanitize-narration-text";
import type { RenderedScenePlan } from "./video-pipeline-complete";
import { completeVideoPipelineSuccess } from "./video-pipeline-complete";
import { renderVideoContentPiece } from "./video-pipeline-render";
import { MissingScriptError } from "./video-pipeline-trigger";

const CONTENT_OUTPUT_BUCKET = "content-output";
const VIDEO_GENERATION_TRIGGER_REASON = "video_generation";

export class MissingScenePlanForVoiceSwapError extends Error {
  constructor() {
    super(
      "Não encontrei as cenas desse vídeo pra recompor com a nova voz (foi gerado antes desse recurso existir) — gere o vídeo de novo do zero pra poder trocar a voz depois.",
    );
    this.name = "MissingScenePlanForVoiceSwapError";
  }
}

export class VoiceSwapNotSupportedError extends Error {
  constructor() {
    super("Trocar a voz só é possível pro vídeo gerado com banco de vídeo licenciado — vídeo de avatar tem a voz junto do rosto, precisa gerar de novo.");
    this.name = "VoiceSwapNotSupportedError";
  }
}

export interface SwapVideoVoiceParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  organizationId: string;
  actorUserId: string;
  campaignId: string;
  contentPieceId: string;
  voiceRef: string;
}

/**
 * ★ Achado real (pedido direto do usuário — "criar uma opção para trocar
 * somente a voz de um vídeo já gerado, sem precisar refazer todo o
 * processo... manter roteiro, cenas, ordem, duração, textos, marca/logo"):
 * o plano de cenas (`pending_scene_plan`) é limpo assim que o render
 * termina — sem ele salvo em algum lugar, "só trocar a voz" exigiria
 * re-selecionar cenas do zero. `completeVideoPipelineSuccess` agora grava
 * esse plano em `content_versions.generation_metadata.scene_plan`
 * (video-pipeline-complete.ts) exatamente pra esta função reaproveitar:
 * re-narra com a voz nova, recompõe (`renderVideoContentPiece`, MESMAS
 * cenas/ordem/duração/branding) e cria uma nova versão — nunca refaz a
 * seleção de cenas nem o roteiro.
 */
export async function swapVideoVoice(params: SwapVideoVoiceParams): Promise<void> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const contentVersionRepository = new ContentVersionRepository(params.db);
  const pipelineRunRepository = new PipelineRunRepository(params.db);

  const piece = await contentPieceRepository.findById(params.contentPieceId);
  if (!piece || piece.format !== "video") throw new VoiceSwapNotSupportedError();
  if (piece.production_mode !== "licensed_stock_video") throw new VoiceSwapNotSupportedError();

  const latestVersion = await contentVersionRepository.findLatestByContentPieceId(params.contentPieceId);
  const metadata = latestVersion?.generation_metadata as { scene_plan?: RenderedScenePlan; media_provider_key?: string } | null;
  const scenePlan = metadata?.scene_plan;
  if (!latestVersion || !scenePlan) throw new MissingScenePlanForVoiceSwapError();

  const primaryPiece = await contentPieceRepository.findPrimaryByCampaignId(params.campaignId);
  if (!primaryPiece?.script) throw new MissingScriptError();

  await ensureSufficientCredits({
    serviceRoleDb: params.serviceRoleDb,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    triggerReason: VIDEO_GENERATION_TRIGGER_REASON,
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
    await pipelineRunRepository.update(pipelineRun.id, { stage: "narrating" });

    const voiceProvider = await resolveVoiceProvider(params.serviceRoleDb, params.tier);
    const synthesized = await voiceProvider.synthesizeVoice({
      script: sanitizeNarrationText(primaryPiece.script),
      voiceRef: params.voiceRef,
    });
    const audioBuffer = Buffer.from(synthesized.audioBase64, "base64");
    const audioStoragePath = `${params.organizationId}/${params.campaignId}/${params.contentPieceId}-narration.mp3`;

    const { error: uploadError } = await params.db.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .upload(audioStoragePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });
    if (uploadError) throw uploadError;

    const { data: signedAudio, error: signError } = await params.db.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .createSignedUrl(audioStoragePath, 60 * 60);
    if (signError || !signedAudio) throw signError ?? new Error("Falha ao gerar link da narração nova.");

    await pipelineRunRepository.update(pipelineRun.id, { stage: "rendering" });

    const renderResult = await renderVideoContentPiece({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      contentPieceId: params.contentPieceId,
      audioUrl: signedAudio.signedUrl,
      videoSources: scenePlan.videoSources,
      includeLogo: scenePlan.includeLogo,
      watermarkText: scenePlan.watermarkText,
    });

    await completeVideoPipelineSuccess({
      serviceRoleDb: params.serviceRoleDb,
      organizationId: params.organizationId,
      contentPieceId: params.contentPieceId,
      pipelineRunId: pipelineRun.id,
      tier: params.tier,
      videoStoragePath: renderResult.videoStoragePath,
      voiceProviderKey: synthesized.providerKey,
      mediaProviderKey: metadata?.media_provider_key ?? "unknown",
      videoRenderProviderKey: renderResult.videoRenderProviderKey,
      scenePlan,
    });
  } catch (error) {
    // ★ Diferente de uma geração do zero (`completeVideoPipelineFailure`,
    // que marca a peça "failed"): aqui já existe uma versão boa renderizada
    // antes dessa troca de voz — falhar não pode esconder/derrubar ela.
    // Volta pra `ready_for_review` (o vídeo anterior continua acessível),
    // só o `pipeline_run` registra o motivo real da falha.
    await contentPieceRepository.update(params.contentPieceId, { status: "ready_for_review" });
    await pipelineRunRepository.update(pipelineRun.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}
