"use server";

import { revalidatePath } from "next/cache";
import {
  AuditRepository,
  BrandBrainRepository,
  CampaignRepository,
  ContentPackageRepository,
  ContentPieceRepository,
  ContentVersionRepository,
  InactiveSubscriptionError,
  InsufficientCreditsError,
  LearningSignalRepository,
  MissingScenePlanForVoiceSwapError,
  MissingScriptError,
  N8nDispatchError,
  type PhotoVisualOverrides,
  PipelineRunRepository,
  AvatarNotReadyError,
  VoiceSwapNotSupportedError,
  applySceneCandidate,
  approveVideoScenePlan,
  deleteVideoScene,
  duplicateVideoScene,
  ensureSufficientCredits,
  generateAvatarVideoForContentPiece,
  generateTextPiece,
  hasMinimumRole,
  knownFieldsFromProfile,
  learnedPreferencesTextFromProfile,
  listAvatarVoicesForOrganization,
  logger,
  recordConsumption,
  replaceVideoSceneWithAi,
  replaceVideoSceneWithAvatar,
  replaceVideoSceneWithUpload,
  reorderVideoScenes,
  searchAvatarBackgroundImages,
  searchSceneCandidates,
  setSceneDuration,
  suggestSceneAiPrompt,
  swapVideoVoice,
  triggerPhotoGeneration,
  triggerVideoScenePlanning,
} from "@ayon/core";
import { buildContentPackage, PackageNotReadyError } from "@ayon/core/src/asset-engine/build-content-package";
import { buildScenePackage } from "@ayon/core/src/asset-engine/build-scene-clips-package";
import type { CampaignStatus, ContentPieceFormat, ContentPieceStatus, Database, ProductionMode } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const CONTENT_OUTPUT_BUCKET = "content-output";
const ASSET_GENERATION_TRIGGER_REASON = "asset_generation";
const FRIENDLY_ERROR = "Não consegui fazer isso agora. Pode tentar de novo em instantes?";

/** Hardening (Missão H1, docs/hardening-plan.md item 5.3) — limite e tipos aceitos para upload de own_media (vídeo/stories/carrossel/thumbnail). */
const MAX_OWN_MEDIA_SIZE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_OWN_MEDIA_MIME_PREFIXES = ["image/", "video/"];

export interface ContentPieceView {
  id: string;
  format: ContentPieceFormat;
  productionMode: ProductionMode | null;
  isPrimary: boolean;
  script: string | null;
  brandRationale: string | null;
  status: ContentPieceStatus;
  /** Signed URL da última content_version, quando existir (own_media enviado ou vídeo já gerado — Missão 9). */
  mediaUrl?: string;
  /** ★ Missão 11 (arch. §14.4.2) — todas as opções da rodada mais recente, quando `licensed_stock_photo` gerou mais de 1 candidato. Vazio/ausente para todo outro caso (comportamento de sempre, um preview único). */
  mediaOptions?: { versionId: string; mediaUrl: string }[];
  /** ★ Achado real (pedido direto do usuário — "o carrossel só gera um e é mal feito") — URLs assinadas de TODAS as lâminas de um carrossel real, em ordem. Ausente para qualquer outro formato. */
  slideMediaUrls?: string[];
  /** ★ Missão 11 — versão escolhida pelo usuário entre várias opções (`content_pieces.selected_version_id`). */
  selectedVersionId?: string | null;
  /** ★ Achado real (pedido direto do usuário — "mostrar o prompt exato usado em cada peça gerada"): prompt/termo de busca exato da versão exibida (`mediaUrl`). Ausente pra peças de texto/vídeo (o roteiro já é o "prompt" visível). */
  generationPrompt?: string;
  /** ★ Mesmo achado, versão carrossel — 1 prompt por lâmina, mesma ordem de `slideMediaUrls`. */
  slideGenerationPrompts?: string[];
  /** ★ Missão 11 (arch. §14.9) — progresso granular do pipeline assíncrono, presente enquanto `status === "generating"` e também em `"failed"` (para indicar em qual etapa parou). */
  pipelineStage?: string | null;
  pipelineProgressPercent?: number | null;
  pipelineEstimatedRemainingSeconds?: number | null;
  /** ★ Achado real (pedido direto do usuário — "será se não era bom a gente aprovar o prompt antes de gerar o vídeo?"): plano de vídeo pendente (áudio + cenas + texto de cada trecho), presente só quando `status === "scenes_ready_for_review"`. */
  pendingScenePlan?: {
    audioUrl: string;
    segments: { text: string; searchQuery: string; sceneType?: "real" | "ai" | "brand"; realSourceHint?: string }[];
    scenes: {
      url: string;
      startSeconds: number;
      lengthSeconds: number;
      assetType?: "video" | "image" | "avatar";
      segmentIndex?: number;
      generationPrompt?: string;
    }[];
  };
  /** ★ Achado real (pedido direto do usuário — item 7, editor de Stories): ajustes atuais (texto/fonte/logo) — pré-preenche o painel de edição ao reabrir, em vez de sempre começar em branco. */
  visualOverrides?: PhotoVisualOverrides | null;
}

export interface ContentPieceActionResult {
  ok: boolean;
  error?: string;
  blockedReason?: "inactive_subscription" | "insufficient_credits";
  contentPiece?: ContentPieceView;
  packageReady?: boolean;
  downloadUrl?: string;
}

function toView(piece: Database["public"]["Tables"]["content_pieces"]["Row"]): ContentPieceView {
  return {
    id: piece.id,
    format: piece.format,
    productionMode: piece.production_mode,
    isPrimary: piece.is_primary,
    script: piece.script,
    brandRationale: piece.brand_rationale,
    status: piece.status,
    selectedVersionId: piece.selected_version_id,
    visualOverrides: piece.visual_overrides as PhotoVisualOverrides | null,
  };
}

