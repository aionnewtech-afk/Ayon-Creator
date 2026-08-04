"use server";

import { revalidatePath } from "next/cache";
import {
  AuditRepository,
  BrandBrainRepository,
  CampaignRepository,
  ContentPieceRepository,
  ContentVersionRepository,
  InactiveSubscriptionError,
  InsufficientCreditsError,
  LearningSignalRepository,
  N8nDispatchError,
  ensureSufficientCredits,
  generateTextPiece,
  hasMinimumRole,
  knownFieldsFromProfile,
  learnedPreferencesTextFromProfile,
  logger,
  recordConsumption,
  triggerVideoGeneration,
} from "@ayon/core";
import { buildContentPackage, PackageNotReadyError } from "@ayon/core/src/asset-engine/build-content-package";
import type { ContentPieceFormat, ContentPieceStatus, Database, ProductionMode } from "@ayon/types";
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
  };
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
 * Dispara a geração automática de vídeo (`licensed_stock_video`, Missão 9,
 * Etapa 1 — Fluxo 13) — CAMP-5. Diferente de `regenerateContentPieceAction`,
 * não espera o resultado: dispara o pipeline assíncrono via n8n e retorna
 * imediatamente com a peça em `generating`. UI precisa de status assíncrono
 * (Realtime/polling — decisão de UX ainda em aberto, ux-design.md §10) para
 * refletir a conclusão; por enquanto, um refresh manual da página já reflete
 * o resultado quando o webhook de conclusão processar.
 */
export async function generateVideoContentPieceAction(contentPieceId: string): Promise<ContentPieceActionResult> {
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
  if (!piece || piece.production_mode !== "licensed_stock_video") {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  const campaign = await campaignRepository.findById(piece.campaign_id);
  if (!campaign) return { ok: false, error: FRIENDLY_ERROR };

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    await triggerVideoGeneration({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      campaignId: piece.campaign_id,
      tier,
      contentPieceId,
      searchQuery: campaign.title,
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
        error: "Créditos insuficientes para gerar esse vídeo. Compre mais créditos em Configurações.",
      };
    }
    if (error instanceof N8nDispatchError) {
      logger.error("asset_engine.video_dispatch_failed", { contentPieceId, reason: error.message });
      return { ok: false, error: "Não consegui iniciar a geração do vídeo agora. Tenta de novo em instantes?" };
    }
    logger.error("asset_engine.video_generate_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
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
    const storagePath = `${session.organization.id}/${piece.campaign_id}/${contentPieceId}-${file.name}`;

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
