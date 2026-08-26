import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import {
  resolveAvatarProvider,
  resolveImageGenerationMediaProvider,
  resolveLlmProvider,
  resolveMediaProvider,
  resolveVeoVideoProvider,
} from "../providers/provider-gateway";
import type { MediaCandidate } from "../providers/media-provider";
import type { VideoRenderSceneSource } from "../providers/video-render-provider";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { sanitizeNarrationText } from "../shared/sanitize-narration-text";
import { AvatarProviderUnavailableError } from "./brand-avatar";
import { deriveImageGenerationPrompt } from "./derive-image-generation-prompt";
import { fetchBrandReferenceImages } from "./fetch-brand-reference-images";
import type { PendingVideoScenePlan } from "./video-pipeline-plan";
import { MissingScenePlanError } from "./video-pipeline-plan";
import { AvatarNotReadyError, pollUntilDone } from "./video-pipeline-avatar";

/**
 * ★ Achado real (pedido direto do usuário — "opção de excluir/substituir
 * uma cena individual do vídeo por nova busca, geração por IA, ou upload do
 * próprio usuário"): até aqui, a única forma de mudar 1 cena que não
 * agradou era descartar o plano inteiro e gerar um novo do zero (narração +
 * TODAS as cenas de novo) — caro e apaga acertos junto com o erro. Estas
 * funções editam `content_pieces.pending_scene_plan` in-place, 1 cena por
 * vez, sem tocar narração/áudio nem as outras cenas.
 */

export interface SceneEditParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  campaignId: string;
  contentPieceId: string;
  sceneIndex: number;
}

async function loadPendingPlan(
  db: SupabaseClient<Database>,
  contentPieceId: string,
): Promise<{ videoSources: VideoRenderSceneSource[]; plan: PendingVideoScenePlan }> {
  const piece = await new ContentPieceRepository(db).findById(contentPieceId);
  const plan = piece?.pending_scene_plan as unknown as PendingVideoScenePlan | null;
  if (piece?.status !== "scenes_ready_for_review" || !plan) throw new MissingScenePlanError();
  return { videoSources: plan.videoSources, plan };
}

async function persistPlan(db: SupabaseClient<Database>, contentPieceId: string, plan: PendingVideoScenePlan): Promise<void> {
  await new ContentPieceRepository(db).update(contentPieceId, { pending_scene_plan: plan as unknown as Record<string, unknown> });
}

/**
 * ★ Achado real (mesma causa raiz já corrigida para o plano original — "a
 * última frase da narração tá sendo cortada"): qualquer edição que mude a
 * soma dos `lengthSeconds` (cena removida, cena trocada por um clipe mais
 * curto) precisa recompor a trilha pra nunca terminar antes do áudio —
 * Shotstack corta no fim da trilha de vídeo, não no fim do áudio. Sobra vai
 * pra última cena (mesmo mecanismo já validado real do plano original);
 * `startSeconds` sempre recomputado do zero depois — nunca deixa um "buraco"
 * ou sobreposição entre cenas.
 */
function reconcilePlanTimeline(videoSources: VideoRenderSceneSource[], totalDurationSeconds: number): void {
  const covered = videoSources.reduce((sum, s) => sum + s.lengthSeconds, 0);
  const shortfall = totalDurationSeconds - covered;
  if (shortfall > 0.01) {
    videoSources[videoSources.length - 1]!.lengthSeconds += shortfall;
  }
  let cursor = 0;
  for (const source of videoSources) {
    source.startSeconds = cursor;
    cursor += source.lengthSeconds;
  }
}

function requireScene(videoSources: VideoRenderSceneSource[], sceneIndex: number): VideoRenderSceneSource {
  const scene = videoSources[sceneIndex];
  if (!scene) throw new Error(`Cena ${sceneIndex + 1} não existe nesse plano.`);
  return scene;
}

