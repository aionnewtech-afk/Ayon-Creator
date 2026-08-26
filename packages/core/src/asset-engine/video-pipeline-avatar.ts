import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ensureSufficientCredits, recordConsumption } from "../billing/credit-gate";
import type { AvatarProvider } from "../providers/avatar-provider";
import type { MediaCandidate } from "../providers/media-provider";
import { resolveAvatarProvider, resolveLlmProvider, resolveMediaProvider } from "../providers/provider-gateway";
import { BrandRepository } from "../repositories/brand.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { ContentVersionRepository } from "../repositories/content-version.repository";
import { CreditPricingRepository } from "../repositories/credit-pricing.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";
import { sanitizeNarrationText } from "../shared/sanitize-narration-text";
import { AvatarProviderUnavailableError, generateAvatarLookVariant } from "./brand-avatar";
import { rewriteScriptForDuration } from "./rewrite-script-for-duration";
import { MissingScriptError } from "./video-pipeline-trigger";

const CONTENT_OUTPUT_BUCKET = "content-output";
const VIDEO_GENERATION_TRIGGER_REASON = "video_generation";
/** ★ Achado real (mesmo espírito de `gemini-veo-video-provider.ts`): geração de vídeo com avatar renderiza minutos, nunca segundos — folga generosa de polling. */
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60; // ~10min

export class AvatarNotReadyError extends Error {
  constructor() {
    super("O avatar da marca ainda não está pronto — falta o consentimento ser aceito ou o treinamento terminar.");
    this.name = "AvatarNotReadyError";
  }
}

export interface GenerateAvatarVideoParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  organizationId: string;
  actorUserId: string;
  campaignId: string;
  contentPieceId: string;
  /** ★ Achado real (pedido direto do usuário — "não gostei do cenário e minha voz ficou estranha, tem como mudar?"): sem nenhum dos 2, cai no padrão de sempre (voz clonada do avatar, cenário original do vídeo de treinamento) — nunca obrigatório escolher. */
  voiceId?: string;
  backgroundColorHex?: string;
  /** ★ Achado real (pedido direto do usuário — "eu achava que ele seria capaz de... criar os vídeos em ambientes tipo aeroporto, escritório, praia"): URL de uma foto real (banco de imagens licenciado, mesmo fornecedor já usado pra cenas de vídeo) pra usar como cenário atrás do avatar — troca só o fundo, nunca mexe no rosto/corpo real. Tem prioridade sobre `backgroundColorHex` quando os dois vierem preenchidos. */
  backgroundImageUrl?: string;
  /** ★ Achado real (pedido direto do usuário — "implementa a troca de roupa também, nem que seja com um prompt"): quando presente, gera um novo look (mesmo rosto, roupa/estilo conforme o prompt) ANTES do vídeo e usa ele no lugar do look original — nunca persistido como novo padrão da marca, só desta geração. ⚠ Desativado na UI (não preserva identidade real, achado confirmado 2x) — mantido no código, nunca reativar sem validar visualmente de novo. */
  outfitPrompt?: string;
  /** ★ Achado real (pedido direto do usuário — "e eu faço isso pelo heygen?"): quando presente, usa este look (um dos `brand.avatar_looks`, rosto real treinado a partir de um 2º vídeo) no lugar do look principal — mesmo espírito de `voiceId`/`backgroundColorHex`, escolha por geração, nunca muda o padrão da marca. Tem prioridade sobre `outfitPrompt`. */
  avatarLookId?: string;
  /** ★ Achado real (pedido direto do usuário — "eu quero poder escolher a duração do vídeo"): reescreve o roteiro (LLM) pra caber nesse tempo ANTES de gerar — a HeyGen renderiza o tempo que o texto implicar, nunca corta/estica por conta própria. Ausente mantém o roteiro como está. */
  targetDurationSeconds?: number;
}

/** Lista as vozes disponíveis na conta HeyGen — inclui a clonada do próprio avatar, pra UI oferecer escolha em vez de sempre a mesma. */
export async function listAvatarVoicesForOrganization(params: {
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
}) {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();
  return avatarProvider.listVoices();
}

/**
 * ★ Achado real (pedido direto do usuário — "eu achava que ele seria capaz
 * de criar os vídeos em ambientes tipo aeroporto, escritório, praia"): busca
 * fotos reais de cenário (mesmo banco de imagens licenciado já usado pra
 * cenas de vídeo, `resolveMediaProvider`/`searchPhotos`) pra usar como fundo
 * atrás do avatar — nunca gera por IA (evita qualquer risco de identidade,
 * já que aqui é só o fundo, mas mantém o mesmo cuidado do resto do app de
 * preferir banco licenciado a gerar do zero quando um já resolve).
 */
