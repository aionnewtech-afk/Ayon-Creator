import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveLlmProvider, resolveMediaProvider } from "../providers/provider-gateway";
import type { MediaCandidate } from "../providers/media-provider";
import type { VideoRenderSceneSource } from "../providers/video-render-provider";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { segmentScript } from "./segment-script";

const CANDIDATES_PER_SEGMENT = 5;

export interface SelectVideoScenesParams {
  /** Client de sessão (RLS) ou service role — lê `content_pieces.script`/`campaigns`/`brands`. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve `provider_configs`. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  /** Duração total a cobrir (ms) — normalmente a duração do áudio de narração (etapa anterior do pipeline). */
  totalDurationMs: number;
  campaignId: string;
  contentPieceId: string;
}

export interface SelectVideoScenesResult {
  videoSources: VideoRenderSceneSource[];
  mediaProviderKey: string;
}

/**
 * Etapa 1 do pipeline de vídeo (Fluxo 13, passo 3) — seleção de cenas via
 * Media Provider (Pexels), único modo implementado na Etapa 1
 * (`licensed_stock_video`, architecture.md §3.5.1).
 *
 * ★ Missão 11 (arch. §14.7) — redesenho completo: o roteiro é segmentado em
 * trechos (`segmentScript`, LLM Provider), cada trecho busca sua própria
 * cena (em vez de uma única busca genérica repetida para o vídeo inteiro).
 * Candidato já usado em qualquer trecho anterior é descartado antes de
 * qualquer repetição — repetir só é o último recurso quando nenhum
 * candidato novo está disponível em nenhum trecho.
 */
export async function selectVideoScenes(params: SelectVideoScenesParams): Promise<SelectVideoScenesResult> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const piece = await contentPieceRepository.findById(params.contentPieceId);
  if (!piece?.script) {
    throw new Error(`content_piece ${params.contentPieceId} não tem script para selecionar cenas.`);
  }

  const campaignRepository = new CampaignRepository(params.db);
  const campaign = await campaignRepository.findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;
  const fallbackQuery = brand?.niche ?? "viagem paisagem";
  const context = [campaign?.title, brand?.niche].filter(Boolean).join(" — ") || fallbackQuery;

  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
  const segments = await segmentScript(piece.script, llmProvider, fallbackQuery, context);

  const mediaProvider = await resolveMediaProvider(params.serviceRoleDb, params.tier);
  const totalDurationSeconds = params.totalDurationMs / 1000;
  const totalScriptChars = segments.reduce((sum, segment) => sum + segment.text.length, 0) || 1;

  const usedCandidateIds = new Set<string>();
  const videoSources: VideoRenderSceneSource[] = [];
  let coveredSeconds = 0;
  let mediaProviderKey = "";
  let lastCandidate: MediaCandidate | null = null;

  for (const segment of segments) {
    const remainingTotalSeconds = totalDurationSeconds - coveredSeconds;
    if (remainingTotalSeconds <= 0) break;

    const segmentShareSeconds = (segment.text.length / totalScriptChars) * totalDurationSeconds;
    const segmentLengthSeconds = Math.min(segmentShareSeconds, remainingTotalSeconds);
    if (segmentLengthSeconds <= 0) continue;

    const searchResult = await mediaProvider.searchMedia({
      query: segment.searchQuery,
      orientation: "portrait",
      perPage: CANDIDATES_PER_SEGMENT,
    });
    mediaProviderKey = searchResult.providerKey;

    let unusedCandidates: MediaCandidate[] = searchResult.candidates.filter((c) => !usedCandidateIds.has(c.id));

    if (unusedCandidates.length === 0) {
      const fallbackResult = await mediaProvider.searchMedia({
        query: fallbackQuery,
        orientation: "portrait",
        perPage: CANDIDATES_PER_SEGMENT,
      });
      mediaProviderKey = fallbackResult.providerKey;
      unusedCandidates = fallbackResult.candidates.filter((c) => !usedCandidateIds.has(c.id));
    }

    // Último recurso: nenhum candidato novo em nenhuma busca deste trecho —
    // repete o último usado (nunca deixa um trecho sem cena) ou o primeiro
    // resultado bruto, se este for o primeiro trecho.
    const chosen: MediaCandidate | null = unusedCandidates[0] ?? lastCandidate ?? searchResult.candidates[0] ?? null;
    if (!chosen) continue;

    usedCandidateIds.add(chosen.id);
    lastCandidate = chosen;

    const clipLengthSeconds = Math.min(chosen.durationSeconds ?? segmentLengthSeconds, remainingTotalSeconds);
    videoSources.push({ url: chosen.downloadUrl, startSeconds: coveredSeconds, lengthSeconds: clipLengthSeconds });
    coveredSeconds += clipLengthSeconds;
  }

  if (videoSources.length === 0) {
    throw new Error(`Media Provider não encontrou nenhuma cena para o roteiro do content_piece ${params.contentPieceId}.`);
  }

  return { videoSources, mediaProviderKey };
}
