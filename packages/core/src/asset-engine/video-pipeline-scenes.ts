import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveImageGenerationMediaProvider, resolveLlmProvider, resolveMediaProvider, resolveVeoVideoProvider } from "../providers/provider-gateway";
import type { MediaCandidate } from "../providers/media-provider";
import type { VideoRenderSceneSource } from "../providers/video-render-provider";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { segmentScript, type ScriptSegment } from "./segment-script";
import { deriveImageGenerationPrompt } from "./derive-image-generation-prompt";
import { fetchBrandReferenceImages } from "./fetch-brand-reference-images";

const CANDIDATES_PER_SEGMENT = 5;

/**
 * ★ Achado real (pedido direto do usuário — "o vídeo tá parado, muito tempo
 * na mesma cena" / "poderiam ser vários cortes rápidos, estilo capcut"):
 * antes, 1 trecho do roteiro = 1 cena só, esticada pelo tempo proporcional
 * inteiro do trecho (podia passar de 10s numa cena parada). Nenhuma cena
 * agora passa de `MAX_CLIP_SECONDS` — um trecho mais longo vira vários
 * cortes rápidos (múltiplos candidatos já buscados, `CANDIDATES_PER_SEGMENT`
 * dá folga pra isso), sempre do mesmo tema/busca do trecho (nunca perde a
 * relação com a fala, só corta mais rápido dentro dela).
 */
const MAX_CLIP_SECONDS = 3;

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
  /** ★ Achado real (pedido direto do usuário — "a quantidade média de cenas"): duração máxima de cada corte — ausente cai no padrão de sempre (`MAX_CLIP_SECONDS`, cortes rápidos estilo CapCut). Maior aqui = menos cenas no total pra mesma duração de vídeo. */
  avgSceneSeconds?: number;
}

export interface SelectVideoScenesResult {
  videoSources: VideoRenderSceneSource[];
  mediaProviderKey: string;
  /** ★ Achado real (pedido direto do usuário — aprovar o plano antes de renderizar): trechos do roteiro usados na busca, pra tela de revisão mostrar o que será dito ao lado do que será mostrado. Nunca usado pelo render em si (só `videoSources`). */
  segments: ScriptSegment[];
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
  // ★ Achado real (mesma causa raiz já corrigida em video-pipeline-narrate.ts,
  // sprint de estabilização — nunca propagada para cá): `content_pieces.script`
  // da própria peça de vídeo nunca é populado; a peça primária ("Roteiro") é
  // a única fonte de verdade. Narrar funcionava (já corrigido), mas
  // selecionar cenas ainda lia o campo errado e sempre falhava em seguida.
  const primaryPiece = await contentPieceRepository.findPrimaryByCampaignId(params.campaignId);
  if (!primaryPiece?.script) {
    throw new Error(`Campanha ${params.campaignId} não tem roteiro gerado ainda (peça primária sem script) — não é possível selecionar cenas.`);
  }

  const campaignRepository = new CampaignRepository(params.db);
  const campaign = await campaignRepository.findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;
  const fallbackQuery = brand?.niche ?? "viagem paisagem";
  const context = [campaign?.title, brand?.niche].filter(Boolean).join(" — ") || fallbackQuery;

  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
  const segments = await segmentScript(primaryPiece.script, llmProvider, fallbackQuery, context);

