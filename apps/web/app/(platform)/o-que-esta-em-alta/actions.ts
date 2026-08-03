"use server";

import { revalidatePath } from "next/cache";
import { hasMinimumRole, logger, runTrendDiscovery } from "@ayon/core";
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
}

const FRIENDLY_ERROR = "Não consegui buscar tendências agora. Pode tentar de novo em instantes?";

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
    const sessionDb = createClient();
    const serviceRoleDb = createServiceRoleClient();
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    const result = await runTrendDiscovery({
      db: sessionDb,
      serviceRoleDb,
      tier,
      brandId: session.brand.id,
      brandName: session.brand.name,
      niche: session.brand.niche,
      actorUserId: session.user.id,
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
    logger.error("trend_engine.discovery_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}
