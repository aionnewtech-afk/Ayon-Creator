import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ensureSufficientCredits } from "../billing/credit-gate";
import { resolveLlmProvider } from "../providers/provider-gateway";
import type { VideoRenderSceneSource } from "../providers/video-render-provider";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { ContentVersionRepository } from "../repositories/content-version.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";
import { narrateVideoContentPiece } from "./video-pipeline-narrate";
import { resolveVisualBrief } from "./resolve-visual-brief";
import { rewriteScriptForDuration } from "./rewrite-script-for-duration";
import { selectVideoScenes } from "./video-pipeline-scenes";
import type { ScriptSegment } from "./segment-script";
import { MissingScriptError } from "./video-pipeline-trigger";
import { renderVideoContentPiece } from "./video-pipeline-render";
import { completeVideoPipelineSuccess, completeVideoPipelineFailure, type RenderedScenePlan } from "./video-pipeline-complete";

const VIDEO_GENERATION_TRIGGER_REASON = "video_generation";
const CONTENT_OUTPUT_BUCKET = "content-output";
/** Mesmo TTL de `video-pipeline-narrate.ts` — a narração reaberta pode ficar em revisão por dias. */
const AUDIO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface PendingVideoScenePlan {
  audioUrl: string;
  audioDurationMs: number;
  voiceProviderKey: string;
  videoSources: VideoRenderSceneSource[];
  mediaProviderKey: string;
  segments: ScriptSegment[];
  /** ★ Achado real (pedido direto do usuário — "deixar opcional que o vídeo tenha a logo ou não"): decidido na hora de planejar, só usado de verdade no render (`approveVideoScenePlan`) — precisa sobreviver entre as 2 etapas. */
  includeLogo?: boolean;
  /** ★ Achado real (pedido direto do usuário — "marca d'água com o insta ou nome da empresa"): mesmo espírito de `includeLogo` — decidido no planejamento, usado no render. */
  watermarkText?: string;
  /** ★ Achado real (pedido direto do usuário — "incluir título de capa"): texto já resolvido (`resolveVisualBrief.shortTitle`, mesmo título curto usado nas fotos da campanha, ou o texto que o usuário digitou por conta própria) — ausente/`null` não adiciona nada. */
  coverTitle?: string | null;
  /** ★ Achado real (pedido direto do usuário — "não tem a opção de escolher... o formato" do título): posição do bloco — ausente/`"center"` mantém o comportamento de sempre. */
  coverTitlePosition?: "top" | "center" | "bottom" | null;
}

export interface TriggerVideoScenePlanningParams {
  /** Client de sessão (RLS) — grava content_pieces/pipeline_runs. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve provider_configs/checa o portão de crédito. */
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  /** ★ Missão 12 — mesmo princípio de `triggerVideoGeneration`; gravado em `pipeline_runs.actor_user_id`. */
  actorUserId: string;
  campaignId: string;
  tier: ProviderTier;
  contentPieceId: string;
  /** ★ Achado real (pedido direto do usuário — "eu quero poder escolher a duração do vídeo"): reescreve o roteiro (LLM) pra caber nesse tempo ANTES de narrar — a duração final é 100% derivada do tamanho do texto, nunca cortada/esticada depois. Ausente mantém o roteiro como está. */
  targetDurationSeconds?: number;
  /** ★ Achado real (pedido direto do usuário — "a quantidade média de cenas"): repassado direto pra `selectVideoScenes` — ausente cai no padrão de sempre (cortes rápidos, `MAX_CLIP_SECONDS`). */
  avgSceneSeconds?: number;
  /** ★ Achado real (pedido direto do usuário — "deixar opcional que o vídeo tenha a logo ou não"): guardado no plano, só usado de verdade no render (`approveVideoScenePlan`). */
  includeLogo?: boolean;
  /** ★ Achado real (pedido direto do usuário — "marca d'água com o insta ou nome da empresa... sutil e em algum dos cantos"): guardado no plano, só usado de verdade no render. */
  watermarkText?: string;
  /** ★ Achado real (pedido direto do usuário — "incluir título de capa... quero que o vídeo seja bem blogueiro TikTok"): quando `true` e `coverTitleText` ausente, resolve `resolveVisualBrief.shortTitle` (mesmo título curto já usado nas fotos da campanha) e guarda no plano. */
  includeCoverTitle?: boolean;
  /** ★ Achado real (pedido direto do usuário — "não tem a opção de escolher o que colocar no título"): texto digitado pelo usuário — quando presente, SEMPRE vence o título sugerido automaticamente (nunca precisa esperar o brief resolver pra decidir o que aparece). */
  coverTitleText?: string;
  /** ★ Achado real (pedido direto do usuário — "não tem... o formato"): posição do bloco de título — ausente cai no padrão de sempre (centro). */
  coverTitlePosition?: "top" | "center" | "bottom";
}

