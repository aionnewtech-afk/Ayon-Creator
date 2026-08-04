import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveVideoRenderProvider } from "../providers/provider-gateway";
import type { VideoRenderCaptionCue, VideoRenderSceneSource } from "../providers/video-render-provider";

const CONTENT_OUTPUT_BUCKET = "content-output";

export interface RenderVideoContentPieceParams {
  /** Client de sessão (RLS) ou service role (rota interna acionada pelo n8n, sem sessão de usuário) — grava no Storage. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve `provider_configs`. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  organizationId: string;
  campaignId: string;
  contentPieceId: string;
  audioUrl: string;
  videoSources: VideoRenderSceneSource[];
  captionCues: VideoRenderCaptionCue[];
}

export interface RenderVideoContentPieceResult {
  videoStoragePath: string;
  videoRenderProviderKey: string;
}

/**
 * Etapa final do pipeline de vídeo (Fluxo 13, passos 3-4) — composição via
 * Video Render Provider (Shotstack). Baixa o MP4 final do fornecedor e
 * regrava no bucket `content-output` — o pacote de conteúdo nunca depende
 * de uma URL temporária de terceiro (mesmo princípio de `own_media`,
 * Missão 7: tudo que entra no pacote vive no nosso Storage).
 */
export async function renderVideoContentPiece(
  params: RenderVideoContentPieceParams,
): Promise<RenderVideoContentPieceResult> {
  const renderProvider = await resolveVideoRenderProvider(params.serviceRoleDb, params.tier);

  const result = await renderProvider.composeVideo({
    audioUrl: params.audioUrl,
    videoSources: params.videoSources,
    captionCues: params.captionCues,
    aspectRatio: "9:16",
  });

  const videoResponse = await fetch(result.videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Falha ao baixar o vídeo final do Video Render Provider (${videoResponse.status}).`);
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  const storagePath = `${params.organizationId}/${params.campaignId}/${params.contentPieceId}-video.mp4`;
  const { error: uploadError } = await params.db.storage
    .from(CONTENT_OUTPUT_BUCKET)
    .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });
  if (uploadError) throw uploadError;

  return { videoStoragePath: storagePath, videoRenderProviderKey: result.providerKey };
}