/**
 * Mesmo que `toView`, mas também assina a URL da mídia — usado onde a UI
 * precisa mostrar o preview (upload manual já enviado, vídeo gerado
 * automaticamente — Missão 9, ou foto gerada automaticamente — Missão 11).
 *
 * ★ Missão 11 (arch. §14.4.2): quando existe mais de 1 `content_versions` e
 * nenhuma ainda foi escolhida (`selected_version_id` nulo), assina a URL de
 * **todas** as opções (`mediaOptions`) para a grade de escolha — `mediaUrl`
 * continua refletendo só a versão escolhida (ou a mais recente, comportamento
 * de sempre) quando há apenas 1 opção ou já houve escolha.
 */
async function toViewWithMedia(
  db: Awaited<ReturnType<typeof createClient>>,
  piece: Database["public"]["Tables"]["content_pieces"]["Row"],
): Promise<ContentPieceView> {
  const view = toView(piece);
  if (piece.production_mode === "text_only") return view;

  // ★ Achado real (pedido direto do usuário — aprovar o plano antes de
  // renderizar): sem `content_versions` nenhuma ainda (nada renderizou),
  // então esse status precisa sair aqui, antes do `if (versions.length ===
  // 0) return view;` abaixo esconder o plano.
  if (piece.status === "scenes_ready_for_review" && piece.pending_scene_plan) {
    const plan = piece.pending_scene_plan as unknown as {
      audioUrl: string;
      segments: { text: string; searchQuery: string; sceneType?: "real" | "ai" | "brand"; realSourceHint?: string }[];
      videoSources: {
        url: string;
        startSeconds: number;
        lengthSeconds: number;
        assetType?: "video" | "image" | "avatar";
        segmentIndex?: number;
        generationPrompt?: string;
      }[];
    };
    view.pendingScenePlan = {
      audioUrl: plan.audioUrl,
      segments: plan.segments,
      scenes: plan.videoSources.map((s) => ({
        url: s.url,
        startSeconds: s.startSeconds,
        lengthSeconds: s.lengthSeconds,
        assetType: s.assetType,
        segmentIndex: s.segmentIndex,
        generationPrompt: s.generationPrompt,
      })),
    };
    return view;
  }

  if (piece.status === "generating" || piece.status === "failed") {
    const pipelineRunRepository = new PipelineRunRepository(db);
    const run = await pipelineRunRepository.findLatestByEntity("content_piece", piece.id);
    if (run) {
      view.pipelineStage = run.stage;
      view.pipelineProgressPercent = run.progress_percent;
      view.pipelineEstimatedRemainingSeconds = run.estimated_remaining_seconds;
    }
  }

  const contentVersionRepository = new ContentVersionRepository(db);
  const versions = await contentVersionRepository.findByContentPieceId(piece.id);
  if (versions.length === 0) return view;

  const selected = piece.selected_version_id ? versions.find((v) => v.id === piece.selected_version_id) : undefined;
  const primary = selected ?? versions[0]!; // versions já vem ordenado por version_number desc (mais recente primeiro)

  const primaryUrl = primary.output_storage_path
    ? (await db.storage.from(CONTENT_OUTPUT_BUCKET).createSignedUrl(primary.output_storage_path, 3600)).data?.signedUrl
    : undefined;

  // ★ Achado real (pedido direto do usuário — "o carrossel só gera um e é
  // mal feito") — carrossel real vem em `generation_metadata.slide_storage_paths`
  // (photo-pipeline-complete.ts), nunca em `mediaOptions` (isso é "escolha 1
  // entre várias", carrossel é "mostre todas juntas").
  const metadata = primary.generation_metadata as {
    slide_storage_paths?: string[];
    generation_prompt?: string;
    slide_generation_prompts?: string[];
  } | null;
  const slidePaths = metadata?.slide_storage_paths;
  const slideMediaUrls = slidePaths?.length
    ? (
        await Promise.all(
          slidePaths.map(async (path) => (await db.storage.from(CONTENT_OUTPUT_BUCKET).createSignedUrl(path, 3600)).data?.signedUrl),
        )
      ).filter((url): url is string => Boolean(url))
    : undefined;
  const generationPrompt = metadata?.generation_prompt;
  const slideGenerationPrompts = metadata?.slide_generation_prompts;

  if (versions.length <= 1 || piece.selected_version_id) {
    return { ...view, mediaUrl: primaryUrl, slideMediaUrls, generationPrompt, slideGenerationPrompts };
  }

  const mediaOptions = await Promise.all(
    versions.map(async (v) => {
      if (!v.output_storage_path) return null;
      const { data: signed } = await db.storage.from(CONTENT_OUTPUT_BUCKET).createSignedUrl(v.output_storage_path, 3600);
      return signed?.signedUrl ? { versionId: v.id, mediaUrl: signed.signedUrl } : null;
    }),
  );

  return { ...view, mediaUrl: primaryUrl, mediaOptions: mediaOptions.filter((o) => o !== null), generationPrompt };
}

/**
 * Emite um `learning_signal` (Fluxo 4 → Fluxo 8, Missão 8) — nunca bloqueia a
 * ação principal do usuário (aprovar/rejeitar/editar) se a gravação falhar,
 * mesmo espírito de "falha parcial nunca bloqueia o essencial" já usado em
 * outras partes do Asset Engine.
 */