  const mediaProvider = await resolveMediaProvider(params.serviceRoleDb, params.tier);
  // ★ Achado real (pedido direto do usuário — vídeo "desconexo", não
  // "acompanha o roteiro"): quando o Pexels não tem nenhuma cena nova pro
  // trecho, repetir o último clipe usado é exatamente o sintoma relatado.
  // Fallback híbrido: gera uma imagem sob medida pro trecho (mesmo adapter
  // já validado em selectPhotoCandidates) em vez de repetir — só ativo
  // quando `IMAGE_GENERATION_PROVIDER=gemini` (padrão: `null`, comportamento
  // 100% igual ao anterior). Nunca substitui uma cena de vídeo real
  // encontrada — só cobre o pior caso, quando não existe nenhuma.
  const referenceImages = await fetchBrandReferenceImages(params.db, brand);
  const imageGenProvider = resolveImageGenerationMediaProvider(params.serviceRoleDb, {
    organizationId: brand?.organization_id ?? "sem-organizacao",
    campaignId: params.campaignId,
    contentPieceId: params.contentPieceId,
    referenceImages,
  });
  // ★ Achado real (pedido direto do usuário, aprovado após teste real pago —
  // "ahhh eu adorei"): camada NOVA entre a busca do Pexels e a imagem
  // gerada+zoom — gera um clipe de vídeo real (Veo). Só ativo com
  // `VIDEO_GENERATION_PROVIDER=gemini` (padrão: `null`, comportamento
  // idêntico ao anterior). Geração pode levar minutos — no máximo 1 por
  // vídeo (`veoAttempted` abaixo), nunca 1 por trecho exaurido, pra nunca
  // compor várias esperas longas em série no mesmo pipeline.
  const veoProvider = resolveVeoVideoProvider(params.serviceRoleDb, {
    organizationId: brand?.organization_id ?? "sem-organizacao",
    campaignId: params.campaignId,
    contentPieceId: params.contentPieceId,
  });
  let veoAttempted = false;
  const strategySummary = campaign?.strategy_summary as { consolidated_strategy?: string } | null;

  const clipSeconds = params.avgSceneSeconds ?? MAX_CLIP_SECONDS;
  const totalDurationSeconds = params.totalDurationMs / 1000;
  const totalScriptChars = segments.reduce((sum, segment) => sum + segment.text.length, 0) || 1;

