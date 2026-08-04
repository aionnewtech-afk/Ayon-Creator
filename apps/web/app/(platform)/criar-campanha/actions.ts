"use server";

import { revalidatePath } from "next/cache";
import {
  AuditRepository,
  BrandBrainRepository,
  CampaignRepository,
  ContentPieceRepository,
  InactiveSubscriptionError,
  InsufficientCreditsError,
  ensureSufficientCredits,
  generateTextPiece,
  hasMinimumRole,
  initializeCampaignContentPieces,
  knownFieldsFromProfile,
  learnedPreferencesTextFromProfile,
  logger,
  recordConsumption,
  runCampaignStrategySession,
} from "@ayon/core";
import { TEXT_ONLY_CONTENT_PIECE_FORMATS } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ContentPieceView } from "./asset-actions";

const ASSET_GENERATION_TRIGGER_REASON = "asset_generation";

export interface SpecialistOpinionView {
  specialistId: string;
  specialistName: string;
  failed: boolean;
  opinion: string | null;
  rationale: string | null;
}

export interface CreateCampaignStrategyResult {
  ok: boolean;
  campaignId?: string;
  opinions?: SpecialistOpinionView[];
  consolidatedStrategy?: string;
  rationale?: string;
  divergences?: string | null;
  error?: string;
  blockedReason?: "inactive_subscription" | "insufficient_credits";
}

const FRIENDLY_ERROR = "Não consegui reunir a equipe de especialistas agora. Pode tentar de novo em instantes?";
const CAMPAIGN_STRATEGY_TRIGGER_REASON = "campaign_strategy";

/**
 * Aciona uma sessão completa do Intelligence Hub para estratégia de campanha
 * (Fluxo 10, versão simplificada da Missão 3 — sem geração de conteúdo ainda).
 */
export async function createCampaignStrategyAction(objective: string): Promise<CreateCampaignStrategyResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode criar campanhas por enquanto." };
  }

  const trimmedObjective = objective.trim();
  if (!trimmedObjective) {
    return { ok: false, error: "Conte pra mim qual é o objetivo dessa campanha." };
  }

  try {
    const sessionDb = await createClient();
    const serviceRoleDb = createServiceRoleClient();
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    const { costCredits } = await ensureSufficientCredits({
      serviceRoleDb,
      organizationId: session.organization.id,
      triggerReason: CAMPAIGN_STRATEGY_TRIGGER_REASON,
      tier,
    });

    const result = await runCampaignStrategySession({
      db: sessionDb,
      serviceRoleDb,
      tier,
      brandId: session.brand.id,
      brandName: session.brand.name,
      objective: trimmedObjective,
      actorUserId: session.user.id,
    });

    await recordConsumption({
      serviceRoleDb,
      organizationId: session.organization.id,
      costCredits,
      intelligenceHubSessionId: result.sessionId,
      description: `Estratégia de campanha — ${session.brand.name}`,
    });

    revalidatePath("/criar-campanha");

    return {
      ok: true,
      campaignId: result.campaignId,
      opinions: result.opinions.map((opinion) => ({
        specialistId: opinion.specialistId,
        specialistName: opinion.specialistName,
        failed: opinion.failed,
        opinion: opinion.opinion,
        rationale: opinion.rationale,
      })),
      consolidatedStrategy: result.consolidatedStrategy,
      rationale: result.rationale,
      divergences: result.divergences,
    };
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
        error: "Créditos insuficientes para criar essa campanha. Compre mais créditos em Configurações.",
      };
    }

    logger.error("intelligence_hub.campaign_strategy_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface ApproveCampaignStrategyResult {
  ok: boolean;
  error?: string;
  contentPieces?: ContentPieceView[];
}

/**
 * Aprovação explícita da estratégia consolidada — nunca automática (Princípio
 * do Consultor Permanente, PRD §1.1). Dispara em seguida o Asset Engine
 * (Fluxo 2, passo 10 → Fluxo 3): cria as 9 `content_pieces` previstas e gera
 * os 5 formatos textuais (MVP da Missão 7 — os 4 visuais ficam aguardando
 * upload manual do cliente, arch. §3.5).
 */
