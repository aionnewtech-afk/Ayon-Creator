"use server";

import { revalidatePath } from "next/cache";
import {
  InactiveSubscriptionError,
  InsufficientCreditsError,
  ensureSufficientCredits,
  hasMinimumRole,
  logger,
  recordConsumption,
  runTrendDiscovery,
} from "@ayon/core";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface RankedTrendView {
  title: string;
  summary: string;
  rationale: string;
  sourceUrl: string | null;
}

export interface RunTrendDiscoveryResult {
  ok: boolean;
  trendResearchId?: string;
  rankings?: RankedTrendView[];
  overallRationale?: string;
  candidateCount?: number;
  error?: string;
  blockedReason?: "inactive_subscription" | "insufficient_credits";
}

const FRIENDLY_ERROR = "Não consegui buscar tendências agora. Pode tentar de novo em instantes?";
const TREND_RANKING_TRIGGER_REASON = "trend_ranking";

/**
 * Aciona uma descoberta de tendências completa (Fluxo 2): Trend Source
 * Provider → Trend Engine → Intelligence Hub → ranqueamento final. Nenhuma
 * tendência chega à tela sem passar por aqui (architecture.md §3.3).
 */
export async function runTrendDiscoveryAction(): Promise<RunTrendDiscoveryResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode buscar novas tendências por enquanto." };
  }

  if (!session.brand.niche) {
    return {
      ok: false,
      error: "Ainda não sabemos o nicho da sua empresa. Complete a conversa em \"Conheça sua Empresa\" primeiro.",
    };
  }

  try {
    const sessionDb = await createClient();
    const serviceRoleDb = createServiceRoleClient();
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    const { costCredits } = await ensureSufficientCredits({
      serviceRoleDb,
      organizationId: session.organization.id,
      triggerReason: TREND_RANKING_TRIGGER_REASON,
      tier,
    });

    const result = await runTrendDiscovery({
      db: sessionDb,
      serviceRoleDb,
      tier,
      brandId: session.brand.id,
      brandName: session.brand.name,
      niche: session.brand.niche,
      actorUserId: session.user.id,
    });

    await recordConsumption({
      serviceRoleDb,
      organizationId: session.organization.id,
      costCredits,
      intelligenceHubSessionId: result.sessionId,
      description: `Busca de tendências — ${session.brand.name}`,
    });

    revalidatePath("/o-que-esta-em-alta");

    return {
      ok: true,
      trendResearchId: result.trendResearchId,
      rankings: result.rankings,
      overallRationale: result.overallRationale,
      candidateCount: result.candidateCount,
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
        error: "Créditos insuficientes para buscar tendências. Compre mais créditos em Configurações.",
      };
    }

    logger.error("trend_engine.discovery_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}