/**
 * ★ Achado real (pedido direto do usuário — "busca de novas cenas só dá uma
 * opção, caso eu não goste queria que quando gerasse pra substituir
 * viessem outras"): busca pura, nunca aplica nada sozinha — devolve N
 * candidatos (`perPage`) pra revisão escolher, mesmo espírito de
 * `mediaOptions` já usado na geração de foto (arch. §14.4.2, "nunca decide
 * sozinha quando há mais de uma opção").
 */
export async function searchSceneCandidates(params: {
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  query: string;
  perPage?: number;
}): Promise<MediaCandidate[]> {
  const mediaProvider = await resolveMediaProvider(params.serviceRoleDb, params.tier);
  const result = await mediaProvider.searchMedia({ query: params.query, orientation: "portrait", perPage: params.perPage ?? 6 });
  return result.candidates;
}

export interface ApplySceneCandidateParams extends SceneEditParams {
  url: string;
  assetType?: "video" | "image";
  durationSeconds?: number;
  generationPrompt?: string;
}

/**
 * Aplica 1 candidato já escolhido (busca com várias opções, ou upload) na
 * cena — nunca busca nada sozinha, só grava. `durationSeconds` ausente
 * (upload, geração por IA sem duração própria) mantém `lengthSeconds` do
 * slot como estava; presente (candidato de banco de vídeo) nunca estica
 * além do slot original, só encurta se o clipe for mais curto.
 */
export async function applySceneCandidate(params: ApplySceneCandidateParams): Promise<void> {
  const { videoSources, plan } = await loadPendingPlan(params.db, params.contentPieceId);
  const existing = requireScene(videoSources, params.sceneIndex);

  const lengthSeconds =
    params.durationSeconds !== undefined ? Math.min(existing.lengthSeconds, params.durationSeconds) : existing.lengthSeconds;

  videoSources[params.sceneIndex] = {
    ...existing,
    url: params.url,
    assetType: params.assetType,
    lengthSeconds,
    generationPrompt: params.generationPrompt,
  };

  reconcilePlanTimeline(videoSources, plan.audioDurationMs / 1000);
  await persistPlan(params.db, params.contentPieceId, plan);
}

/**
 * ★ Achado real (pedido direto do usuário — "a geração da cena por IA tá
 * muito genérica, precisa ter um espaço de prompt sugerido e pra gente
 * editar"): devolve o prompt que `replaceVideoSceneWithAi` usaria, SEM
 * gerar nada — o mesmo `segment.aiPrompt` já escrito no planejamento
 * (`segmentScript`) quando existir, ou derivado na hora (mesma lógica de
 * sempre) quando não. A UI mostra isso num campo editável antes de
 * confirmar a geração de verdade.
 */
export async function suggestSceneAiPrompt(params: SceneEditParams): Promise<{ prompt: string }> {
  const { videoSources, plan } = await loadPendingPlan(params.db, params.contentPieceId);
  const existing = requireScene(videoSources, params.sceneIndex);
  const segment = existing.segmentIndex !== undefined ? plan.segments[existing.segmentIndex] : undefined;
  if (segment?.aiPrompt) return { prompt: segment.aiPrompt };

  const campaign = await new CampaignRepository(params.db).findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;
  const theme = segment?.text || [campaign?.title, brand?.niche].filter(Boolean).join(" — ") || "viagem";

  const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
  const strategySummary = campaign?.strategy_summary as { consolidated_strategy?: string } | null;
  const prompt = await deriveImageGenerationPrompt({
    theme,
    consolidatedStrategy: strategySummary?.consolidated_strategy ?? null,
    nicheOverride: null,
    llmProvider,
    fallbackQuery: segment?.searchQuery ?? brand?.niche ?? "viagem",
  });

  return { prompt };
}

export interface ReplaceVideoSceneWithAiParams extends SceneEditParams {
  /** ★ Achado real (pedido direto do usuário — prompt "muito genérico"): quando presente (usuário editou o prompt sugerido, `suggestSceneAiPrompt`), usa exatamente esse texto — nunca deriva/ignora o que a pessoa escreveu. Ausente cai no mesmo prompt sugerido (`segment.aiPrompt` ou derivado). */
  customPrompt?: string;
}