export async function searchAvatarBackgroundImages(params: {
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  query: string;
  perPage?: number;
}): Promise<MediaCandidate[]> {
  const mediaProvider = await resolveMediaProvider(params.serviceRoleDb, params.tier);
  const result = await mediaProvider.searchPhotos({ query: params.query, orientation: "portrait", perPage: params.perPage ?? 6 });
  return result.candidates;
}

/**
 * ★ Achado real (pedido direto do usuário — "em que momento ele vai dar a
 * opção de gerar vídeo de avatar?"): 2ª forma de produzir a peça `video`
 * de uma campanha — em vez de narração + busca de cenas + composição
 * (`licensed_stock_video`, `video-pipeline-plan.ts`), a HeyGen faz
 * narração+rosto+lip-sync num único vídeo a partir do roteiro e do avatar
 * já treinado da marca. Síncrono como o resto do Asset Engine (nunca n8n),
 * mesmo padrão de crédito/`pipeline_runs` de sempre — só o provider por
 * trás muda. `production_mode` da peça vira `ai_avatar` só quando esta
 * função é escolhida (nunca fixo desde a criação da campanha — a peça
 * `video` pode ser gerada por qualquer um dos 2 caminhos, à escolha do
 * usuário).
 */
export async function generateAvatarVideoForContentPiece(params: GenerateAvatarVideoParams): Promise<void> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const pipelineRunRepository = new PipelineRunRepository(params.db);

  const primaryPiece = await contentPieceRepository.findPrimaryByCampaignId(params.campaignId);
  if (!primaryPiece?.script) throw new MissingScriptError();

  const campaign = await new CampaignRepository(params.db).findById(params.campaignId);
  const brand = campaign ? await new BrandRepository(params.db).findById(campaign.brand_id) : null;
  if (!brand?.avatar_ready || !brand.avatar_look_id || !brand.avatar_group_id) throw new AvatarNotReadyError();

  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  await ensureSufficientCredits({
    serviceRoleDb: params.serviceRoleDb,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    triggerReason: VIDEO_GENERATION_TRIGGER_REASON,
    tier: params.tier,
  });

  await contentPieceRepository.update(params.contentPieceId, { status: "generating", production_mode: "ai_avatar" });

  const pipelineRun = await pipelineRunRepository.create({
    entity_type: "content_piece",
    entity_id: params.contentPieceId,
    engine: "asset_engine",
    status: "running",
    actor_user_id: params.actorUserId,
  });

  try {
    let effectiveAvatarId = brand.avatar_look_id;
    let effectiveAvatarName = brand.avatar_name;
    let effectiveScript = primaryPiece.script;

    // ★ Achado real (pedido direto do usuário — "eu quero poder escolher a
    // duração do vídeo"): reescreve ANTES de gerar — grava de volta na
    // peça "Roteiro" também (mesmo texto que a tela de revisão mostra),
    // nunca uma cópia paralela só usada aqui.
    if (params.targetDurationSeconds) {
      await pipelineRunRepository.update(pipelineRun.id, { stage: "rewriting_script" });
      const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);
      effectiveScript = await rewriteScriptForDuration({
        script: primaryPiece.script,
        targetDurationSeconds: params.targetDurationSeconds,
        llmProvider,
      });
      await contentPieceRepository.update(primaryPiece.id, { script: effectiveScript });
    }

    if (params.avatarLookId?.trim()) {
      effectiveAvatarId = params.avatarLookId.trim();
      const chosenLook = (brand.avatar_looks as { lookId: string; name: string; status: string }[] | null)?.find(
        (look) => look.lookId === effectiveAvatarId,
      );
      if (chosenLook) effectiveAvatarName = chosenLook.name;
    } else if (params.outfitPrompt?.trim()) {
      await pipelineRunRepository.update(pipelineRun.id, { stage: "generating_look_variant" });
      const variant = await generateAvatarLookVariant({
        serviceRoleDb: params.serviceRoleDb,
        organizationId: params.organizationId,
        groupId: brand.avatar_group_id,
        baseAvatarId: brand.avatar_look_id,
        name: `${brand.avatar_name ?? "avatar"} — ${params.outfitPrompt.trim().slice(0, 40)}`,
        prompt: params.outfitPrompt.trim(),
      });
      effectiveAvatarId = variant.lookId;
    }

    await pipelineRunRepository.update(pipelineRun.id, { stage: "generating_avatar_video" });

    const { videoId } = await avatarProvider.generateAvatarVideo({
      avatarId: effectiveAvatarId,
      // ★ Mesmo achado real de video-pipeline-narrate.ts: o roteiro pode
      // incluir direções de cena entre parênteses, narradas em voz alta
      // literalmente se não sanitizado.
      script: sanitizeNarrationText(effectiveScript),
      // `voiceId` ausente usa a voz clonada padrão do próprio avatar
      // (`default_voice_id`, achado real da criação do digital twin) —
      // nunca uma voz genérica do catálogo curado (que é só pro caminho
      // `licensed_stock_video`), a não ser que o usuário escolha outra.
      voiceId: params.voiceId,
      // ★ Achado real (pedido direto do usuário — "minha voz ficou com um
      // sotaque estranho"): produto é pt-BR único (mesmo achado de
      // `select-brand-voice.ts`) — sempre passa a dica de idioma, nunca
      // deixa a síntese assumir um sotaque default (provavelmente en-US, a
      // língua original do treinamento do modelo).
      voiceLocale: "pt-BR",
      // ★ Achado real (pedido direto do usuário — "tem como eu mudar o
      // cenário?" / depois "ambientes tipo aeroporto, escritório, praia"):
      // confirmado na documentação da HeyGen que o fundo pode ser
      // substituído (cor ou foto real), independente do vídeo de
      // treinamento original — foto tem prioridade sobre cor quando as duas
      // vierem preenchidas.
      background: params.backgroundImageUrl
        ? { type: "image", url: params.backgroundImageUrl }
        : params.backgroundColorHex
          ? { type: "color", value: params.backgroundColorHex }
          : undefined,
      aspectRatio: "9:16",
    });

    const { videoUrl } = await pollUntilDone(avatarProvider, videoId);
    if (!videoUrl) throw new Error("HeyGen concluiu sem devolver nenhum vídeo.");

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error(`Falha ao baixar o vídeo do avatar (${videoResponse.status}).`);
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    const storagePath = `${params.organizationId}/${params.campaignId}/${params.contentPieceId}-avatar-video.mp4`;
    const { error: uploadError } = await params.db.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });
    if (uploadError) throw uploadError;

    const creditPricingRepository = new CreditPricingRepository(params.serviceRoleDb);
    const pricing = await creditPricingRepository.findActive(VIDEO_GENERATION_TRIGGER_REASON, params.tier);
    if (!pricing) {
      throw new Error(`Nenhum credit_pricing ativo para (trigger_reason=video_generation, tier=${params.tier}).`);
    }

    const contentVersionRepository = new ContentVersionRepository(params.db);
    const latest = await contentVersionRepository.findLatestByContentPieceId(params.contentPieceId);
    await contentVersionRepository.create({
      content_piece_id: params.contentPieceId,
      version_number: (latest?.version_number ?? 0) + 1,
      output_storage_path: storagePath,
      generation_metadata: {
        avatar_provider_key: "heygen",
        avatar_id: effectiveAvatarId,
        avatar_name: effectiveAvatarName,
        voice_id: params.voiceId ?? null,
        background_color_hex: params.backgroundColorHex ?? null,
        background_image_url: params.backgroundImageUrl ?? null,
        outfit_prompt: params.outfitPrompt?.trim() || null,
        tier: params.tier,
      },
    });

    await contentPieceRepository.update(params.contentPieceId, { status: "ready_for_review" });
    await pipelineRunRepository.update(pipelineRun.id, { status: "completed", finished_at: new Date().toISOString() });

    await recordConsumption({
      serviceRoleDb: params.serviceRoleDb,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      costCredits: pricing.credits,
      pipelineRunId: pipelineRun.id,
      description: `Geração de vídeo com avatar (${effectiveAvatarName ?? "porta-voz"})`,
    });
  } catch (error) {
    await contentPieceRepository.update(params.contentPieceId, { status: "failed" });
    await pipelineRunRepository.update(pipelineRun.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}

/** ★ Achado real (pedido direto do usuário — "incluir avatar intercalado com as cenas do Pexels"): também reaproveitado por `replaceVideoSceneWithAvatar` (video-pipeline-scene-edit.ts) pra esperar 1 clipe curto de avatar renderizar, mesmo polling de sempre. */
export async function pollUntilDone(
  avatarProvider: AvatarProvider,
  videoId: string,
): Promise<{ status: string; videoUrl?: string; durationSeconds?: number }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const result = await avatarProvider.getVideoStatus(videoId);
    if (result.status === "completed") return result;
    if (result.status === "failed") throw new Error(`Geração do vídeo do avatar falhou (status: ${result.status}).`);

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Vídeo do avatar não concluiu dentro do tempo limite de polling (${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s).`);
}
