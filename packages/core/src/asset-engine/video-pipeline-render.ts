import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveVideoRenderProvider } from "../providers/provider-gateway";
import type { VideoRenderSceneSource } from "../providers/video-render-provider";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { resolveBrandBranding } from "./resolve-brand-branding";

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
  /** ★ Achado real (pedido direto do usuário — "deixar opcional que o vídeo tenha a logo ou não"): `false` pula a logo mesmo cadastrada — escolha por geração, nunca um padrão novo da marca. Ausente mantém o comportamento de sempre (logo sempre que cadastrada). */
  includeLogo?: boolean;
  /** ★ Achado real (pedido direto do usuário — "marca d'água com o insta ou nome da empresa... sutil e em algum dos cantos"): texto opcional sobreposto no vídeo inteiro — ausente não adiciona nada. */
  watermarkText?: string;
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
 *
 * ★ Missão 11 (arch. §14.1/§14.6) — resolve a identidade visual da marca
 * internamente (nunca recebida de fora, ex. do n8n) e repassa como
 * `branding` ao provider — mantém o princípio de que só o Asset Engine
 * conhece `brands`, nunca o Video Render Provider nem o orquestrador.
 */
export async function renderVideoContentPiece(
  params: RenderVideoContentPieceParams,
): Promise<RenderVideoContentPieceResult> {
  const campaign = await new CampaignRepository(params.db).findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;
  const branding = await resolveBrandBranding(params.db, brand);

  const renderProvider = await resolveVideoRenderProvider(params.serviceRoleDb, params.tier);

  const result = await renderProvider.composeVideo({
    audioUrl: params.audioUrl,
    videoSources: params.videoSources,
    aspectRatio: "9:16",
    branding: { ...branding, includeLogo: params.includeLogo, watermarkText: params.watermarkText },
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
