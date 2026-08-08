import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPieceFormat, Database, ProviderTier } from "@ayon/types";
import { resolveLlmProvider, resolveMediaProvider } from "../providers/provider-gateway";
import type { MediaCandidate } from "../providers/media-provider";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { derivePhotoSearchQuery } from "./derive-photo-search-query";

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

  let query: string;
  if (trimmedOverride) {
    query = trimmedOverride;
  } else {
    const theme = [campaign?.title, brand?.niche].filter(Boolean).join(" — ") || fallbackQuery;
    const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
    query = await derivePhotoSearchQuery(theme, llmProvider, fallbackQuery);
  }

  const mediaProvider = await resolveMediaProvider(params.serviceRoleDb, params.tier);
  const optionsCount = OPTIONS_PER_TIER[params.tier];

  const searchResult = await mediaProvider.searchPhotos({
    query,
    orientation: piece.format === "carousel" ? "square" : "portrait",
    perPage: Math.max(optionsCount, 3),
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