/**
 * Substitui 1 cena por conteúdo gerado por IA — grounded no trecho exato do
 * roteiro que essa cena ilustra (`segmentIndex`, ausente só em planos
 * gerados antes desse campo existir; cai pro tema geral da campanha nesse
 * caso raro). ★ Achado real (pedido direto do usuário — "quando peço pra
 * gerar a cena por IA ele gera só imagem e não vídeo"): mesma prioridade do
 * fallback híbrido automático (`video-pipeline-scenes.ts`) — tenta vídeo
 * real (Veo) primeiro, só cai pra imagem (Ken Burns) se o Veo estiver
 * desligado (`VIDEO_GENERATION_PROVIDER`) ou a geração falhar.
 */
export async function replaceVideoSceneWithAi(params: ReplaceVideoSceneWithAiParams): Promise<void> {
  const { videoSources, plan } = await loadPendingPlan(params.db, params.contentPieceId);
  const existing = requireScene(videoSources, params.sceneIndex);

  const campaign = await new CampaignRepository(params.db).findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;
  const segment = existing.segmentIndex !== undefined ? plan.segments[existing.segmentIndex] : undefined;

  let prompt = params.customPrompt?.trim() || segment?.aiPrompt;
  if (!prompt) {
    const theme = segment?.text || [campaign?.title, brand?.niche].filter(Boolean).join(" — ") || "viagem";
    const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
    const strategySummary = campaign?.strategy_summary as { consolidated_strategy?: string } | null;
    prompt = await deriveImageGenerationPrompt({
      theme,
      consolidatedStrategy: strategySummary?.consolidated_strategy ?? null,
      nicheOverride: null,
      llmProvider,
      fallbackQuery: segment?.searchQuery ?? brand?.niche ?? "viagem",
    });
  }

  const veoProvider = resolveVeoVideoProvider(params.serviceRoleDb, {
    organizationId: brand?.organization_id ?? "sem-organizacao",
    campaignId: params.campaignId,
    contentPieceId: params.contentPieceId,
  });
  if (veoProvider) {
    try {
      const generated = await veoProvider.generateVideo(prompt);
      // ★ Mesmo critério de `replaceVideoSceneWithSearch` — nunca estica a
      // cena além do slot original, só encurta se o clipe gerado for mais
      // curto; `reconcilePlanTimeline` cobre a sobra na última cena.
      videoSources[params.sceneIndex] = {
        ...existing,
        url: generated.downloadUrl,
        assetType: "video",
        lengthSeconds: Math.min(existing.lengthSeconds, generated.durationSeconds ?? existing.lengthSeconds),
        generationPrompt: prompt,
      };
      reconcilePlanTimeline(videoSources, plan.audioDurationMs / 1000);
      await persistPlan(params.db, params.contentPieceId, plan);
      return;
    } catch {
      // Cai pro fallback de imagem gerada abaixo — mesmo espírito defensivo
      // do fallback híbrido automático, nunca bloqueia a troca manual.
    }
  }

  const referenceImages = await fetchBrandReferenceImages(params.db, brand);
  const imageGenProvider = resolveImageGenerationMediaProvider(params.serviceRoleDb, {
    organizationId: brand?.organization_id ?? "sem-organizacao",
    campaignId: params.campaignId,
    contentPieceId: params.contentPieceId,
    referenceImages,
  });
  if (!imageGenProvider) {
    throw new Error("Geração de cena por IA não está habilitada — peça pra habilitar IMAGE_GENERATION_PROVIDER ou VIDEO_GENERATION_PROVIDER.");
  }

  const result = await imageGenProvider.searchPhotos({ query: prompt, orientation: "portrait", perPage: 1 });
  const generated = result.candidates[0];
  if (!generated) throw new Error("Não consegui gerar uma cena por IA agora.");

  // ★ Imagem gerada não tem duração própria (Ken Burns cobre qualquer
  // tempo) — mantém `lengthSeconds` como estava, nunca precisa de
  // reconciliação de sobra/falta.
  videoSources[params.sceneIndex] = { ...existing, url: generated.downloadUrl, assetType: "image", generationPrompt: prompt };

  await persistPlan(params.db, params.contentPieceId, plan);
}

