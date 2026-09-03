"use server";

import { revalidatePath } from "next/cache";
import {
  AuditRepository,
  BrandBrainRepository,
  CampaignRepository,
  ContentPieceRepository,
  InactiveSubscriptionError,
  InsufficientCreditsError,
  SpecialistOpinionRepository,
  SpecialistRepository,
  ensureSufficientCredits,
  generateTextPiece,
  hasMinimumRole,
  initializeCampaignContentPieces,
  knownFieldsFromProfile,
  learnedPreferencesTextFromProfile,
  logger,
  recordConsumption,
  redoCampaignStrategySession,
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
  executiveSummary?: string | null;
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
      actorUserId: session.user.id,
      triggerReason: CAMPAIGN_STRATEGY_TRIGGER_REASON,
      tier,
    });

    const result = await runCampaignStrategySession({
      db: sessionDb,
      serviceRoleDb,
      tier,
      brandId: session.brand.id,
      brandName: session.brand.name,
      niche: session.brand.niche,
      objective: trimmedObjective,
      actorUserId: session.user.id,
    });

    await recordConsumption({
      serviceRoleDb,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
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
      executiveSummary: result.executiveSummary,
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

/**
 * ★ Achado real (pedido direto do usuário — "quero que as alterações nas
 * campanhas sejam salvas automaticamente, pra quando eu retomar não começar
 * do zero"): a estratégia consolidada (opiniões + consolidação) já ficava
 * gravada em `campaigns.strategy_summary`/`specialist_opinions` desde
 * sempre — o que faltava era um jeito de reabrir ESSA tela específica depois
 * de sair. Sem isso, a única forma de "recuperar" uma campanha em
 * `ready_for_review` sem peças ainda era digitar o objetivo de novo do zero
 * (nova sessão do Intelligence Hub, novo custo em créditos). Usado por
 * `/campanhas/[id]` quando a campanha ainda não tem `content_pieces`.
 */
export async function getCampaignStrategyForResumeAction(campaignId: string): Promise<CreateCampaignStrategyResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const campaignRepository = new CampaignRepository(db);

  const campaign = await campaignRepository.findById(campaignId);
  if (!campaign || campaign.brand_id !== session.brand.id) {
    return { ok: false, error: "Campanha não encontrada." };
  }
  if (campaign.status !== "ready_for_review" || !campaign.strategy_summary) {
    return { ok: false, error: "Essa campanha não tem uma estratégia pendente de aprovação." };
  }

  const opinionRepository = new SpecialistOpinionRepository(db);
  const rows = await opinionRepository.findBySessionId(campaign.intelligence_hub_session_id);
  const specialistRepository = new SpecialistRepository(serviceRoleDb);
  const specialists = await specialistRepository.findByIds(rows.map((row) => row.specialist_id));
  const nameById = new Map(specialists.map((specialist) => [specialist.id, specialist.name]));

  const strategySummary = campaign.strategy_summary as {
    executive_summary?: string | null;
    consolidated_strategy?: string;
    rationale?: string;
    divergences?: string | null;
  };

  return {
    ok: true,
    campaignId: campaign.id,
    // ★ Especialistas que falharam na sessão original não geram linha em
    // `specialist_opinions` (runSpecialistPanel só grava as respostas com
    // sucesso) — ao retomar, só reaparecem os que responderam, mesmo
    // espírito de "falha parcial nunca bloqueia" já aplicado no resto do
    // fluxo.
    opinions: rows.map((row) => {
      const opinion = row.opinion as { opinion?: string; rationale?: string } | null;
      return {
        specialistId: row.specialist_id,
        specialistName: nameById.get(row.specialist_id) ?? "Especialista",
        failed: false,
        opinion: opinion?.opinion ?? null,
        rationale: opinion?.rationale ?? null,
      };
    }),
    executiveSummary: strategySummary.executive_summary ?? null,
    consolidatedStrategy: strategySummary.consolidated_strategy ?? "",
    rationale: strategySummary.rationale ?? "",
    divergences: strategySummary.divergences ?? null,
  };
}

/**
 * ★ Achado real (pedido direto do usuário — "os textos são muito genéricos
 * ... quando aprovo a campanha não consigo mais voltar pra revisar... quero
 * poder redigitar a pesquisa/estratégia"): antes, a única forma de mudar o
 * objetivo era criar uma campanha nova do zero, mesmo já tendo aprovado e
 * gerado peças — o `campaigns.id`/`content_pieces` da tentativa anterior
 * ficavam órfãos. Reprocessa a MESMA campanha com um objetivo ajustado
 * (nova sessão do Intelligence Hub, nova cobrança em créditos, mesmo padrão
 * de `createCampaignStrategyAction`) e devolve pro mesmo painel de revisão
 * (`StrategyReviewPanel`). Se a campanha já tinha `content_pieces`,
 * `approveCampaignStrategyAction` detecta isso e regenera os formatos
 * textuais em vez de duplicar as 9 peças.
 */
export async function redoCampaignStrategyAction(campaignId: string, objective: string): Promise<CreateCampaignStrategyResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode redigitar a estratégia." };
  }

  const trimmedObjective = objective.trim();
  if (!trimmedObjective) {
    return { ok: false, error: "Conte pra mim qual é o objetivo ajustado dessa campanha." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const campaignRepository = new CampaignRepository(db);

  const campaign = await campaignRepository.findById(campaignId);
  if (!campaign || campaign.brand_id !== session.brand.id) {
    return { ok: false, error: "Campanha não encontrada." };
  }

  try {
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    const { costCredits } = await ensureSufficientCredits({
      serviceRoleDb,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      triggerReason: CAMPAIGN_STRATEGY_TRIGGER_REASON,
      tier,
    });

    const result = await redoCampaignStrategySession({
      db,
      serviceRoleDb,
      tier,
      brandId: session.brand.id,
      brandName: session.brand.name,
      niche: session.brand.niche,
      objective: trimmedObjective,
      campaignId,
    });

    await recordConsumption({
      serviceRoleDb,
      organizationId: session.organization.id,
      actorUserId: session.user.id,
      costCredits,
      intelligenceHubSessionId: result.sessionId,
      description: `Estratégia de campanha (redigitada) — ${session.brand.name}`,
    });

    revalidatePath("/campanhas");

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
      executiveSummary: result.executiveSummary,
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
        error: "Créditos insuficientes para redigitar essa estratégia. Compre mais créditos em Configurações.",
      };
    }

    logger.error("intelligence_hub.campaign_strategy_redo_failed", {
      campaignId,
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

  // ★ Achado real (pedido direto do usuário — "quero poder redigitar a
  // pesquisa/estratégia" depois de já ter aprovado uma vez): aprovar de novo
  // depois de um `redoCampaignStrategyAction` NÃO pode recriar as 9 peças —
  // duplicaria vídeo/fotos/textos já existentes. Peças já existentes só têm
  // os formatos textuais regenerados com a estratégia nova; a peça primária
  // passa a apontar pra sessão nova (é dela que `generateTextPiece` e o
  // roteiro do vídeo dependem).
  const existingPieces = await contentPieceRepository.findByCampaignId(campaignId);
  let pieces = existingPieces;

  if (existingPieces.length === 0) {
    pieces = await initializeCampaignContentPieces(db, campaignId, campaign.intelligence_hub_session_id);

    // ★ Sprint de estabilização — achado real: uma campanha real ficou com
    // status `ready_for_review` e zero `content_pieces` (nenhum jeito de o
    // usuário perceber ou recuperar — a tela de revisão simplesmente ficava
    // vazia, sem erro nenhum). O fluxo nunca verificava se a criação das 9
    // peças realmente persistiu antes de avançar o status da campanha —
    // "nenhuma etapa inicia antes da anterior estar concluída e persistida".
    if (pieces.length === 0) {
      await campaignRepository.update(campaignId, { status: "failed" });
      logger.error("asset_engine.content_pieces_not_persisted", { campaignId });
      return { ok: false, error: "Não conseguimos preparar as peças desta campanha agora. Tenta de novo em instantes?" };
    }
  } else {
    const primary = pieces.find((piece) => piece.is_primary);
    if (primary) {
      await contentPieceRepository.update(primary.id, { intelligence_hub_session_id: campaign.intelligence_hub_session_id });
    }
  }

  for (const piece of pieces) {
    if (!(TEXT_ONLY_CONTENT_PIECE_FORMATS as readonly string[]).includes(piece.format)) continue;

    try {
      const { costCredits } = await ensureSufficientCredits({
        serviceRoleDb,
        organizationId: session.organization.id,
        actorUserId: session.user.id,
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
        actorUserId: session.user.id,
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

  // ★ Sprint de estabilização — achado real: a cópia pontual do roteiro
  // para `content_pieces.script` da peça `video` (feita aqui antigamente)
  // não pegava o roteiro atualizado nunca mais rege — se a peça primária
  // (`script`) falhasse ao gerar (try/catch acima, falha parcial nunca
  // bloqueia as demais) a cópia simplesmente não acontecia, sem nenhum
  // aviso ao usuário; e mesmo quando funcionava, era uma cópia congelada no
  // momento da aprovação — editar o roteiro depois nunca refletia no vídeo.
  // `narrateVideoContentPiece`/`triggerVideoGeneration` agora leem a peça
  // primária diretamente a cada chamada (`findPrimaryByCampaignId`), então
  // não existe mais cópia para manter — a peça primária é a única fonte de
  // verdade do roteiro, sempre atual.
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
