import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ensureSufficientCredits } from "../billing/credit-gate";
import { resolveLlmProvider } from "../providers/provider-gateway";
import type { VideoRenderSceneSource } from "../providers/video-render-provider";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";
import { narrateVideoContentPiece } from "./video-pipeline-narrate";
import { rewriteScriptForDuration } from "./rewrite-script-for-duration";
import { selectVideoScenes } from "./video-pipeline-scenes";
import type { ScriptSegment } from "./segment-script";
import { MissingScriptError } from "./video-pipeline-trigger";
import { renderVideoContentPiece } from "./video-pipeline-render";
import { completeVideoPipelineSuccess, completeVideoPipelineFailure } from "./video-pipeline-complete";

const VIDEO_GENERATION_TRIGGER_REASON = "video_generation";

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

    const plan: PendingVideoScenePlan = {
      audioUrl: narrateResult.audioUrl,
      audioDurationMs: narrateResult.durationMs,
      voiceProviderKey: narrateResult.voiceProviderKey,
      videoSources: scenesResult.videoSources,
      mediaProviderKey: scenesResult.mediaProviderKey,
      segments: scenesResult.segments,
      includeLogo: params.includeLogo,
      watermarkText: params.watermarkText,
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
