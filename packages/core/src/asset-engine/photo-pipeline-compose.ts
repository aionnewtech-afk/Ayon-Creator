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
  /**
   * ★ Achado real (pedido direto do usuário — "o carrossel só gera um e é
   * mal feito"): presente só pra `format === "carousel"` — caminhos, em
   * ordem, de TODAS as lâminas de 1 carrossel (não opções alternativas).
   * `storagePath` acima aponta pra 1ª lâmina (capa), pra qualquer leitor que
   * ainda espere um único caminho continuar funcionando sem mudança.
   */
  slideStoragePaths?: string[];
  /** ★ Achado real (pedido direto do usuário — "mostrar o prompt exato usado em cada peça gerada"): prompt/termo de busca exato usado pra achar/gerar `storagePath` (candidato principal). Repassado até `content_versions.generation_metadata` (`photo-pipeline-complete.ts`). */
  generationPrompt?: string;
  /** ★ Mesmo achado, versão carrossel — 1 prompt por lâmina, mesma ordem de `slideStoragePaths`. */
  slideGenerationPrompts?: string[];
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

  const composeOne = async (
    candidate: (typeof params.candidates)[number],
    text: { title: string | null; subheadline: string | null; ctaText: string | null },
    suffix: string,
  ): Promise<{ storagePath: string; videoRenderProviderKey: string }> => {
    const result = await renderProvider.composeImage({
      backgroundImageUrl: candidate.downloadUrl,
      title: text.title,
      subheadline: text.subheadline,
      ctaText: text.ctaText,
      branding,
      width: dimensions.width,
      height: dimensions.height,
      // ★ Achado real (pedido direto do usuário — "ou ele cria a imagem e
      // você inclui o texto"): `providerKey` do candidato identifica se a
      // imagem veio do Gemini (gera a peça inteira, foto+painel — ver
      // `buildDesignedPanelSuffix`) ou do Pexels (só a foto crua, precisa do
      // painel sólido de sempre). Nunca comparado por igualdade exata com o
      // nome do modelo (`GEMINI_IMAGE_MODEL` é configurável) — `includes`
      // cobre qualquer variante de modelo Gemini.
      backgroundIncludesDesignedPanel: candidate.providerKey.toLowerCase().includes("gemini"),
    });

    const imageResponse = await fetch(result.imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar a imagem composta do Video Render Provider (${imageResponse.status}).`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const storagePath = `${params.organizationId}/${params.campaignId}/${params.contentPieceId}-${suffix}.jpg`;
    const { error: uploadError } = await params.db.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .upload(storagePath, imageBuffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;

    return { storagePath, videoRenderProviderKey: result.providerKey };
  };

  // ★ Carrossel: candidatos são lâminas de 1 único carrossel (ordem
  // importa), nunca opções alternativas — vira 1 `ComposedPhotoOption` só,
  // com todos os caminhos em `slideStoragePaths` (ver comentário no tipo
  // acima e em `photo-pipeline-select.ts`/`selectCarouselSlideCandidates`).
  if (params.format === "carousel") {
    const slideStoragePaths: string[] = [];
    const slideGenerationPrompts: string[] = [];
    let lastMediaProviderKey = "";
    let lastVideoRenderProviderKey = "";

    for (let index = 0; index < params.candidates.length; index++) {
      const candidate = params.candidates[index]!;

      // ★ Achado real (validação com render real): a última lâmina do plano
      // já tem a CTA no próprio `headline` (deriveCarouselSlidePlan) —
      // somar `visualBrief.ctaText` como bloco separado duplicava a
      // chamada pra ação na mesma imagem (2 blocos de "fale conosco"
      // sobrepostos, visualmente poluído). `ctaText` do composeImage nunca
      // é usado em carrossel — a CTA mora só no `title` da última lâmina.
      const { storagePath, videoRenderProviderKey } = await composeOne(
        candidate,
        {
          title: candidate.slideHeadline || visualBrief.shortTitle || null,
          subheadline: candidate.slideBody || null,
          ctaText: null,
        },
        `slide-${index + 1}`,
      );

      slideStoragePaths.push(storagePath);
      slideGenerationPrompts.push(candidate.generationPrompt ?? "");
      lastMediaProviderKey = candidate.providerKey;
      lastVideoRenderProviderKey = videoRenderProviderKey;
    }

    return [
      {
        storagePath: slideStoragePaths[0]!,
        mediaProviderKey: lastMediaProviderKey,
        videoRenderProviderKey: lastVideoRenderProviderKey,
        slideStoragePaths,
        slideGenerationPrompts,
      },
    ];
  }

  const options: ComposedPhotoOption[] = [];

  for (let index = 0; index < params.candidates.length; index++) {
    const candidate = params.candidates[index]!;

    const { storagePath, videoRenderProviderKey } = await composeOne(
      candidate,
      {
        title: visualBrief.shortTitle || null,
        subheadline: visualBrief.subheadline || null,
        ctaText: visualBrief.ctaText || null,
      },
      `option-${index + 1}`,
    );

    options.push({
      storagePath,
      mediaProviderKey: candidate.providerKey,
      videoRenderProviderKey,
      generationPrompt: candidate.generationPrompt,
    });
  }

  return options;
}
