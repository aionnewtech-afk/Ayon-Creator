import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPieceFormat, Database, ProviderTier } from "@ayon/types";
import { resolveImageGenerationMediaProvider, resolveLlmProvider, resolveMediaProvider } from "../providers/provider-gateway";
import type { MediaCandidate, MediaProvider } from "../providers/media-provider";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { derivePhotoSearchQuery } from "./derive-photo-search-query";
import { buildDesignedPanelSuffix, deriveImageGenerationPrompt } from "./derive-image-generation-prompt";
import { deriveCarouselSlidePlan } from "./derive-carousel-slide-plan";
import { fetchBrandReferenceImages } from "./fetch-brand-reference-images";

/**
 * Número de opções geradas por rodada (arch. §14.4.2) — "quando
 * financeiramente viável" (dono do produto): mais opções nos tiers mais
 * caros, sempre pelo menos 1. Números de partida, ajustáveis conforme custo
 * real observado — não travados como regra de negócio definitiva.
 */
const OPTIONS_PER_TIER: Record<ProviderTier, number> = {
  economico: 1,
  balanceado: 2,
  premium: 3,
};

/** Dimensões por formato (px) — thumbnail/stories seguem o vertical 9:16 do vídeo; carousel usa o quadrado padrão do feed. */
export const PHOTO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  thumbnail: { width: 1080, height: 1920 },
  stories: { width: 1080, height: 1920 },
  carousel: { width: 1080, height: 1080 },
};

export interface SelectPhotoCandidatesParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  campaignId: string;
  contentPieceId: string;
  /**
   * Nicho/tema informado pelo usuário ao regenerar (ex.: "praia", "shows",
   * "gastronomia") — achado real, sprint de estabilização: a busca
   * automática (via LLM, `derivePhotoSearchQuery`) já é mais relevante que a
   * concatenação bruta anterior, mas ainda é "genérica demais" quando o
   * usuário tem uma ideia específica de imagem em mente. Quando informado,
   * usado diretamente como termo de busca (o usuário já escreve algo curto
   * e específico — pular a derivação via LLM é mais previsível e mais
   * barato do que reinterpretar a intenção dele).
   */
  nicheOverride?: string | null;
}

export interface SelectPhotoCandidatesResult {
  candidates: MediaCandidate[];
  mediaProviderKey: string;
  format: ContentPieceFormat;
}

/**
 * Etapa 1 do pipeline de foto (Fluxo 15, arch. §14.4) — busca N candidatos
 * (`OPTIONS_PER_TIER`) no banco de fotos licenciadas, todos do mesmo tema
 * (nicho da marca + tema da campanha), para o passo de composição (§14.4.1)
 * transformar em opções completas.
 */
export async function selectPhotoCandidates(params: SelectPhotoCandidatesParams): Promise<SelectPhotoCandidatesResult> {
  const piece = await new ContentPieceRepository(params.db).findById(params.contentPieceId);
  if (!piece) throw new Error(`content_piece ${params.contentPieceId} não encontrada.`);

  const campaign = await new CampaignRepository(params.db).findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;

  const fallbackQuery = [brand?.niche, campaign?.title].filter(Boolean).join(" ") || "viagem paisagem";
  const trimmedOverride = params.nicheOverride?.trim();
  const theme = [campaign?.title, brand?.niche].filter(Boolean).join(" — ") || fallbackQuery;

  // ★ Achado real (pedido direto do usuário — "o storie precisa ser uma
  // peça que seja um resumo do que tem no vídeo, do roteiro"): quando o
  // roteiro do vídeo já existe, ele vira a fonte principal do texto/tema
  // visual da foto (deriveImageGenerationPrompt/deriveCarouselSlidePlan/
  // resolveVisualBrief) — a peça de foto e o vídeo da mesma campanha
  // passam a contar a mesma história, nunca duas separadas.
  const primaryPiece = await new ContentPieceRepository(params.db).findPrimaryByCampaignId(params.campaignId);
  const script = primaryPiece?.script ?? null;

  const referenceImages = await fetchBrandReferenceImages(params.db, brand);
  const imageGenProvider = resolveImageGenerationMediaProvider(params.serviceRoleDb, {
    organizationId: brand?.organization_id ?? "sem-organizacao",
    campaignId: params.campaignId,
    contentPieceId: params.contentPieceId,
    referenceImages,
  });

  // ★ Achado real (pedido direto do usuário — "o carrossel só gera um e é mal
  // feito"): carrossel nunca é "N opções alternativas de 1 foto", é 1
  // carrossel com várias lâminas — ramo próprio, load-bearing o suficiente
  // pra não caber no mesmo fluxo de options/perPage abaixo (pensado pra
  // thumbnail/stories).
  if (piece.format === "carousel") {
    return selectCarouselSlideCandidates({
      params,
      campaignTitle: campaign?.title ?? fallbackQuery,
      consolidatedStrategy: (campaign?.strategy_summary as { consolidated_strategy?: string } | null)?.consolidated_strategy ?? null,
      script,
      fallbackQuery,
      nicheOverride: trimmedOverride ?? null,
      imageGenProvider,
      brandPrimaryColorHex: brand?.primary_color_hex ?? null,
      brandSecondaryColorHex: brand?.secondary_color_hex ?? null,
    });
  }

  const optionsCount = OPTIONS_PER_TIER[params.tier];

  let mediaProvider: MediaProvider;
  let query: string;
  let perPage: number;

  if (imageGenProvider) {
    mediaProvider = imageGenProvider;
    const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
    const strategySummary = campaign?.strategy_summary as { consolidated_strategy?: string } | null;
    query = await deriveImageGenerationPrompt({
      theme,
      consolidatedStrategy: strategySummary?.consolidated_strategy ?? null,
      script,
      nicheOverride: trimmedOverride ?? null,
      llmProvider,
      fallbackQuery,
      brandPrimaryColorHex: brand?.primary_color_hex ?? null,
      brandSecondaryColorHex: brand?.secondary_color_hex ?? null,
    });
    // ★ Geração não precisa de "excesso" de candidatos pra filtrar (diferente
    // de busca em banco de fotos, onde o primeiro resultado nem sempre é
    // bom) — cada imagem gerada já é sob medida; gerar mais que
    // `optionsCount` só custaria chamadas extras à API sem benefício.
    perPage = optionsCount;
  } else {
    mediaProvider = await resolveMediaProvider(params.serviceRoleDb, params.tier);
    if (trimmedOverride) {
      query = trimmedOverride;
    } else {
      const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
      query = await derivePhotoSearchQuery(theme, llmProvider, fallbackQuery);
    }
    perPage = Math.max(optionsCount, 3);
  }

  // Carousel sai mais cedo (selectCarouselSlideCandidates) — daqui pra baixo é sempre thumbnail/stories, sempre vertical.
  const searchResult = await mediaProvider.searchPhotos({
    query,
    orientation: "portrait",
    perPage,
  });

  if (searchResult.candidates.length === 0) {
    throw new Error(`Media Provider não encontrou nenhuma foto para "${query}".`);
  }

  return {
    candidates: searchResult.candidates.slice(0, optionsCount),
    mediaProviderKey: searchResult.providerKey,
    format: piece.format,
  };
}

