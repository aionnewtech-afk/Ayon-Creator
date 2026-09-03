import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { BrandBrainRepository } from "../repositories/brand-brain.repository";
import { SpecialistRepository } from "../repositories/specialist.repository";
import { IntelligenceHubSessionRepository } from "../repositories/intelligence-hub-session.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { knownFieldsFromProfile, learnedPreferencesTextFromProfile } from "../brand-brain/onboarding-themes";
import { runSpecialistPanel, type SpecialistOpinionResult } from "./run-specialist-panel";
import { runCoordinator } from "./run-coordinator";
import { researchCampaignObjective } from "./research-campaign-objective";

export interface RunCampaignStrategySessionParams {
  /** Client de sessão (RLS) — grava campaigns/intelligence_hub_sessions/specialist_opinions. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve o Specialist Registry e provider_configs. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  brandId: string;
  brandName: string;
  /** ★ Achado real (pedido direto do usuário — "a pesquisa tem que de fato valer a pena"): repassado pra `researchCampaignObjective` dar contexto de nicho à busca. */
  niche: string | null;
  objective: string;
  actorUserId: string;
}

export interface RunCampaignStrategySessionResult {
  campaignId: string;
  sessionId: string;
  opinions: SpecialistOpinionResult[];
  executiveSummary: string | null;
  consolidatedStrategy: string;
  rationale: string;
  divergences: string | null;
}

const CAMPAIGN_STRATEGY_DECISION_TYPE = "campaign_strategy";

interface RunStrategyForCampaignParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  brandId: string;
  brandName: string;
  niche: string | null;
  objective: string;
  campaignId: string;
}

interface RunStrategyForCampaignResult {
  sessionId: string;
  opinions: SpecialistOpinionResult[];
  executiveSummary: string | null;
  consolidatedStrategy: string;
  rationale: string;
  divergences: string | null;
}

/**
 * Núcleo compartilhado (painel de especialistas + Coordinator + gravação da
 * sessão) entre `runCampaignStrategySession` (campanha nova) e
 * `redoCampaignStrategySession` (pedido direto do usuário — "quero poder
 * redigitar a pesquisa/estratégia" depois de aprovar e achar o texto
 * genérico demais: reprocessar com um objetivo ajustado, sem precisar criar
 * uma campanha do zero). Não mexe na linha de `campaigns` — cada chamador
 * decide se cria ou atualiza.
 */
async function runStrategyForCampaign(params: RunStrategyForCampaignParams): Promise<RunStrategyForCampaignResult> {
  const brandBrainRepository = new BrandBrainRepository(params.db);
  const specialistRepository = new SpecialistRepository(params.serviceRoleDb);
  const sessionRepository = new IntelligenceHubSessionRepository(params.db);

  const profile = await brandBrainRepository.findByBrandId(params.brandId);
  const knownFields = knownFieldsFromProfile(profile);
  const learnedPreferencesText = learnedPreferencesTextFromProfile(profile);

  const session = await sessionRepository.create({
    brand_id: params.brandId,
    related_entity_type: "campaign",
    related_entity_id: params.campaignId,
    trigger_reason: CAMPAIGN_STRATEGY_DECISION_TYPE,
  });

  try {
    const [specialists, coordinator] = await Promise.all([
      specialistRepository.findApplicable(CAMPAIGN_STRATEGY_DECISION_TYPE),
      specialistRepository.findCoordinator(),
    ]);

    if (specialists.length === 0) {
      throw new Error(
        `Nenhum especialista ativo aplicável a "${CAMPAIGN_STRATEGY_DECISION_TYPE}" no Specialist Registry.`,
      );
    }
    if (!coordinator) {
      throw new Error("Nenhum Coordinator ativo no Specialist Registry.");
    }

    // ★ Achado real (pedido direto do usuário — "a pesquisa tem que de fato
    // valer a pena, pesquisar 5 destinos... com o que se pode esperar em
    // cada"): roda ANTES do painel — nunca bloqueia a sessão (retorna `null`
    // sem provider configurado ou se a busca falhar), só enriquece o
    // contexto de quem já ia rodar de qualquer jeito.
    const researchNotes = await researchCampaignObjective({
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      objective: params.objective,
      brandName: params.brandName,
      niche: params.niche,
    });

    const opinions = await runSpecialistPanel({
      db: params.db,
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      sessionId: session.id,
      brandName: params.brandName,
      knownFields,
      learnedPreferencesText,
      objective: params.objective,
      researchNotes: researchNotes ?? undefined,
      specialists,
    });

    const coordinatorResult = await runCoordinator({
      serviceRoleDb: params.serviceRoleDb,
      tier: params.tier,
      coordinator,
      brandName: params.brandName,
      knownFields,
      learnedPreferencesText,
      objective: params.objective,
      opinions,
      researchNotes: researchNotes ?? undefined,
    });

    const consolidatedResult = {
      executive_summary: coordinatorResult.executiveSummary,
      consolidated_strategy: coordinatorResult.consolidatedStrategy,
      rationale: coordinatorResult.rationale,
      divergences: coordinatorResult.divergences,
    };

    await sessionRepository.update(session.id, {
      status: "completed",
      consolidated_result: consolidatedResult,
      coordinator_provider_key: coordinatorResult.providerKey,
      completed_at: new Date().toISOString(),
    });

    return {
      sessionId: session.id,
      opinions,
      executiveSummary: coordinatorResult.executiveSummary,
      consolidatedStrategy: coordinatorResult.consolidatedStrategy,
      rationale: coordinatorResult.rationale,
      divergences: coordinatorResult.divergences,
    };
  } catch (error) {
    await sessionRepository.update(session.id, { status: "failed" }).catch(() => undefined);
    throw error;
  }
}