const SCENE_EDIT_OUTPUT_BUCKET = "content-output";

/**
 * ★ Achado real (pedido direto do usuário — "no vídeo geral que mostra
 * cenas do Pexels, eu queria incluir uma opção de alternar com avatar...
 * vídeos de 2-3 segundos intercalados entre as imagens"): substitui 1 cena
 * (a origem manual sempre, nunca automática — usuário escolhe cena por cena
 * na revisão) por um clipe REAL do avatar treinado da marca, falando o
 * trecho exato do roteiro que essa cena ilustra (`segmentIndex`). A trilha
 * de narração original continua tocando por baixo (mesmo áudio de sempre,
 * nunca trocado) — o clipe do avatar entra mudo na composição final (mesmo
 * branch de "video" no Shotstack, `assetType` novo só muda como a UI
 * identifica a cena, nunca o áudio), então o texto usado aqui precisa ser
 * IDÊNTICO ao trecho que a narração já está falando naquele momento, pra
 * boca e voz baterem.
 */
export async function replaceVideoSceneWithAvatar(params: SceneEditParams): Promise<void> {
  const { videoSources, plan } = await loadPendingPlan(params.db, params.contentPieceId);
  const existing = requireScene(videoSources, params.sceneIndex);

  const campaign = await new CampaignRepository(params.db).findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;
  if (!brand?.avatar_ready || !brand.avatar_look_id) throw new AvatarNotReadyError();

  const segment = existing.segmentIndex !== undefined ? plan.segments[existing.segmentIndex] : undefined;
  if (!segment?.text) throw new Error("Essa cena não tem um trecho de roteiro associado — não dá pra gerar um clipe de avatar pra ela.");

  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, brand.organization_id);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  // ★ Achado real (pedido direto do usuário — "se eu usar um avatar ele
  // precisa ser a voz do clone e ele narrar todo o vídeo"): na 1ª cena que
  // vira avatar neste plano, troca a narração INTEIRA pra voz clonada do
  // avatar (mesma voz do clipe visível) — nunca uma cena com voz clonada e
  // outra com a voz genérica de sempre no mesmo vídeo. Cenas seguintes que
  // também virarem avatar reaproveitam a narração já trocada (checagem
  // abaixo). Nunca bloqueia a troca da cena em si — qualquer falha aqui só
  // mantém a narração de antes, mesmo espírito defensivo de sempre.
  const alreadyUsesAvatarVoice = videoSources.some((source) => source.assetType === "avatar");
  if (!alreadyUsesAvatarVoice && brand.avatar_voice_id) {
    try {
      const primaryPiece = await new ContentPieceRepository(params.db).findPrimaryByCampaignId(params.campaignId);
      if (primaryPiece?.script) {
        const narration = await avatarProvider.synthesizeSpeech({
          voiceId: brand.avatar_voice_id,
          text: sanitizeNarrationText(primaryPiece.script),
        });

        const audioResponse = await fetch(narration.audioUrl);
        if (!audioResponse.ok) throw new Error(`Falha ao baixar a narração com voz clonada (${audioResponse.status}).`);
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

        const narrationStoragePath = `${brand.organization_id}/${params.campaignId}/${params.contentPieceId}-narration-avatar-voice.wav`;
        const { error: narrationUploadError } = await params.db.storage
          .from(SCENE_EDIT_OUTPUT_BUCKET)
          .upload(narrationStoragePath, audioBuffer, { contentType: "audio/wav", upsert: true });
        if (narrationUploadError) throw narrationUploadError;

        const { data: narrationSignedUrl, error: narrationSignedUrlError } = await params.db.storage
          .from(SCENE_EDIT_OUTPUT_BUCKET)
          .createSignedUrl(narrationStoragePath, 60 * 60 * 24 * 7);
        if (narrationSignedUrlError || !narrationSignedUrl?.signedUrl) {
          throw narrationSignedUrlError ?? new Error("Não consegui gerar o link da narração com voz clonada.");
        }

        plan.audioUrl = narrationSignedUrl.signedUrl;
        plan.audioDurationMs = narration.durationSeconds * 1000;
      }
    } catch {
      // Defensivo: nunca deixa a troca de cena falhar por causa da
      // narração — a cena vira avatar do mesmo jeito, só continua narrada
      // pela voz genérica de antes.
    }
  }

  const { videoId } = await avatarProvider.generateAvatarVideo({
    avatarId: brand.avatar_look_id,
    script: sanitizeNarrationText(segment.text),
    voiceLocale: "pt-BR",
    aspectRatio: "9:16",
  });

  const { videoUrl, durationSeconds } = await pollUntilDone(avatarProvider, videoId);
  if (!videoUrl) throw new Error("HeyGen concluiu sem devolver nenhum vídeo.");

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) throw new Error(`Falha ao baixar o clipe do avatar (${videoResponse.status}).`);
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  const storagePath = `${brand.organization_id}/${params.campaignId}/${params.contentPieceId}-scene-${params.sceneIndex}-avatar.mp4`;
  const { error: uploadError } = await params.db.storage
    .from(SCENE_EDIT_OUTPUT_BUCKET)
    .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });
  if (uploadError) throw uploadError;

  const { data: signedUrlData, error: signedUrlError } = await params.db.storage
    .from(SCENE_EDIT_OUTPUT_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (signedUrlError || !signedUrlData?.signedUrl) throw signedUrlError ?? new Error("Não consegui gerar o link do clipe do avatar.");

  // ★ Mesmo critério de `replaceVideoSceneWithAi` (Veo) — nunca estica a
  // cena além do slot original, só encurta se o clipe do avatar for mais
  // curto (`reconcilePlanTimeline` cobre a sobra na última cena).
  videoSources[params.sceneIndex] = {
    ...existing,
    url: signedUrlData.signedUrl,
    assetType: "avatar",
    lengthSeconds: Math.min(existing.lengthSeconds, durationSeconds ?? existing.lengthSeconds),
    generationPrompt: segment.text,
  };

  reconcilePlanTimeline(videoSources, plan.audioDurationMs / 1000);
  await persistPlan(params.db, params.contentPieceId, plan);
}