interface SelectCarouselSlideCandidatesParams {
  params: SelectPhotoCandidatesParams;
  campaignTitle: string;
  consolidatedStrategy: string | null;
  script: string | null;
  fallbackQuery: string;
  nicheOverride: string | null;
  imageGenProvider: MediaProvider | null;
  brandPrimaryColorHex: string | null;
  brandSecondaryColorHex: string | null;
}

/**
 * Gera os candidatos de um carrossel — 1 lâmina por item do roteiro
 * (`deriveCarouselSlidePlan`), cada uma com sua própria busca/geração de
 * foto (tema visual próprio da lâmina, nunca a mesma foto repetida
 * `CAROUSEL_SLIDE_COUNT` vezes). `slideHeadline`/`slideBody` viajam dentro
 * do próprio `MediaCandidate` (mesmo canal que já atravessa select → n8n →
 * compose sem mudança de contrato) para `composePhotoContentPiece` montar o
 * texto de cada lâmina sem precisar reconsultar o LLM.
 */
async function selectCarouselSlideCandidates(input: SelectCarouselSlideCandidatesParams): Promise<SelectPhotoCandidatesResult> {
  const { params, imageGenProvider } = input;

  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
  const slides = await deriveCarouselSlidePlan({
    campaignTitle: input.campaignTitle,
    consolidatedStrategy: input.consolidatedStrategy,
    script: input.script,
    fallbackQuery: input.fallbackQuery,
    llmProvider,
  });

  const mediaProvider = imageGenProvider ?? (await resolveMediaProvider(params.serviceRoleDb, params.tier));

  const candidates: MediaCandidate[] = [];
  let mediaProviderKey = "";

  for (const slide of slides) {
    // Geração pede uma cena inteira e descritiva; busca de banco pede
    // palavras-chave curtas — o próprio `imageTheme` já sai curto e
    // concreto (2-6 palavras), serve bem pros dois casos sem reformular.
    const baseQuery = input.nicheOverride ? `${input.nicheOverride} — ${slide.imageTheme}` : slide.imageTheme;
    // ★ Achado real (pedido direto do usuário — "amador, simples demais...
    // ou ele cria a imagem e você inclui o texto"): mesmo achado de
    // `deriveImageGenerationPrompt` aplicado ao carrossel — só faz sentido
    // pedir a peça completa (foto + painel desenhado, sem texto) quando é
    // o Gemini gerando a imagem; buscando no banco (Pexels) o `query` é
    // palavra-chave de busca, nunca um prompt de geração.
    const query = imageGenProvider
      ? `${baseQuery}${buildDesignedPanelSuffix(input.brandPrimaryColorHex, input.brandSecondaryColorHex)}`
      : baseQuery;

    const searchResult = await mediaProvider.searchPhotos({ query, orientation: "square", perPage: 1 });
    mediaProviderKey = searchResult.providerKey;

    const candidate = searchResult.candidates[0];
    if (!candidate) continue;

    candidates.push({ ...candidate, slideHeadline: slide.headline, slideBody: slide.body });
  }

  if (candidates.length === 0) {
    throw new Error("Media Provider não encontrou nenhuma foto para nenhuma lâmina do carrossel.");
  }

  return { candidates, mediaProviderKey, format: "carousel" };
}
