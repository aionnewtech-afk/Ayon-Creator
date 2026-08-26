import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveLlmProvider, resolveVoiceProvider } from "../providers/provider-gateway";
import { BrandBrainRepository } from "../repositories/brand-brain.repository";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { sanitizeNarrationText } from "../shared/sanitize-narration-text";
import { selectBrandVoice } from "./select-brand-voice";

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
  voiceProviderKey: string;
}

/**
 * Etapa 1 do pipeline de vídeo (Fluxo 13, passo 3) — narração via Voice
 * Provider (ElevenLabs). Lê o roteiro da peça **primária** da campanha
 * (`is_primary`, formato `script`) — achado real, sprint de estabilização:
 * `content_pieces.script` da própria peça de vídeo nunca é populado por
 * nenhum fluxo (o loop de geração de texto pula qualquer formato fora de
 * `TEXT_ONLY_CONTENT_PIECE_FORMATS`, e `video` não está nessa lista desde a
 * Missão 9) — chamar `narrateVideoContentPiece` sempre falhava com "sem
 * roteiro", mesmo depois de o usuário editar manualmente (a edição ia para
 * a peça errada). A peça primária é a única fonte de verdade do roteiro em
 * toda a campanha agora (`ContentPieceRepository.findPrimaryByCampaignId`).
 * Grava o áudio no bucket `content-output` e devolve uma signed URL, porque
 * o bucket é privado e o Video Render Provider precisa buscar o arquivo por
 * URL (architecture.md §3.5.1).
 *
 * ★ Missão 11 (arch. §14.3) — a voz não é mais sempre a padrão do
 * fornecedor: `brand_brain_profiles.default_voice_ref` é lido e repassado
 * como `voiceRef`; quando ainda não existe (1ª geração da marca), o Asset
 * Engine escolhe uma voz do catálogo curado via LLM Provider e persiste a
 * escolha para as gerações seguintes reaproveitarem — nunca chama o LLM de
 * novo depois disso, a não ser que o usuário sobrescreva manualmente.
 */
export async function narrateVideoContentPiece(
  params: NarrateVideoContentPieceParams,
): Promise<NarrateVideoContentPieceResult> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const primaryPiece = await contentPieceRepository.findPrimaryByCampaignId(params.campaignId);
  if (!primaryPiece?.script) {
    throw new Error(
      `Campanha ${params.campaignId} não tem roteiro gerado ainda (peça primária sem script) — não é possível narrar o vídeo.`,
    );
  }

  const voiceRef = await resolveVoiceRef(params);

  const voiceProvider = await resolveVoiceProvider(params.serviceRoleDb, params.tier);
  // ★ Achado real: o roteiro chegava a incluir direções de cena entre
  // parênteses (ex.: "(Cenário: ambiente aconchegante...)"), narradas em voz
  // alta literalmente — ver sanitize-narration-text.ts.
  const result = await voiceProvider.synthesizeVoice({ script: sanitizeNarrationText(primaryPiece.script), voiceRef });

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
    voiceProviderKey: result.providerKey,
  };
}

/**
 * `default_voice_ref` sempre vence quando já definido — seja porque o
 * usuário sobrescreveu manualmente (ux-design.md §4.12), seja porque uma
 * geração anterior da marca já escolheu e persistiu. Só cai na seleção
 * automática (LLM Provider + catálogo curado) na 1ª geração de vídeo/foto
 * da marca.
 */
async function resolveVoiceRef(params: NarrateVideoContentPieceParams): Promise<string> {
  const campaignRepository = new CampaignRepository(params.db);
  const campaign = await campaignRepository.findById(params.campaignId);
  if (!campaign) return DEFAULT_VOICE_FALLBACK;

  const brandBrainRepository = new BrandBrainRepository(params.db);
  const brandBrain = await brandBrainRepository.findByBrandId(campaign.brand_id);
  if (brandBrain?.default_voice_ref) return brandBrain.default_voice_ref;

  const brandRepository = new BrandRepository(params.db);
  const brand = await brandRepository.findById(campaign.brand_id);

  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
  const selectedVoiceId = await selectBrandVoice({
    llmProvider,
    niche: brand?.niche ?? null,
    toneOfVoice: brandBrain?.tone_of_voice ?? null,
    targetAudience: brandBrain?.target_audience ?? null,
    visualStyle: brand?.visual_style ?? null,
  });

  await brandBrainRepository.upsertByBrandId(campaign.brand_id, { default_voice_ref: selectedVoiceId });

  return selectedVoiceId;
}

const DEFAULT_VOICE_FALLBACK = "21m00Tcm4TlvDq8ikWAM";