/**
 * ★ Achado real (pedido direto do usuário — "será se não era bom a gente
 * aprovar o prompt antes de gerar o vídeo? estamos andando em círculos"):
 * narra + escolhe as cenas (`narrateVideoContentPiece`/`selectVideoScenes`,
 * nenhuma lógica nova) e PARA aqui — o render caro (Shotstack) só acontece
 * depois que o usuário revisar o plano (`content_pieces.pending_scene_plan`,
 * texto de cada trecho + a cena escolhida) e aprovar
 * (`approveVideoScenePlan`, mesmo arquivo).
 *
 * ★ Achado real de arquitetura: o pipeline de vídeo até aqui era 100%
 * orquestrado pelo n8n (fora deste repositório) — narrate→scenes→render→
 * complete chamados automaticamente em sequência, sem ponto de pausa.
 * Inserir uma aprovação humana no meio dessa cadeia exigiria editar o
 * workflow do n8n diretamente (sem acesso a partir daqui). Por isso este
 * fluxo revisável roda os passos diretamente, síncrono, sem n8n —
 * reaproveitando 100% das mesmas funções do Asset Engine, só trocando quem
 * orquestra a sequência. Mesmo princípio de crédito de sempre (Fluxo 6):
 * `ensureSufficientCredits` aqui é só uma checagem, a cobrança real
 * (`recordConsumption`) só acontece depois do render aprovado, em
 * `approveVideoScenePlan`.
 */
export async function triggerVideoScenePlanning(params: TriggerVideoScenePlanningParams): Promise<void> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const pipelineRunRepository = new PipelineRunRepository(params.db);

  const primaryPiece = await contentPieceRepository.findPrimaryByCampaignId(params.campaignId);
  if (!primaryPiece?.script) {
    throw new MissingScriptError();
  }

  await ensureSufficientCredits({
    serviceRoleDb: params.serviceRoleDb,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    triggerReason: VIDEO_GENERATION_TRIGGER_REASON,
    tier: params.tier,
  });

  await contentPieceRepository.update(params.contentPieceId, { status: "generating" });

  const pipelineRun = await pipelineRunRepository.create({
    entity_type: "content_piece",
    entity_id: params.contentPieceId,
    engine: "asset_engine",
    status: "running",
    actor_user_id: params.actorUserId,
  });

  try {
    // ★ Achado real (pedido direto do usuário — "eu quero poder escolher a
    // duração do vídeo"): reescreve o roteiro ANTES de narrar — a duração
    // final é derivada do tamanho do texto, nunca ajustada depois. Grava de
    // volta na própria peça "Roteiro" (mesmo texto que a tela de revisão já
    // mostra/deixa editar manualmente) — nunca uma cópia paralela.
    if (params.targetDurationSeconds) {
      await pipelineRunRepository.update(pipelineRun.id, { stage: "rewriting_script" });
      const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
      const rewritten = await rewriteScriptForDuration({
        script: primaryPiece.script,
        targetDurationSeconds: params.targetDurationSeconds,
        llmProvider,
      });
      await contentPieceRepository.update(primaryPiece.id, { script: rewritten });
    }

    const narrateResult = await narrateVideoContentPiece({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      contentPieceId: params.contentPieceId,
    });

    await pipelineRunRepository.update(pipelineRun.id, { stage: "selecting_scenes" });

    const scenesResult = await selectVideoScenes({
      avgSceneSeconds: params.avgSceneSeconds,
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      totalDurationMs: narrateResult.durationMs,
      campaignId: params.campaignId,
      contentPieceId: params.contentPieceId,
    });

    // ★ Achado real (pedido direto do usuário — "não tem a opção de
    // escolher o que colocar no título"): texto digitado pelo usuário sempre
    // vence — só cai no título sugerido automaticamente (reaproveitando o
    // MESMO título curto já usado nas fotos da campanha, `resolveVisualBrief`,
    // cacheado em `campaigns.visual_brief` — só chama o LLM na 1ª vez de
    // qualquer peça da campanha, vídeo ou foto) quando o usuário não digitou
    // nada por conta própria.
    let coverTitle: string | null = params.coverTitleText?.trim() || null;
    if (!coverTitle && params.includeCoverTitle) {
      const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
      const visualBrief = await resolveVisualBrief(params.db, params.campaignId, llmProvider);
      coverTitle = visualBrief.shortTitle || null;
    }

    const plan: PendingVideoScenePlan = {
      audioUrl: narrateResult.audioUrl,
      audioDurationMs: narrateResult.durationMs,
      voiceProviderKey: narrateResult.voiceProviderKey,
      videoSources: scenesResult.videoSources,
      mediaProviderKey: scenesResult.mediaProviderKey,
      segments: scenesResult.segments,
      includeLogo: params.includeLogo,
      watermarkText: params.watermarkText,
      coverTitle,
      coverTitlePosition: params.coverTitlePosition,
    };

    await contentPieceRepository.update(params.contentPieceId, {
      status: "scenes_ready_for_review",
      pending_scene_plan: plan as unknown as Record<string, unknown>,
    });
    await pipelineRunRepository.update(pipelineRun.id, { stage: "scenes_awaiting_approval" });
  } catch (error) {
    await contentPieceRepository.update(params.contentPieceId, { status: "failed", pending_scene_plan: null });
    await pipelineRunRepository.update(pipelineRun.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}

export interface ApproveVideoScenePlanParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  campaignId: string;
  contentPieceId: string;
  tier: ProviderTier;
}