async function emitLearningSignal(
  db: Awaited<ReturnType<typeof createClient>>,
  input: { brandId: string; contentPieceId: string; signalType: "approved" | "rejected" | "edited"; payload: Record<string, unknown> },
): Promise<void> {
  const learningSignalRepository = new LearningSignalRepository(db);
  try {
    await learningSignalRepository.create({
      brand_id: input.brandId,
      content_piece_id: input.contentPieceId,
      signal_type: input.signalType,
      payload: input.payload,
    });
  } catch (error) {
    logger.warn("learning_engine.signal_emit_failed", {
      contentPieceId: input.contentPieceId,
      signalType: input.signalType,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Salva edição manual de uma peça textual — CAMP-5, sem custo em créditos (não chama LLM). */
export async function editContentPieceAction(contentPieceId: string, script: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode editar peças." };
  }

  const db = await createClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const campaignRepository = new CampaignRepository(db);

  const existing = await contentPieceRepository.findById(contentPieceId);
  if (!existing) return { ok: false, error: FRIENDLY_ERROR };

  const updated = await contentPieceRepository.update(contentPieceId, { script });

  const campaign = await campaignRepository.findById(existing.campaign_id);
  if (campaign) {
    await emitLearningSignal(db, {
      brandId: campaign.brand_id,
      contentPieceId,
      signalType: "edited",
      payload: { format: existing.format, previousScript: existing.script, newScript: script },
    });
  }

  revalidatePath("/criar-campanha");
  return { ok: true, contentPiece: toView(updated) };
}

/** Regenera uma peça textual (nova chamada ao LLM Provider, novo custo em créditos) — CAMP-5. */
export async function regenerateContentPieceAction(contentPieceId: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode regenerar peças." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const campaignRepository = new CampaignRepository(db);
  const brandBrainRepository = new BrandBrainRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.production_mode !== "text_only") {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  const campaign = await campaignRepository.findById(piece.campaign_id);
  if (!campaign) return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    const { costCredits } = await ensureSufficientCredits({
      serviceRoleDb,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      triggerReason: ASSET_GENERATION_TRIGGER_REASON,
      tier,
    });

    const profile = await brandBrainRepository.findByBrandId(session.brand.id);
    const knownFields = knownFieldsFromProfile(profile);
    const learnedPreferencesText = learnedPreferencesTextFromProfile(profile);
    const strategySummary = campaign.strategy_summary as { consolidated_strategy?: string; rationale?: string } | null;

    await generateTextPiece({
      db,
      serviceRoleDb,
      tier,
      contentPieceId,
      format: piece.format,
      brandName: session.brand.name,
      knownFields,
      learnedPreferencesText,
      consolidatedStrategy: strategySummary?.consolidated_strategy ?? "",
      strategyRationale: strategySummary?.rationale ?? "",
    });

    await recordConsumption({
      serviceRoleDb,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      costCredits,
      contentPieceId,
      description: `Peça de conteúdo (${piece.format}) — regenerada — ${session.brand.name}`,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? toView(updated) : undefined };
  } catch (error) {
    if (error instanceof InactiveSubscriptionError) {
      return {
        ok: false,
        blockedReason: "inactive_subscription",
        error: "Sua assinatura não está ativa. Reative o plano em Configurações para continuar.",
      };
    }
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        blockedReason: "insufficient_credits",
        error: "Créditos insuficientes para regenerar essa peça. Compre mais créditos em Configurações.",
      };
    }
    logger.error("asset_engine.regenerate_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * ★ Achado real (pedido direto do usuário — "será se não era bom a gente
 * aprovar o prompt antes de gerar o vídeo? estamos andando em círculos"):
 * dispara só narração + seleção de cenas (`triggerVideoScenePlanning`,
 * síncrono — nunca dispara o n8n, ver comentário no próprio arquivo sobre o
 * porquê) e deixa a peça em `scenes_ready_for_review`, com o plano visível
 * pra revisão. O render de verdade só acontece depois de
 * `approveVideoScenePlanAction`, abaixo.
 */
export interface GenerateVideoOptions {
  /** ★ Achado real (pedido direto do usuário — "eu quero poder escolher a duração do vídeo"): reescreve o roteiro pra caber nesse tempo antes de narrar. Ausente mantém o roteiro como está. */
  targetDurationSeconds?: number;
  /** ★ Achado real (pedido direto do usuário — "a quantidade média de cenas"): duração média de cada corte — ausente cai no padrão de sempre (cortes rápidos, ~3s). */
  avgSceneSeconds?: number;
  /** ★ Achado real (pedido direto do usuário — "deixar opcional que o vídeo tenha a logo ou não"): `false` gera sem logo mesmo com uma cadastrada — escolha por geração, nunca um padrão novo da marca. */
  includeLogo?: boolean;
  /** ★ Achado real (pedido direto do usuário — "marca d'água com o insta ou nome da empresa... sutil e em algum dos cantos"): texto opcional (@handle ou nome) sobreposto no vídeo inteiro, discreto, num canto. */
  watermarkText?: string;
}

export async function generateVideoContentPieceAction(
  contentPieceId: string,
  options?: GenerateVideoOptions,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode gerar vídeo." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const campaignRepository = new CampaignRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  // ★ Achado real (pedido direto do usuário — "em que momento ele vai dar a
  // opção de gerar vídeo de avatar?"): `production_mode` deixou de ser fixo
  // pra peça `video` — pode virar `ai_avatar` depois de uma geração por
  // avatar, e o usuário ainda precisa poder voltar pro caminho de banco de
  // vídeo licenciado. Checa o formato (sempre `video`), nunca mais o modo
  // atual.
  if (!piece || piece.format !== "video") {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  const campaign = await campaignRepository.findById(piece.campaign_id);
  if (!campaign) return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    await triggerVideoScenePlanning({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      campaignId: piece.campaign_id,
      tier,
      contentPieceId,
      targetDurationSeconds: options?.targetDurationSeconds,
      avgSceneSeconds: options?.avgSceneSeconds,
      includeLogo: options?.includeLogo,
      watermarkText: options?.watermarkText?.trim() || undefined,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    if (error instanceof InactiveSubscriptionError) {
      return {
        ok: false,
        blockedReason: "inactive_subscription",
        error: "Sua assinatura não está ativa. Reative o plano em Configurações para continuar.",
      };
    }
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        blockedReason: "insufficient_credits",
        error: "Créditos insuficientes para gerar esse vídeo. Compre mais créditos em Configurações.",
      };
    }
    if (error instanceof MissingScriptError) {
      return { ok: false, error: error.message };
    }
    logger.error("asset_engine.video_plan_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * ★ Achado real (pedido direto do usuário — "criar uma opção para trocar
 * somente a voz de um vídeo já gerado, sem precisar refazer todo o
 * processo"): reaproveita as MESMAS cenas/ordem/duração/branding já
 * renderizadas (`content_versions.generation_metadata.scene_plan`) — só
 * re-narra e recompõe. Só existe pro caminho `licensed_stock_video`
 * (avatar tem a voz junto do rosto, ver `VoiceSwapNotSupportedError`).
 */
export async function swapVideoVoiceAction(contentPieceId: string, voiceRef: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode trocar a voz do vídeo." };
  }
  if (!voiceRef.trim()) return { ok: false, error: "Escolha uma voz." };

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await swapVideoVoice({
      db,
      serviceRoleDb,
      tier,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      campaignId: piece.campaign_id,
      contentPieceId,
      voiceRef,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    if (error instanceof InactiveSubscriptionError) {
      return {
        ok: false,
        blockedReason: "inactive_subscription",
        error: "Sua assinatura não está ativa. Reative o plano em Configurações para continuar.",
      };
    }
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        blockedReason: "insufficient_credits",
        error: "Créditos insuficientes para trocar a voz desse vídeo. Compre mais créditos em Configurações.",
      };
    }
    if (error instanceof MissingScriptError || error instanceof MissingScenePlanForVoiceSwapError || error instanceof VoiceSwapNotSupportedError) {
      return { ok: false, error: error.message };
    }
    logger.error("asset_engine.video_voice_swap_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * ★ Achado real (pedido direto do usuário — "em que momento ele vai dar a
 * opção de gerar vídeo de avatar?"): 2ª forma de produzir a peça `video` —
 * síncrona (nunca aprovação em 2 passos como `licensed_stock_video`,
 * porque não existe cena nenhuma pra revisar aqui, só o roteiro que o
 * usuário já vê/edita na tela). Só disponível quando `session.brand.avatar_ready`.
 */
export interface GenerateAvatarVideoOptions {
  voiceId?: string;
  backgroundColorHex?: string;
  outfitPrompt?: string;
  /** ★ Achado real (pedido direto do usuário — "e eu faço isso pelo heygen?"): escolhe um dos looks extras da marca (`brand.avatar_looks`, ângulo/roupa diferente, rosto real) no lugar do look principal. */
  avatarLookId?: string;
  /** ★ Achado real (pedido direto do usuário — "ambientes tipo aeroporto, escritório, praia"): URL de uma foto real de cenário (banco licenciado) — tem prioridade sobre `backgroundColorHex`. */
  backgroundImageUrl?: string;
  /** ★ Achado real (pedido direto do usuário — "eu quero poder escolher a duração do vídeo"): reescreve o roteiro pra caber nesse tempo antes de gerar. Ausente mantém o roteiro como está. */
  targetDurationSeconds?: number;
}

export async function generateAvatarVideoContentPieceAction(
  contentPieceId: string,
  options?: GenerateAvatarVideoOptions,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode gerar vídeo." };
  }
  if (!session.brand.avatar_ready) {
    return { ok: false, error: "O avatar da marca ainda não está pronto." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.format !== "video") {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    await generateAvatarVideoForContentPiece({
      db,
      serviceRoleDb,
      tier,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      campaignId: piece.campaign_id,
      contentPieceId,
      voiceId: options?.voiceId?.trim() || undefined,
      backgroundColorHex: options?.backgroundColorHex?.trim() || undefined,
      backgroundImageUrl: options?.backgroundImageUrl?.trim() || undefined,
      outfitPrompt: options?.outfitPrompt?.trim() || undefined,
      avatarLookId: options?.avatarLookId?.trim() || undefined,
      targetDurationSeconds: options?.targetDurationSeconds,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    if (error instanceof InactiveSubscriptionError) {
      return {
        ok: false,
        blockedReason: "inactive_subscription",
        error: "Sua assinatura não está ativa. Reative o plano em Configurações para continuar.",
      };
    }
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        blockedReason: "insufficient_credits",
        error: "Créditos insuficientes para gerar esse vídeo. Compre mais créditos em Configurações.",
      };
    }
    if (error instanceof MissingScriptError || error instanceof AvatarNotReadyError) {
      return { ok: false, error: error.message };
    }
    logger.error("asset_engine.avatar_video_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface ListAvatarVoicesResult {
  ok: boolean;
  error?: string;
  voices?: { voiceId: string; name: string; gender?: string; language?: string }[];
}

/** Lista as vozes disponíveis na conta HeyGen — usada pra deixar o usuário escolher outra além da clonada padrão, quando ela soar estranha. */
export async function listAvatarVoicesAction(): Promise<ListAvatarVoicesResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };

  const serviceRoleDb = createServiceRoleClient();

  try {
    const voices = await listAvatarVoicesForOrganization({ serviceRoleDb, organizationId: session.organization.id });
    return { ok: true, voices };
  } catch (error) {
    logger.error("asset_engine.avatar_voices_list_failed", { reason: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface BackgroundImageCandidateView {
  id: string;
  previewUrl: string;
  downloadUrl: string;
}

export interface SearchAvatarBackgroundImagesResult {
  ok: boolean;
  error?: string;
  candidates?: BackgroundImageCandidateView[];
}

/**
 * ★ Achado real (pedido direto do usuário — "eu achava que ele seria capaz
 * de criar os vídeos em ambientes tipo aeroporto, escritório, praia"): busca
 * fotos reais de cenário (banco licenciado) pra usar como fundo do vídeo com
 * avatar — devolve várias opções, mesma UX de escolha já usada pra trocar
 * cena de vídeo.
 */
export async function searchAvatarBackgroundImagesAction(query: string): Promise<SearchAvatarBackgroundImagesResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode gerar vídeo." };
  }
  if (!query.trim()) return { ok: false, error: "Digite um termo de busca." };

  const serviceRoleDb = createServiceRoleClient();

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    const candidates = await searchAvatarBackgroundImages({ serviceRoleDb, tier, query: query.trim() });
    if (candidates.length === 0) return { ok: false, error: `Nenhum resultado encontrado para "${query.trim()}".` };

    return {
      ok: true,
      candidates: candidates.map((c) => ({ id: c.id, previewUrl: c.previewUrl, downloadUrl: c.downloadUrl })),
    };
  } catch (error) {
    logger.error("asset_engine.avatar_background_search_failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/**
 * Aprova o plano de cenas pendente e roda o render de verdade
 * (`approveVideoScenePlan` — mesmas `renderVideoContentPiece`/
 * `completeVideoPipelineSuccess` de sempre, cobrança em crédito só aqui).
 */
export async function approveVideoScenePlanAction(contentPieceId: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode aprovar o vídeo." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    await approveVideoScenePlan({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      campaignId: piece.campaign_id,
      contentPieceId,
      tier,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        blockedReason: "insufficient_credits",
        error: "Créditos insuficientes para gerar esse vídeo. Compre mais créditos em Configurações.",
      };
    }
    logger.error("asset_engine.video_approve_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface DownloadScenePackageResult {
  ok: boolean;
  error?: string;
  downloadUrl?: string;
}

/**
 * ★ Achado real (pedido direto do usuário — "baixar todas as cenas e ela
 * fazer a edição, de acordo com as transições que ela quer, ou baixar o
 * vídeo todo de uma vez, já com as transições internas que a gente vai
 * colocar"): alternativa a `approveVideoScenePlanAction` — nunca aprova nem
 * altera a peça, só empacota as cenas atuais (+ narração) num .zip pra
 * edição própria em qualquer editor.
 */
export async function downloadScenePackageAction(contentPieceId: string): Promise<DownloadScenePackageResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode baixar as cenas." };
  }

  const db = await createClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  try {
    const { downloadUrl } = await buildScenePackage({
      db,
      organizationId: session.organization.id,
      campaignId: piece.campaign_id,
      contentPieceId,
    });
    return { ok: true, downloadUrl };
  } catch (error) {
    logger.error("asset_engine.scene_package_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * ★ Achado real (pedido direto do usuário — "opção de excluir/substituir
 * uma cena individual do vídeo"): as 4 ações abaixo editam 1 cena do plano
 * pendente por vez (`content_pieces.pending_scene_plan`), sem regenerar
 * narração nem as outras cenas — sempre exigem `status ===
 * "scenes_ready_for_review"` (mesma guarda das funções do engine).
 */
export interface SceneCandidateView {
  id: string;
  previewUrl: string;
  downloadUrl: string;
  durationSeconds?: number;
}

export interface SearchSceneCandidatesResult {
  ok: boolean;
  error?: string;
  candidates?: SceneCandidateView[];
}

/**
 * ★ Achado real (pedido direto do usuário — "busca de novas cenas só dá uma
 * opção, caso eu não goste queria que quando gerasse pra substituir
 * viessem outras"): busca pura, nunca aplica sozinha — devolve várias
 * opções pra revisão escolher (`applySceneCandidateAction` abaixo aplica a
 * escolhida).
 */
export async function searchSceneCandidatesAction(
  contentPieceId: string,
  sceneIndex: number,
  query: string,
): Promise<SearchSceneCandidatesResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode trocar cenas." };
  }
  if (!query.trim()) return { ok: false, error: "Digite um termo de busca." };

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();

  const piece = await new ContentPieceRepository(db).findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    const candidates = await searchSceneCandidates({ serviceRoleDb, tier, query: query.trim() });
    if (candidates.length === 0) return { ok: false, error: `Nenhum resultado encontrado para "${query.trim()}".` };

    return {
      ok: true,
      candidates: candidates.map((c) => ({
        id: c.id,
        previewUrl: c.previewUrl,
        downloadUrl: c.downloadUrl,
        durationSeconds: c.durationSeconds,
      })),
    };
  } catch (error) {
    logger.error("asset_engine.scene_search_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/** Aplica 1 candidato de busca já escolhido pelo usuário na cena. */
export async function applySceneCandidateAction(
  contentPieceId: string,
  sceneIndex: number,
  downloadUrl: string,
  durationSeconds: number | undefined,
  query: string,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode trocar cenas." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await applySceneCandidate({
      db,
      serviceRoleDb,
      tier,
      campaignId: piece.campaign_id,
      contentPieceId,
      sceneIndex,
      url: downloadUrl,
      assetType: undefined,
      durationSeconds,
      generationPrompt: query,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    logger.error("asset_engine.scene_apply_candidate_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

export interface SuggestSceneAiPromptResult {
  ok: boolean;
  error?: string;
  prompt?: string;
}

/**
 * ★ Achado real (pedido direto do usuário — "a geração da cena por IA tá
 * muito genérica, precisa ter um espaço de prompt sugerido e pra gente
 * editar"): devolve o prompt sugerido pra essa cena SEM gerar nada — a UI
 * mostra num campo editável, o usuário confirma (ou ajusta) antes da
 * geração de verdade.
 */
export async function suggestSceneAiPromptAction(contentPieceId: string, sceneIndex: number): Promise<SuggestSceneAiPromptResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode trocar cenas." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const piece = await new ContentPieceRepository(db).findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    const { prompt } = await suggestSceneAiPrompt({
      db,
      serviceRoleDb,
      tier,
      campaignId: piece.campaign_id,
      contentPieceId,
      sceneIndex,
    });
    return { ok: true, prompt };
  } catch (error) {
    logger.error("asset_engine.scene_ai_prompt_suggest_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/** Substitui 1 cena por uma imagem/vídeo gerado por IA, grounded no trecho do roteiro que essa cena ilustra — `customPrompt` (pedido direto do usuário — prompt "muito genérico") sobrescreve o prompt sugerido/derivado quando o usuário editou o texto. */
export async function generateReplacementSceneAction(
  contentPieceId: string,
  sceneIndex: number,
  customPrompt?: string,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode trocar cenas." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await replaceVideoSceneWithAi({
      db,
      serviceRoleDb,
      tier,
      campaignId: piece.campaign_id,
      contentPieceId,
      sceneIndex,
      customPrompt: customPrompt?.trim() || undefined,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    logger.error("asset_engine.scene_ai_replace_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/**
 * ★ Achado real (pedido direto do usuário — "no vídeo geral que mostra
 * cenas do Pexels, eu queria incluir uma opção de alternar com avatar...
 * vídeos de 2-3 segundos intercalados entre as imagens"): substitui 1 cena
 * por um clipe real do avatar da marca falando o trecho exato que ela
 * ilustra — escolha manual, cena por cena, mesma UX de sempre.
 */
export async function replaceSceneWithAvatarAction(contentPieceId: string, sceneIndex: number): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode trocar cenas." };
  }
  if (!session.brand.avatar_ready) {
    return { ok: false, error: "O avatar da marca ainda não está pronto." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await replaceVideoSceneWithAvatar({
      db,
      serviceRoleDb,
      tier,
      campaignId: piece.campaign_id,
      contentPieceId,
      sceneIndex,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    logger.error("asset_engine.scene_avatar_replace_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/** Substitui 1 cena por um arquivo enviado pelo próprio usuário. */
export async function uploadReplacementSceneAction(
  contentPieceId: string,
  sceneIndex: number,
  formData: FormData,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode trocar cenas." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolhe um arquivo pra enviar." };
  if (file.size > MAX_OWN_MEDIA_SIZE_BYTES) return { ok: false, error: "Esse arquivo é maior que 20MB — tenta um arquivo menor?" };
  const assetType = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
  if (!assetType) return { ok: false, error: "Esse tipo de arquivo não é aceito aqui. Envie uma imagem ou um vídeo." };

  // ★ Achado real (pedido direto do usuário — "incluir a oportunidade de incluir um vídeo e recortar a cena que
  // quero"): a UI de recorte (client-side) manda o ponto escolhido em segundos; sem isso a cena sempre tocava do
  // início do arquivo enviado.
  const rawTrimSeconds = formData.get("trimSeconds");
  const trimSeconds =
    assetType === "video" && typeof rawTrimSeconds === "string" && rawTrimSeconds.trim() !== ""
      ? Number(rawTrimSeconds)
      : undefined;
  if (trimSeconds !== undefined && (!Number.isFinite(trimSeconds) || trimSeconds < 0)) {
    return { ok: false, error: "Ponto de recorte inválido." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // ★ Achado real: nome original do arquivo (ex.: "Oktober Ab _48 (1).mp4",
    // com espaços e parênteses) ia direto pro storage path, e o Shotstack
    // rejeitava a signed URL resultante com "not accessible (bad request)".
    // Extensão segura, sem o nome original.
    const rawExtension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    const extension = rawExtension || (assetType === "video" ? "mp4" : "jpg");
    const storagePath = `${session.organization.id}/${piece.campaign_id}/${contentPieceId}-scene-${sceneIndex}-${Date.now()}.${extension}`;
    const { error: uploadError } = await db.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });
    if (uploadError) throw uploadError;

    // ★ Achado real (produção — Railway): essa URL fica em `pending_scene_plan` até a aprovação final, que pode
    // levar horas — 1h expirava antes do render e o Shotstack falhava com "not accessible". 7 dias, mesmo TTL
    // usado nos outros pontos que alimentam o plano pendente (video-pipeline-narrate.ts, gemini-veo-video-provider.ts).
    const { data: signed, error: signError } = await db.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (signError || !signed) throw signError ?? new Error("Falha ao gerar link do arquivo enviado.");

    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await replaceVideoSceneWithUpload({
      db,
      serviceRoleDb,
      tier,
      campaignId: piece.campaign_id,
      contentPieceId,
      sceneIndex,
      url: signed.signedUrl,
      assetType,
      trimSeconds,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    logger.error("asset_engine.scene_upload_replace_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/** Remove 1 cena do plano — nunca a última restante. */
export async function deleteReplacementSceneAction(contentPieceId: string, sceneIndex: number): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode remover cenas." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await deleteVideoScene({ db, serviceRoleDb, tier, campaignId: piece.campaign_id, contentPieceId, sceneIndex });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    logger.error("asset_engine.scene_delete_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/** ★ Achado real (pedido direto do usuário — "adicionar novas cenas... verificar se é possível adicionar/duplicar"): cópia entra logo depois da original — "adicionar cena" na prática é duplicar + trocar o visual da cópia pelos caminhos já existentes (buscar/gerar por IA/avatar/enviar arquivo), nenhuma ferramenta nova de "escolher visual" precisa existir. */
export async function duplicateVideoSceneAction(contentPieceId: string, sceneIndex: number): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode adicionar cenas." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await duplicateVideoScene({ db, serviceRoleDb, tier, campaignId: piece.campaign_id, contentPieceId, sceneIndex });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    logger.error("asset_engine.scene_duplicate_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/** ★ Achado real (pedido direto do usuário — "permitir escolher a duração de cada cena individualmente"): ajusta só a cena escolhida — `setSceneDuration` (core) já absorve a diferença na última cena, mesmo mecanismo de qualquer outra troca de cena. */
export async function setSceneDurationAction(
  contentPieceId: string,
  sceneIndex: number,
  lengthSeconds: number,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode ajustar a duração das cenas." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await setSceneDuration({ db, serviceRoleDb, tier, campaignId: piece.campaign_id, contentPieceId, sceneIndex, lengthSeconds });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    logger.error("asset_engine.scene_duration_failed", {
      contentPieceId,
      sceneIndex,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/** ★ Achado real (pedido direto do usuário — "reorganizar cenas por arrastar e soltar"): `newOrder` chega já calculado pelo cliente (índices atuais na ordem desejada) — esta action só valida a sessão/status e delega pro core. */
export async function reorderVideoScenesAction(contentPieceId: string, newOrder: number[]): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode reordenar as cenas." };
  }

  const db = await createClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") return { ok: false, error: FRIENDLY_ERROR };

  try {
    await reorderVideoScenes({ db, contentPieceId, newOrder });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    logger.error("asset_engine.scene_reorder_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

/**
 * Dispara a geração automática de foto (`licensed_stock_photo`, Missão 11,
 * Fluxo 15) para `stories`/`carousel`/`thumbnail` — mesmo padrão assíncrono
 * de `generateVideoContentPieceAction`. Pode ser chamada a qualquer momento,
 * mesmo com uma versão (upload manual ou geração anterior) já aprovada —
 * upload manual continua disponível como alternativa (arch. §14.4).
 */
export async function generatePhotoContentPieceAction(contentPieceId: string, niche?: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode gerar imagens." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.production_mode !== "licensed_stock_photo") {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    await triggerPhotoGeneration({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      campaignId: piece.campaign_id,
      tier,
      contentPieceId,
      nicheOverride: niche?.trim() || null,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    if (error instanceof InactiveSubscriptionError) {
      return {
        ok: false,
        blockedReason: "inactive_subscription",
        error: "Sua assinatura não está ativa. Reative o plano em Configurações para continuar.",
      };
    }
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        blockedReason: "insufficient_credits",
        error: "Créditos insuficientes para gerar essa imagem. Compre mais créditos em Configurações.",
      };
    }
    if (error instanceof N8nDispatchError) {
      logger.error("asset_engine.photo_dispatch_failed", { contentPieceId, reason: error.message });
      return { ok: false, error: "Não consegui iniciar a geração da imagem agora. Tenta de novo em instantes?" };
    }
    logger.error("asset_engine.photo_generate_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * ★ Achado real (pedido direto do usuário — item 7, "editor de Stories...
 * permitir editar o texto direto no editor... alterar tamanho e movimentar a
 * marca"): grava os ajustes (`content_pieces.visual_overrides`, lidos por
 * `composePhotoContentPiece`) e já regenera com eles aplicados — mesmo
 * `triggerPhotoGeneration` de `generatePhotoContentPieceAction`, nenhuma
 * lógica de geração nova.
 */
export async function updateVisualOverridesAction(
  contentPieceId: string,
  overrides: PhotoVisualOverrides,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode ajustar o visual da peça." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.production_mode !== "licensed_stock_photo") {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  try {
    await contentPieceRepository.update(contentPieceId, { visual_overrides: overrides as unknown as Record<string, unknown> });

    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    await triggerPhotoGeneration({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      campaignId: piece.campaign_id,
      tier,
      contentPieceId,
    });

    const updated = await contentPieceRepository.findById(contentPieceId);
    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: updated ? await toViewWithMedia(db, updated) : undefined };
  } catch (error) {
    if (error instanceof InactiveSubscriptionError) {
      return {
        ok: false,
        blockedReason: "inactive_subscription",
        error: "Sua assinatura não está ativa. Reative o plano em Configurações para continuar.",
      };
    }
    if (error instanceof InsufficientCreditsError) {
      return {
        ok: false,
        blockedReason: "insufficient_credits",
        error: "Créditos insuficientes para gerar essa imagem. Compre mais créditos em Configurações.",
      };
    }
    logger.error("asset_engine.photo_visual_overrides_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * Escolhe uma opção entre as várias candidatas geradas na mesma rodada
 * (Missão 11, arch. §14.4.2) — grava `content_pieces.selected_version_id`,
 * essa é a versão usada no pacote final. Nunca gera nova cobrança (as
 * opções já foram cobradas 1x por rodada, não por candidato).
 */
export async function selectContentPieceVersionAction(
  contentPieceId: string,
  versionId: string,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode escolher a versão." };
  }

  const db = await createClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const contentVersionRepository = new ContentVersionRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece) return { ok: false, error: FRIENDLY_ERROR };

  const versions = await contentVersionRepository.findByContentPieceId(contentPieceId);
  if (!versions.some((v) => v.id === versionId)) return { ok: false, error: FRIENDLY_ERROR };

  const updated = await contentPieceRepository.update(contentPieceId, { selected_version_id: versionId });

  revalidatePath("/criar-campanha");
  return { ok: true, contentPiece: await toViewWithMedia(db, updated) };
}

/**
 * Recarrega o estado atual de uma peça — usado pela UI para fazer polling
 * enquanto o pipeline de vídeo está rodando (`generating`), já que a
 * geração é assíncrona (Fluxo 13). Mecanismo de atualização de progresso
 * (Realtime vs. polling) era decisão em aberto (ux-design.md §10) —
 * resolvido aqui como polling simples, sem infraestrutura nova.
 */
export async function getContentPieceAction(contentPieceId: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };

  const db = await createClient();
  const contentPieceRepository = new ContentPieceRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece) return { ok: false, error: FRIENDLY_ERROR };

  return { ok: true, contentPiece: await toViewWithMedia(db, piece) };
}

export interface CampaignContentPiecesResult {
  ok: boolean;
  error?: string;
  campaignTitle?: string;
  campaignStatus?: CampaignStatus;
  contentPieces?: ContentPieceView[];
  packageDownloadUrl?: string;
}

/**
 * ★ Sprint de estabilização (Missão 12, item "Campanhas") — carrega o estado
 * persistido de uma campanha (peças + pacote final, quando já montado) para
 * a tela de histórico (`/campanhas/[id]`). Antes desta sprint não existia
 * nenhum jeito de revisitar uma campanha depois do fluxo de criação —
 * `ContentPackageReview` só vivia em estado de cliente efêmero.
 */
export async function getCampaignContentPiecesAction(campaignId: string): Promise<CampaignContentPiecesResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };

  const db = await createClient();
  const campaignRepository = new CampaignRepository(db);
  const contentPieceRepository = new ContentPieceRepository(db);
  const contentPackageRepository = new ContentPackageRepository(db);

  const campaign = await campaignRepository.findById(campaignId);
  if (!campaign || campaign.brand_id !== session.brand.id) {
    return { ok: false, error: "Campanha não encontrada." };
  }

  const pieces = await contentPieceRepository.findByCampaignId(campaignId);
  const contentPieces = await Promise.all(pieces.map((piece) => toViewWithMedia(db, piece)));

  let packageDownloadUrl: string | undefined;
  if (campaign.status === "package_ready") {
    const contentPackage = await contentPackageRepository.findByCampaignId(campaignId);
    if (contentPackage?.storage_path) {
      const { data: signed } = await db.storage.from(CONTENT_OUTPUT_BUCKET).createSignedUrl(contentPackage.storage_path, 3600);
      packageDownloadUrl = signed?.signedUrl;
    }
  }

  return { ok: true, campaignTitle: campaign.title, campaignStatus: campaign.status, contentPieces, packageDownloadUrl };
}

/** Upload manual de um formato visual (`own_media`, MVP da Missão 7) — CAMP-5. Sem custo em créditos. */
export async function uploadContentPieceMediaAction(
  contentPieceId: string,
  formData: FormData,
): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode enviar arquivos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Escolhe um arquivo pra enviar." };
  }
  if (file.size > MAX_OWN_MEDIA_SIZE_BYTES) {
    return { ok: false, error: "Esse arquivo é maior que 20MB — tenta um arquivo menor?" };
  }
  if (!ACCEPTED_OWN_MEDIA_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    return { ok: false, error: "Esse tipo de arquivo não é aceito aqui. Envie uma imagem ou um vídeo." };
  }

  try {
    const db = await createClient();
    const contentPieceRepository = new ContentPieceRepository(db);
    const contentVersionRepository = new ContentVersionRepository(db);

    const piece = await contentPieceRepository.findById(contentPieceId);
    if (!piece) return { ok: false, error: FRIENDLY_ERROR };

    const buffer = Buffer.from(await file.arrayBuffer());
    // Mesmo problema do upload de cena (ver nota acima): nome original do
    // arquivo pode ter espaços/parênteses e quebrar quem for buscar a signed
    // URL depois. Extensão segura, sem o nome original.
    const rawExtension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    const extension = rawExtension || "bin";
    const storagePath = `${session.organization.id}/${piece.campaign_id}/${contentPieceId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await db.storage.from(CONTENT_OUTPUT_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const latest = await contentVersionRepository.findLatestByContentPieceId(contentPieceId);
    await contentVersionRepository.create({
      content_piece_id: contentPieceId,
      version_number: (latest?.version_number ?? 0) + 1,
      output_storage_path: storagePath,
    });

    const updated = await contentPieceRepository.update(contentPieceId, { status: "ready_for_review" });

    revalidatePath("/criar-campanha");
    return { ok: true, contentPiece: toView(updated) };
  } catch (error) {
    logger.error("asset_engine.upload_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * Aprova uma peça (Fluxo 4). Quando todas as peças da campanha estão
 * aprovadas, monta automaticamente o Pacote de Conteúdo (Fluxo 3, §3.3) —
 * sem passo manual separado.
 */
export async function approveContentPieceAction(contentPieceId: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode aprovar peças." };
  }

  const db = await createClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const campaignRepository = new CampaignRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece) return { ok: false, error: FRIENDLY_ERROR };

  const updated = await contentPieceRepository.update(contentPieceId, {
    status: "approved",
    approved_by: session.user.id,
    approved_at: new Date().toISOString(),
  });

  const campaignForSignal = await campaignRepository.findById(piece.campaign_id);
  if (campaignForSignal) {
    await emitLearningSignal(db, {
      brandId: campaignForSignal.brand_id,
      contentPieceId,
      signalType: "approved",
      payload: { format: piece.format },
    });
  }

  const allPieces = await contentPieceRepository.findByCampaignId(piece.campaign_id);
  const allApproved = allPieces.every((p) => p.status === "approved");

  let packageReady = false;
  let downloadUrl: string | undefined;

  if (allApproved) {
    try {
      const { storagePath } = await buildContentPackage({
        db,
        organizationId: session.organization.id,
        campaignId: piece.campaign_id,
      });
      await campaignRepository.update(piece.campaign_id, { status: "package_ready" });

      const { data: signed } = await db.storage.from(CONTENT_OUTPUT_BUCKET).createSignedUrl(storagePath, 3600);
      packageReady = true;
      downloadUrl = signed?.signedUrl;
    } catch (error) {
      if (!(error instanceof PackageNotReadyError)) {
        logger.error("asset_engine.package_build_failed", {
          campaignId: piece.campaign_id,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  revalidatePath("/criar-campanha");
  return { ok: true, contentPiece: toView(updated), packageReady, downloadUrl };
}

/** Rejeita uma peça (Fluxo 4) — motivo opcional, registrado em audit_logs. */
export async function rejectContentPieceAction(contentPieceId: string, reason?: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode rejeitar peças." };
  }

  const db = await createClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const campaignRepository = new CampaignRepository(db);
  const auditRepository = new AuditRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece) return { ok: false, error: FRIENDLY_ERROR };

  const updated = await contentPieceRepository.update(contentPieceId, { status: "rejected" });

  await auditRepository.record({
    organization_id: session.organization.id,
    actor_user_id: session.user.id,
    action: "content_piece.rejected",
    entity_type: "content_piece",
    entity_id: contentPieceId,
    metadata: reason ? { reason } : {},
  });

  const campaign = await campaignRepository.findById(piece.campaign_id);
  if (campaign) {
    await emitLearningSignal(db, {
      brandId: campaign.brand_id,
      contentPieceId,
      signalType: "rejected",
      payload: { format: piece.format, reason: reason ?? null },
    });
  }

  revalidatePath("/criar-campanha");
  return { ok: true, contentPiece: toView(updated) };
}
