import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveMediaProvider } from "../providers/provider-gateway";
import type { VideoRenderSceneSource } from "../providers/video-render-provider";

const MAX_CANDIDATES = 5;

export interface SelectVideoScenesParams {
  /** Client de service role — resolve `provider_configs`. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  /** Duração total a cobrir (ms) — normalmente a duração do áudio de narração (etapa anterior do pipeline). */
  totalDurationMs: number;
  /** Termo de busca — decisão do chamador (normalmente título da campanha/nicho da marca, arch. §3.5.1). */
  searchQuery: string;
}

export interface SelectVideoScenesResult {
  videoSources: VideoRenderSceneSource[];
  mediaProviderKey: string;
}

/**
 * Etapa 1 do pipeline de vídeo (Fluxo 13, passo 3) — seleção de cenas via
 * Media Provider (Pexels), único modo implementado na Etapa 1
 * (`licensed_stock_video`, architecture.md §3.5.1). Encadeia candidatos em
 * sequência até cobrir `totalDurationMs`; se os candidatos acabarem antes,
 * repete o último para preencher o tempo restante — simplificação
 * deliberada da Etapa 1 (seleção por trecho/keyword por caption cue, em vez
 * de uma busca única para a peça inteira, fica como refinamento futuro).
 */
export async function selectVideoScenes(params: SelectVideoScenesParams): Promise<SelectVideoScenesResult> {
  const mediaProvider = await resolveMediaProvider(params.serviceRoleDb, params.tier);
  const searchResult = await mediaProvider.searchMedia({
    query: params.searchQuery,
    orientation: "portrait",
    perPage: MAX_CANDIDATES,
  });

  if (searchResult.candidates.length === 0) {
    throw new Error(`Media Provider não encontrou nenhuma cena para "${params.searchQuery}".`);
  }

  const totalDurationSeconds = params.totalDurationMs / 1000;
  const videoSources: VideoRenderSceneSource[] = [];
  let coveredSeconds = 0;
  let candidateIndex = 0;

  while (coveredSeconds < totalDurationSeconds) {
    const candidate = searchResult.candidates[Math.min(candidateIndex, searchResult.candidates.length - 1)]!;
    const remainingSeconds = totalDurationSeconds - coveredSeconds;
    const clipLengthSeconds = Math.min(candidate.durationSeconds, remainingSeconds);

    if (clipLengthSeconds <= 0) break;

    videoSources.push({ url: candidate.downloadUrl, startSeconds: coveredSeconds, lengthSeconds: clipLengthSeconds });
    coveredSeconds += clipLengthSeconds;
    candidateIndex += 1;
  }

  return { videoSources, mediaProviderKey: searchResult.providerKey };
}