/**
 * Orquestra uma sessão completa do Intelligence Hub para estratégia de
 * campanha (Fluxo 10): resolve o painel via Specialist Registry, aciona cada
 * especialista em paralelo, aciona o Coordinator, e grava tudo. Nenhuma
 * campanha existe sem sessão do Intelligence Hub (Princípio do Consultor
 * Permanente, PRD §1.1, item 7) — por isso a sessão nasce antes da campanha,
 * com o id da campanha pré-gerado (ver nota sobre a ordem abaixo).
 */
export async function runCampaignStrategySession(
  params: RunCampaignStrategySessionParams,
): Promise<RunCampaignStrategySessionResult> {
  const campaignRepository = new CampaignRepository(params.db);

  // `campaigns.intelligence_hub_session_id` é NOT NULL COM FK real pra
  // `intelligence_hub_sessions.id` — por isso a campanha só é criada DEPOIS
  // que `runStrategyForCampaign` já criou a sessão de verdade (`related_entity_id`
  // é polimórfico, sem FK, então referenciar um `campaignId` pré-gerado ali
  // dentro é seguro mesmo a campanha ainda não existindo). Efeito colateral
  // aceito: se o painel de especialistas falhar, nenhuma linha de campanha
  // chega a existir — nunca aparece como "Falhou" em `/campanhas`, só o erro
  // é mostrado na hora (nenhuma tentativa fantasma pra limpar depois).
  const campaignId = crypto.randomUUID();

  const result = await runStrategyForCampaign({
    db: params.db,
    serviceRoleDb: params.serviceRoleDb,
    tier: params.tier,
    brandId: params.brandId,
    brandName: params.brandName,
    niche: params.niche,
    objective: params.objective,
    campaignId,
  });

  await campaignRepository.create({
    id: campaignId,
    brand_id: params.brandId,
    intelligence_hub_session_id: result.sessionId,
    title: deriveCampaignTitle(params.objective),
    status: "ready_for_review",
    created_by: params.actorUserId,
    strategy_summary: {
      executive_summary: result.executiveSummary,
      consolidated_strategy: result.consolidatedStrategy,
      rationale: result.rationale,
      divergences: result.divergences,
    },
  });

  return { campaignId, ...result };
}

export interface RedoCampaignStrategySessionParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  brandId: string;
  brandName: string;
  niche: string | null;
  objective: string;
  campaignId: string;
}

/**
 * ★ Achado real (pedido direto do usuário — "quero poder redigitar a
 * pesquisa/estratégia... a pesquisa tem que de fato valer a pena"): reprocessa
 * a mesma campanha com um objetivo ajustado, sem criar uma campanha nova —
 * nova sessão do Intelligence Hub, nova cobrança em créditos (mesmo padrão
 * de `createCampaignStrategyAction`), `campaigns.strategy_summary`/
 * `intelligence_hub_session_id` sobrescritos com o resultado novo. Nunca
 * mexe em `content_pieces` diretamente — quem chama decide o que fazer com
 * peças que já existiam (ver `approveCampaignStrategyAction`).
 */
export async function redoCampaignStrategySession(
  params: RedoCampaignStrategySessionParams,
): Promise<RunCampaignStrategySessionResult> {
  const campaignRepository = new CampaignRepository(params.db);

  const result = await runStrategyForCampaign({
    db: params.db,
    serviceRoleDb: params.serviceRoleDb,
    tier: params.tier,
    brandId: params.brandId,
    brandName: params.brandName,
    niche: params.niche,
    objective: params.objective,
    campaignId: params.campaignId,
  });

  await campaignRepository.update(params.campaignId, {
    intelligence_hub_session_id: result.sessionId,
    strategy_summary: {
      executive_summary: result.executiveSummary,
      consolidated_strategy: result.consolidatedStrategy,
      rationale: result.rationale,
      divergences: result.divergences,
    },
    status: "ready_for_review",
  });

  return { campaignId: params.campaignId, ...result };
}

function deriveCampaignTitle(objective: string): string {
  const trimmed = objective.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}