  const usedCandidateIds = new Set<string>();
  const videoSources: VideoRenderSceneSource[] = [];
  let coveredSeconds = 0;
  let mediaProviderKey = "";
  let lastCandidate: MediaCandidate | null = null;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex]!;
    const remainingTotalSecondsAtSegmentStart = totalDurationSeconds - coveredSeconds;
    if (remainingTotalSecondsAtSegmentStart <= 0) break;

    const segmentShareSeconds = (segment.text.length / totalScriptChars) * totalDurationSeconds;
    let segmentRemainingSeconds = Math.min(segmentShareSeconds, remainingTotalSecondsAtSegmentStart);
    if (segmentRemainingSeconds <= 0) continue;

    // ★ Achado real (pedido direto do usuário — roteiro cena-a-cena com
    // cenas marcadas "IA" desde o planejamento, exemplo trazido pronto:
    // transições conceituais entre destinos): `sceneType === "ai"` nunca
    // busca banco de vídeo — vai direto pro fallback de geração abaixo
    // (Veo → imagem Ken Burns), usando o prompt cinematográfico já escrito
    // por `segmentScript` (`segment.aiPrompt`) em vez de derivar um genérico
    // na hora. Pool vazio + fallback já tentado força o loop a cair direto
    // no branch de geração (mesmo código de sempre, sem duplicar lógica).
    const skipStockSearch = segment.sceneType === "ai";
    let pool: MediaCandidate[] = [];
    let triedFallbackQuery = skipStockSearch;
    // ★ Substitui `searchResult.candidates[0]` (agora fora de escopo pra
    // segmentos "ai", que nunca chamam `searchMedia`) no último recurso
    // abaixo — só populado quando a busca de banco de vídeo roda de verdade.
    let firstStockCandidate: MediaCandidate | null = null;

    if (!skipStockSearch) {
      const searchResult = await mediaProvider.searchMedia({
        query: segment.searchQuery,
        orientation: "portrait",
        perPage: CANDIDATES_PER_SEGMENT,
      });
      mediaProviderKey = searchResult.providerKey;
      firstStockCandidate = searchResult.candidates[0] ?? null;

      // ★ Pool de candidatos deste trecho — vários cortes rápidos consomem
      // vários candidatos aqui em sequência (`MAX_CLIP_SECONDS`), em vez de 1
      // candidato esticado pelo trecho inteiro (ver comentário na constante).
      pool = searchResult.candidates.filter((c) => !usedCandidateIds.has(c.id));
    }

    while (segmentRemainingSeconds > 0 && totalDurationSeconds - coveredSeconds > 0) {
      if (pool.length === 0 && !triedFallbackQuery) {
        triedFallbackQuery = true;
        const fallbackResult = await mediaProvider.searchMedia({
          query: fallbackQuery,
          orientation: "portrait",
          perPage: CANDIDATES_PER_SEGMENT,
        });
        mediaProviderKey = fallbackResult.providerKey;
        pool = fallbackResult.candidates.filter((c) => !usedCandidateIds.has(c.id));
      }

      if (pool.length === 0) {
        // ★ Fallback híbrido, camada 1 (vídeo real via Veo) — tenta antes da
        // imagem gerada, só quando `veoProvider` está ativo e ainda não foi
        // tentado neste vídeo (`veoAttempted`, ver comentário acima). Cobre
        // até `MAX_CLIP_SECONDS` do trecho (não o trecho inteiro — é vídeo
        // de verdade, cabe no ritmo de corte rápido igual aos clipes do
        // Pexels). Falha (ou já usado) cai pra imagem gerada abaixo, nunca
        // bloqueia o pipeline.
        if (veoProvider && !veoAttempted) {
          veoAttempted = true;
          try {
            // ★ Achado real (pedido direto do usuário — roteiro cena-a-cena
            // com prompt cinematográfico completo por cena, já escrito por
            // `segmentScript` no nível de um pedido profissional): usa
            // `segment.aiPrompt` direto quando existe — só deriva um prompt
            // genérico aqui como fallback (segmentos antigos, ou de origem
            // "real"/"brand" caindo neste branch reativamente).
            const videoPrompt =
              segment.aiPrompt ??
              (await deriveImageGenerationPrompt({
                theme: segment.text,
                consolidatedStrategy: strategySummary?.consolidated_strategy ?? null,
                nicheOverride: null,
                llmProvider,
                fallbackQuery: segment.searchQuery,
              }));
            const generated = await veoProvider.generateVideo(videoPrompt);
            const clipLengthSeconds = Math.min(
              clipSeconds,
              segmentRemainingSeconds,
              generated.durationSeconds ?? clipSeconds,
              totalDurationSeconds - coveredSeconds,
            );
            if (clipLengthSeconds > 0) {
              videoSources.push({
                url: generated.downloadUrl,
                startSeconds: coveredSeconds,
                lengthSeconds: clipLengthSeconds,
                segmentIndex,
                generationPrompt: videoPrompt,
              });
              coveredSeconds += clipLengthSeconds;
              segmentRemainingSeconds -= clipLengthSeconds;
              mediaProviderKey = generated.providerKey;
              continue;
            }
          } catch {
            // Cai pro fallback de imagem gerada abaixo — nunca interrompe a
            // seleção de cenas por uma falha de geração de vídeo.
          }
        }

        // ★ Fallback híbrido, camada 2 (imagem gerada + Ken Burns) — antes
        // de repetir um clipe já usado, tenta gerar 1 imagem sob medida
        // cobrindo o resto do trecho — só quando `imageGenProvider` está
        // ativo. Geração de imagem não se beneficia de "cortes rápidos"
        // (não tem várias tomadas de uma busca) — 1 imagem com Ken Burns
        // cobre o restante do trecho de uma vez. Falha aqui nunca bloqueia
        // o pipeline, cai no último recurso abaixo.
        if (imageGenProvider) {
          try {
            const imagePrompt =
              segment.aiPrompt ??
              (await deriveImageGenerationPrompt({
                theme: segment.text,
                consolidatedStrategy: strategySummary?.consolidated_strategy ?? null,
                nicheOverride: null,
                llmProvider,
                fallbackQuery: segment.searchQuery,
              }));
            const generatedResult = await imageGenProvider.searchPhotos({
              query: imagePrompt,
              orientation: "portrait",
              perPage: 1,
            });
            const generated = generatedResult.candidates[0];
            if (generated) {
              videoSources.push({
                url: generated.downloadUrl,
                startSeconds: coveredSeconds,
                lengthSeconds: segmentRemainingSeconds,
                assetType: "image",
                segmentIndex,
                generationPrompt: imagePrompt,
              });
              coveredSeconds += segmentRemainingSeconds;
              mediaProviderKey = generatedResult.providerKey;
              segmentRemainingSeconds = 0;
              continue;
            }
          } catch {
            // Cai no último recurso abaixo (repete o último clipe) — nunca
            // interrompe a seleção de cenas por uma falha de geração.
          }
        }

        // Último recurso: nenhum candidato novo em nenhuma busca deste
        // trecho (e geração indisponível/falhou) — repete o último usado
        // (nunca deixa um trecho sem cena) ou o primeiro resultado bruto,
        // se este for o primeiro trecho. ★ Achado real: segmentos "ai" nunca
        // buscaram banco de vídeo (`firstStockCandidate` fica `null`) — se
        // Veo/Gemini falharem os dois E for o 1º trecho do vídeo, faz uma
        // busca de emergência aqui (nunca deixa a cena vazia por causa de
        // uma geração que falhou).
        if (!lastCandidate && !firstStockCandidate) {
          const emergencyResult = await mediaProvider.searchMedia({
            query: segment.searchQuery,
            orientation: "portrait",
            perPage: 1,
          });
          firstStockCandidate = emergencyResult.candidates[0] ?? null;
          mediaProviderKey = emergencyResult.providerKey || mediaProviderKey;
        }

        const chosen: MediaCandidate | null = lastCandidate ?? firstStockCandidate;
        if (!chosen) break;

        const clipLengthSeconds = Math.min(segmentRemainingSeconds, totalDurationSeconds - coveredSeconds);
        videoSources.push({
          url: chosen.downloadUrl,
          startSeconds: coveredSeconds,
          lengthSeconds: clipLengthSeconds,
          segmentIndex,
          generationPrompt: segment.searchQuery,
        });
        coveredSeconds += clipLengthSeconds;
        segmentRemainingSeconds -= clipLengthSeconds;
        continue;
      }

      const chosen = pool.shift()!;
      usedCandidateIds.add(chosen.id);
      lastCandidate = chosen;

      const clipLengthSeconds = Math.min(
        clipSeconds,
        segmentRemainingSeconds,
        chosen.durationSeconds ?? clipSeconds,
        totalDurationSeconds - coveredSeconds,
      );
      if (clipLengthSeconds <= 0) break;

      videoSources.push({
        url: chosen.downloadUrl,
        startSeconds: coveredSeconds,
        lengthSeconds: clipLengthSeconds,
        segmentIndex,
        generationPrompt: chosen.generationPrompt ?? segment.searchQuery,
      });
      coveredSeconds += clipLengthSeconds;
      segmentRemainingSeconds -= clipLengthSeconds;
    }
  }

  if (videoSources.length === 0) {
    throw new Error(`Media Provider não encontrou nenhuma cena para o roteiro do content_piece ${params.contentPieceId}.`);
  }

  // ★ Achado real (pedido direto do usuário — "a última frase da narração
  // tá sendo cortada"): a soma dos `lengthSeconds` das cenas às vezes
  // fechava um pouco abaixo de `totalDurationSeconds` (arredondamento da
  // divisão proporcional por trecho, `segmentShareSeconds`, ou um trecho
  // que esgotou todo fallback antes de cobrir seu tempo inteiro) — o
  // Shotstack corta o render no fim da trilha de vídeo, não no fim do
  // áudio, então qualquer sobra de narração depois da última cena nunca é
  // ouvida. Estica a última cena pra cobrir a sobra — nunca deixa a trilha
  // de vídeo terminar antes do áudio.
  const shortfallSeconds = totalDurationSeconds - coveredSeconds;
  if (shortfallSeconds > 0) {
    const lastSource = videoSources[videoSources.length - 1]!;
    lastSource.lengthSeconds += shortfallSeconds;
  }

  return { videoSources, mediaProviderKey, segments };
}
