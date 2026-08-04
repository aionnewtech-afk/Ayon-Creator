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
  ensureSufficientCredits,
  generateTextPiece,
  hasMinimumRole,
  knownFieldsFromProfile,
  logger,
  recordConsumption,
} from "@ayon/core";
import { buildContentPackage, PackageNotReadyError } from "@ayon/core/src/asset-engine/build-content-package";
import type { ContentPieceFormat, ContentPieceStatus, Database, ProductionMode } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const CONTENT_OUTPUT_BUCKET = "content-output";
const ASSET_GENERATION_TRIGGER_REASON = "asset_generation";
const FRIENDLY_ERROR = "Não consegui fazer isso agora. Pode tentar de novo em instantes?";

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

/** Salva edição manual de uma peça textual — CAMP-5, sem custo em créditos (não chama LLM). */
export async function editContentPieceAction(contentPieceId: string, script: string): Promise<ContentPieceActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode editar peças." };
  }

  const db = createClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const updated = await contentPieceRepository.update(contentPieceId, { script });

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

  const db = createClient();
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
    const strategySummary = campaign.strategy_summary as { consolidated_strategy?: string; rationale?: string } | null;

    await generateTextPiece({
      db,
      serviceRoleDb,
      tier,
      contentPieceId,
      format: piece.format,
      brandName: session.brand.name,
      knownFields,
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

  try {
    const db = createClient();
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

  const db = createClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const campaignRepository = new CampaignRepository(db);

  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece) return { ok: false, error: FRIENDLY_ERROR };

  const updated = await contentPieceRepository.update(contentPieceId, {
    status: "approved",
    approved_by: session.user.id,
    approved_at: new Date().toISOString(),
  });

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

  const db = createClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const auditRepository = new AuditRepository(db);

  const updated = await contentPieceRepository.update(contentPieceId, { status: "rejected" });

  await auditRepository.record({
    organization_id: session.organization.id,
    actor_user_id: session.user.id,
    action: "content_piece.rejected",
    entity_type: "content_piece",
    entity_id: contentPieceId,
    metadata: reason ? { reason } : {},
  });

  revalidatePath("/criar-campanha");
  return { ok: true, contentPiece: toView(updated) };
}