export class MissingScenePlanError extends Error {
  constructor() {
    super("Essa peça não tem um plano de cenas pendente — gere um plano antes de aprovar.");
    this.name = "MissingScenePlanError";
  }
}

/**
 * Aprova o plano pendente (`content_pieces.pending_scene_plan`) e roda o
 * render de verdade — `renderVideoContentPiece`/`completeVideoPipelineSuccess`
 * inalterados (mesma cobrança em crédito, mesma `content_versions`, mesmo
 * `pipeline_runs.status = completed` de sempre). `pending_scene_plan` é
 * limpo depois — só existe entre planejar e aprovar/rejeitar.
 */
export async function approveVideoScenePlan(params: ApproveVideoScenePlanParams): Promise<void> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const pipelineRunRepository = new PipelineRunRepository(params.db);

  const piece = await contentPieceRepository.findById(params.contentPieceId);
  const plan = piece?.pending_scene_plan as unknown as PendingVideoScenePlan | null;
  if (piece?.status !== "scenes_ready_for_review" || !plan) {
    throw new MissingScenePlanError();
  }

  const pipelineRun = await pipelineRunRepository.findLatestByEntity("content_piece", params.contentPieceId);
  if (!pipelineRun) throw new MissingScenePlanError();

  try {
    await pipelineRunRepository.update(pipelineRun.id, { stage: "rendering" });

    const renderResult = await renderVideoContentPiece({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      contentPieceId: params.contentPieceId,
      audioUrl: plan.audioUrl,
      videoSources: plan.videoSources,
      includeLogo: plan.includeLogo,
      watermarkText: plan.watermarkText,
      coverTitle: plan.coverTitle,
      coverTitlePosition: plan.coverTitlePosition,
    });

    await completeVideoPipelineSuccess({
      serviceRoleDb: params.serviceRoleDb,
      organizationId: params.organizationId,
      contentPieceId: params.contentPieceId,
      pipelineRunId: pipelineRun.id,
      tier: params.tier,
      videoStoragePath: renderResult.videoStoragePath,
      voiceProviderKey: plan.voiceProviderKey,
      mediaProviderKey: plan.mediaProviderKey,
      videoRenderProviderKey: renderResult.videoRenderProviderKey,
      scenePlan: {
        videoSources: plan.videoSources,
        includeLogo: plan.includeLogo,
        watermarkText: plan.watermarkText,
        coverTitle: plan.coverTitle,
        coverTitlePosition: plan.coverTitlePosition,
        segments: plan.segments,
      },
    });

    await contentPieceRepository.update(params.contentPieceId, { pending_scene_plan: null });
  } catch (error) {
    await completeVideoPipelineFailure({
      serviceRoleDb: params.serviceRoleDb,
      contentPieceId: params.contentPieceId,
      pipelineRunId: pipelineRun.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    await contentPieceRepository.update(params.contentPieceId, { pending_scene_plan: null });
    throw error;
  }
}

export class ReopenNotSupportedError extends Error {
  constructor() {
    super("Só dá pra reabrir a edição de cenas de um vídeo já gerado.");
    this.name = "ReopenNotSupportedError";
  }
}

export class MissingScenePlanForReopenError extends Error {
  constructor() {
    super(
      "Não encontrei as cenas desse vídeo pra reabrir a edição (foi gerado antes desse recurso existir) — gere o vídeo de novo do zero se quiser editar.",
    );
    this.name = "MissingScenePlanForReopenError";
  }
}

export interface ReopenVideoScenePlanParams {
  /** Client de sessão (RLS) — lê/grava content_pieces, lê Storage. */
  db: SupabaseClient<Database>;
  organizationId: string;
  contentPieceId: string;
}

/**
 * ★ Achado real (pedido direto do usuário — "eu havia aprovado um vídeo e
 * depois queria uma cena e não consegui mais voltar, criou outro"): uma vez
 * que `approveVideoScenePlan` renderiza e limpa `pending_scene_plan`, TODA
 * ação de edição de cena (trocar/cortar/reordenar/excluir/baixar .zip) fica
 * inacessível pra sempre — a única forma de mexer em qualquer coisa era
 * gerar um plano NOVO do zero (`triggerVideoScenePlanning`, nova busca de
 * cena, narração do roteiro atual), descartando o corte já aprovado em vez
 * de ajustá-lo. Esta função reconstrói o MESMO `pending_scene_plan` de antes
 * a partir do que `completeVideoPipelineSuccess` já persiste em
 * `content_versions.generation_metadata` (`scene_plan` + `voice_provider_key`/
 * `media_provider_key` — mesmo dado que `swapVideoVoice` já lê) e volta o
 * status pra `scenes_ready_for_review`, reabrindo TODA a tela de edição de
 * cenas existente sem nenhuma UI nova. A narração em si nunca é re-sintetizada
 * (custaria crédito de novo à toa) — o storage path é determinístico
 * (`${organizationId}/${campaignId}/${contentPieceId}-narration.mp3`, mesmo
 * usado por `narrateVideoContentPiece`/`swapVideoVoice`), só assina uma URL
 * nova pro arquivo que já existe.
 */
export async function reopenVideoScenePlanForEditing(params: ReopenVideoScenePlanParams): Promise<void> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const contentVersionRepository = new ContentVersionRepository(params.db);

  const piece = await contentPieceRepository.findById(params.contentPieceId);
  if (!piece || piece.format !== "video") throw new ReopenNotSupportedError();
  if (piece.status !== "ready_for_review" && piece.status !== "approved") throw new ReopenNotSupportedError();

  const latestVersion = await contentVersionRepository.findLatestByContentPieceId(params.contentPieceId);
  const metadata = latestVersion?.generation_metadata as {
    scene_plan?: RenderedScenePlan;
    voice_provider_key?: string;
    media_provider_key?: string;
  } | null;
  const scenePlan = metadata?.scene_plan;
  if (!latestVersion || !scenePlan) throw new MissingScenePlanForReopenError();

  const storagePath = `${params.organizationId}/${piece.campaign_id}/${params.contentPieceId}-narration.mp3`;
  const { data: signed, error: signError } = await params.db.storage
    .from(CONTENT_OUTPUT_BUCKET)
    .createSignedUrl(storagePath, AUDIO_SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) throw signError ?? new MissingScenePlanForReopenError();

  const audioDurationMs = Math.round(scenePlan.videoSources.reduce((sum, source) => sum + source.lengthSeconds, 0) * 1000);

  const plan: PendingVideoScenePlan = {
    audioUrl: signed.signedUrl,
    audioDurationMs,
    voiceProviderKey: metadata?.voice_provider_key ?? "unknown",
    videoSources: scenePlan.videoSources,
    mediaProviderKey: metadata?.media_provider_key ?? "unknown",
    segments: scenePlan.segments ?? [],
    includeLogo: scenePlan.includeLogo,
    watermarkText: scenePlan.watermarkText,
    coverTitle: scenePlan.coverTitle,
    coverTitlePosition: scenePlan.coverTitlePosition,
  };

  await contentPieceRepository.update(params.contentPieceId, {
    status: "scenes_ready_for_review",
    pending_scene_plan: plan as unknown as Record<string, unknown>,
  });
}