export interface ReplaceVideoSceneWithUploadParams extends SceneEditParams {
  url: string;
  assetType: "video" | "image";
}

/**
 * Substitui 1 cena por um arquivo enviado pelo próprio usuário (já
 * persistido em Storage pela Server Action — esta função só grava a
 * referência no plano). ★ Limitação conhecida: sem inspecionar a duração
 * real do arquivo enviado (exigiria um passo de ffprobe, fora de escopo),
 * `lengthSeconds` do slot é mantido como estava — um vídeo enviado mais
 * curto que o slot pode congelar no último frame no render final.
 */
export async function replaceVideoSceneWithUpload(params: ReplaceVideoSceneWithUploadParams): Promise<void> {
  await applySceneCandidate({ ...params, url: params.url, assetType: params.assetType });
}

/** Remove 1 cena do plano — nunca a última restante (não dá pra ter um vídeo sem nenhuma cena). Sobra de duração vai pra última cena (`reconcilePlanTimeline`), a trilha de vídeo nunca fica mais curta que a narração. */
export async function deleteVideoScene(params: SceneEditParams): Promise<void> {
  const { videoSources, plan } = await loadPendingPlan(params.db, params.contentPieceId);
  requireScene(videoSources, params.sceneIndex);

  if (videoSources.length <= 1) {
    throw new Error("Não é possível remover a última cena do vídeo.");
  }

  videoSources.splice(params.sceneIndex, 1);
  reconcilePlanTimeline(videoSources, plan.audioDurationMs / 1000);
  await persistPlan(params.db, params.contentPieceId, plan);
}
