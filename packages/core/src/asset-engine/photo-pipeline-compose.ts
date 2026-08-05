import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveLlmProvider, resolveVideoRenderProvider } from "../providers/provider-gateway";
import type { MediaCandidate } from "../providers/media-provider";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { resolveBrandBranding } from "./resolve-brand-branding";
import { resolveVisualBrief } from "./resolve-visual-brief";
import { PHOTO_DIMENSIONS } from "./photo-pipeline-select";

const CONTENT_OUTPUT_BUCKET = "content-output";

export interface ComposePhotoContentPieceParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  organizationId: string;
  campaignId: string;
  contentPieceId: string;
  format: string;
  candidates: MediaCandidate[];
}

export interface ComposedPhotoOption {
  storagePath: string;
  mediaProviderKey: string;
  videoRenderProviderKey: string;
}

/**
 * Etapa 2 do pipeline de foto (Fluxo 15, arch. §14.4.1) — composição real
 * (não uma foto crua): cada candidato vira uma opção completa (foto +
 * branding + título + tipografia), via o mesmo Video Render Provider do
 * vídeo (`composeImage`, timeline em camadas). Identidade visual (arch.
 * §14.1) e título curto (`visual_brief`, arch. §14.4.3) resolvidos uma vez,
 * reaproveitados em todos os candidatos da rodada.
 */
export async function composePhotoContentPiece(
  params: ComposePhotoContentPieceParams,
): Promise<ComposedPhotoOption[]> {
  const campaign = await new CampaignRepository(params.db).findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;
  const branding = await resolveBrandBranding(params.db, brand);

  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
  const visualBrief = await resolveVisualBrief(params.db, params.campaignId, llmProvider);

  const renderProvider = await resolveVideoRenderProvider(params.serviceRoleDb, params.tier);
  const dimensions = PHOTO_DIMENSIONS[params.format] ?? PHOTO_DIMENSIONS.thumbnail!;

  const options: ComposedPhotoOption[] = [];

  for (let index = 0; index < params.candidates.length; index++) {
    const candidate = params.candidates[index]!;

    const result = await renderProvider.composeImage({
      backgroundImageUrl: candidate.downloadUrl,
      title: visualBrief.shortTitle || null,
      branding,
      width: dimensions.width,
      height: dimensions.height,
    });

    const imageResponse = await fetch(result.imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar a imagem composta do Video Render Provider (${imageResponse.status}).`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const storagePath = `${params.organizationId}/${params.campaignId}/${params.contentPieceId}-option-${index + 1}.jpg`;
    const { error: uploadError } = await params.db.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .upload(storagePath, imageBuffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;

    options.push({ storagePath, mediaProviderKey: candidate.providerKey, videoRenderProviderKey: result.providerKey });
  }

  return options;
}