export async function approveCampaignStrategyAction(campaignId: string): Promise<ApproveCampaignStrategyResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode aprovar campanhas por enquanto." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const campaignRepository = new CampaignRepository(db);
  const auditRepository = new AuditRepository(db);
  const contentPieceRepository = new ContentPieceRepository(db);
  const brandBrainRepository = new BrandBrainRepository(db);

  const campaign = await campaignRepository.update(campaignId, { status: "approved" });

  await auditRepository.record({
    organization_id: session.organization.id,
    actor_user_id: session.user.id,
    action: "campaign.strategy_approved",
    entity_type: "campaign",
    entity_id: campaignId,
  });

  // Regra inegociável (Princípio do Consultor Permanente): nenhuma peça é
  // gerada sem o Brand Brain carregado — arch. §3.5.
  const profile = await brandBrainRepository.findByBrandId(session.brand.id);
  const knownFields = knownFieldsFromProfile(profile);
  const learnedPreferencesText = learnedPreferencesTextFromProfile(profile);
  const strategySummary = campaign.strategy_summary as { consolidated_strategy?: string; rationale?: string } | null;
  const consolidatedStrategy = strategySummary?.consolidated_strategy ?? "";
  const strategyRationale = strategySummary?.rationale ?? "";
  const tier = session.brand.provider_tier ?? session.organization.provider_tier;

  await campaignRepository.update(campaignId, { status: "generating" });

  const pieces = await initializeCampaignContentPieces(db, campaignId, campaign.intelligence_hub_session_id);

  for (const piece of pieces) {
    if (!(TEXT_ONLY_CONTENT_PIECE_FORMATS as readonly string[]).includes(piece.format)) continue;

    try {
      const { costCredits } = await ensureSufficientCredits({
        serviceRoleDb,
        organizationId: session.organization.id,
        triggerReason: ASSET_GENERATION_TRIGGER_REASON,
        tier,
      });

      await generateTextPiece({
        db,
        serviceRoleDb,
        tier,
        contentPieceId: piece.id,
        format: piece.format,
        brandName: session.brand.name,
        knownFields,
        learnedPreferencesText,
        consolidatedStrategy,
        strategyRationale,
      });

      await recordConsumption({
        serviceRoleDb,
        organizationId: session.organization.id,
        costCredits,
        contentPieceId: piece.id,
        description: `Peça de conteúdo (${piece.format}) — ${session.brand.name}`,
      });
    } catch (error) {
      // Falha parcial nunca bloqueia as demais peças (mesmo espírito do
      // painel de especialistas, Fluxo 10 passo 7) — peça fica em `draft`,
      // pode ser regenerada individualmente depois.
      logger.error("asset_engine.text_piece_failed", {
        contentPieceId: piece.id,
        format: piece.format,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ★ Missão 9 — achado real durante a validação em ambiente real: a peça
  // `video` (production_mode `licensed_stock_video`) nunca é `text_only`,
  // então o loop acima nunca preenche `content_pieces.script` para ela — e
  // `narrateVideoContentPiece` (Fluxo 13, passo 3) exige um script para
  // narrar. Em vez de uma chamada de LLM redundante, reaproveita o mesmo
  // texto já gerado para a peça principal "Roteiro" (is_primary), que é
  // literalmente o roteiro/narrativa central da campanha — garante também
  // que o vídeo narrado nunca diverge do roteiro escrito exibido ao usuário.
  const primaryScriptPiece = pieces.find((piece) => piece.is_primary);
  const videoPiece = pieces.find((piece) => piece.format === "video" && piece.production_mode === "licensed_stock_video");

  if (primaryScriptPiece && videoPiece) {
    const generatedPrimary = await contentPieceRepository.findById(primaryScriptPiece.id);
    if (generatedPrimary?.script) {
      await contentPieceRepository.update(videoPiece.id, { script: generatedPrimary.script });
    }
  }

  await campaignRepository.update(campaignId, { status: "ready_for_review" });

  const updatedPieces = await contentPieceRepository.findByCampaignId(campaignId);

  revalidatePath("/criar-campanha");

  return {
    ok: true,
    contentPieces: updatedPieces.map((piece) => ({
      id: piece.id,
      format: piece.format,
      productionMode: piece.production_mode,
      isPrimary: piece.is_primary,
      script: piece.script,
      brandRationale: piece.brand_rationale,
      status: piece.status,
    })),
  };
}
