import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveVoiceProvider } from "../providers/provider-gateway";
import type { CaptionCue } from "../providers/voice-provider";
import { ContentPieceRepository } from "../repositories/content-piece.repository";

const CONTENT_OUTPUT_BUCKET = "content-output";
/** Tempo suficiente para as etapas seguintes (cenas + composição) ainda buscarem o áudio pela URL. */
const AUDIO_SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface NarrateVideoContentPieceParams {
  /** Client de sessão (RLS) ou service role (rota interna acionada pelo n8n, sem sessão de usuário) — grava no Storage. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve `provider_configs`. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  organizationId: string;
  campaignId: string;
  contentPieceId: string;
}

export interface NarrateVideoContentPieceResult {
  audioUrl: string;
  durationMs: number;
  captionCues: CaptionCue[];
  voiceProviderKey: string;
}

/**
 * Etapa 1 do pipeline de vídeo (Fluxo 13, passo 3) — narração via Voice
 * Provider (ElevenLabs). Lê `content_pieces.script`, já existente e herdado
 * do Intelligence Hub (Fluxo 3.1) — nenhuma geração de texto nova aqui. Grava
 * o áudio no bucket `content-output` e devolve uma signed URL, porque o
 * bucket é privado e o Video Render Provider precisa buscar o arquivo por
 * URL (architecture.md §3.5.1).
 */
export async function narrateVideoContentPiece(
  params: NarrateVideoContentPieceParams,
): Promise<NarrateVideoContentPieceResult> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const piece = await contentPieceRepository.findById(params.contentPieceId);
  if (!piece?.script) {
    throw new Error(`content_piece ${params.contentPieceId} não tem script para narrar.`);
  }

  const voiceProvider = await resolveVoiceProvider(params.serviceRoleDb, params.tier);
  const result = await voiceProvider.synthesizeVoice({ script: piece.script });

  const audioBuffer = Buffer.from(result.audioBase64, "base64");
  const storagePath = `${params.organizationId}/${params.campaignId}/${params.contentPieceId}-narration.mp3`;

  const { error: uploadError } = await params.db.storage
    .from(CONTENT_OUTPUT_BUCKET)
    .upload(storagePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });
  if (uploadError) throw uploadError;

  const { data: signed, error: signError } = await params.db.storage
    .from(CONTENT_OUTPUT_BUCKET)
    .createSignedUrl(storagePath, AUDIO_SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) throw signError ?? new Error("Falha ao assinar URL do áudio de narração.");

  return {
    audioUrl: signed.signedUrl,
    durationMs: result.durationMs,
    captionCues: result.captionCues,
    voiceProviderKey: result.providerKey,
  };
}
