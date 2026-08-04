"use server";

import { revalidatePath } from "next/cache";
import {
  BrandBrainRepository,
  InsufficientSignalsError,
  LearningInsightRepository,
  hasMinimumRole,
  logger,
  runLearningAnalysis,
  type LearnedPreferenceEntry,
} from "@ayon/core";
import type { Database, LearningInsightAppliedTo, LearningInsightStatus } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const FRIENDLY_ERROR = "Não consegui fazer isso agora. Pode tentar de novo em instantes?";

export interface LearningInsightView {
  id: string;
  insightType: string;
  text: string;
  rationale: string;
  appliedTo: LearningInsightAppliedTo;
  status: LearningInsightStatus;
  createdAt: string;
}

export interface RunLearningAnalysisActionResult {
  ok: boolean;
  error?: string;
  ranAnalysis?: boolean;
  signalCount?: number;
  minimumRequired?: number;
  insights?: LearningInsightView[];
}

export interface InsightDecisionActionResult {
  ok: boolean;
  error?: string;
  insight?: LearningInsightView;
}

function toView(row: Database["public"]["Tables"]["learning_insights"]["Row"]): LearningInsightView {
  const summary = row.summary as { text?: string; rationale?: string } | null;
  return {
    id: row.id,
    insightType: row.insight_type,
    text: summary?.text ?? "",
    rationale: summary?.rationale ?? "",
    appliedTo: row.applied_to,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Aciona uma nova análise de Brand Evolution sob demanda (Fluxo 8) — gratuita
 * em todos os planos, síncrona, sem cron/n8n. Só quem administra a conta
 * decide (mesmo nível de acesso da tela "O que Funcionou", ux-design.md §2.4).
 */
export async function runLearningAnalysisAction(): Promise<RunLearningAnalysisActionResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode buscar novos aprendizados por enquanto." };
  }

  try {
    const db = await createClient();
    const serviceRoleDb = createServiceRoleClient();
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;

    const result = await runLearningAnalysis({
      db,
      serviceRoleDb,
      tier,
      brandId: session.brand.id,
      brandName: session.brand.name,
    });

    revalidatePath("/o-que-funcionou");

    return {
      ok: true,
      ranAnalysis: true,
      signalCount: result.signalCount,
      insights: result.insights.map(toView),
    };
  } catch (error) {
    if (error instanceof InsufficientSignalsError) {
      return {
        ok: true,
        ranAnalysis: false,
        signalCount: error.available,
        minimumRequired: error.required,
      };
    }

    logger.error("learning_engine.analysis_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * Aceita uma sugestão (Fluxo 8, passo 4-6) — único mecanismo de aplicação:
 * grava em `brand_brain_profiles.learned_preferences`, acumulando (nunca
 * sobrescreve aprendizados aceitos anteriormente). Regra inegociável: nunca
 * acontece sem essa decisão explícita do usuário.
 */
export async function acceptInsightAction(insightId: string): Promise<InsightDecisionActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode aplicar sugestões." };
  }

  const db = await createClient();
  const learningInsightRepository = new LearningInsightRepository(db);
  const brandBrainRepository = new BrandBrainRepository(db);

  const insight = await learningInsightRepository.findById(insightId);
  if (!insight || insight.status !== "pending_review") return { ok: false, error: FRIENDLY_ERROR };

  const summary = insight.summary as { text?: string; rationale?: string } | null;

  const profile = await brandBrainRepository.findByBrandId(session.brand.id);
  const existingPreferences = (profile?.learned_preferences as { insights?: unknown } | null) ?? {};
  const existingInsights = Array.isArray(existingPreferences.insights) ? (existingPreferences.insights as LearnedPreferenceEntry[]) : [];

  const newEntry: LearnedPreferenceEntry = {
    id: insight.id,
    insightType: insight.insight_type,
    appliedTo: insight.applied_to,
    text: summary?.text ?? "",
    appliedAt: new Date().toISOString(),
  };

  await brandBrainRepository.upsertByBrandId(session.brand.id, {
    learned_preferences: { insights: [...existingInsights, newEntry] },
    last_learning_update_at: newEntry.appliedAt,
  });

  const updated = await learningInsightRepository.update(insightId, {
    status: "applied",
    reviewed_by: session.user.id,
  });

  revalidatePath("/o-que-funcionou");
  return { ok: true, insight: toView(updated) };
}

/** Descarta uma sugestão (Fluxo 8, passo 4) — sem justificativa obrigatória (ux-design.md §4.3). */
export async function dismissInsightAction(insightId: string): Promise<InsightDecisionActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode descartar sugestões." };
  }

  const db = await createClient();
  const learningInsightRepository = new LearningInsightRepository(db);

  const insight = await learningInsightRepository.findById(insightId);
  if (!insight || insight.status !== "pending_review") return { ok: false, error: FRIENDLY_ERROR };

  const updated = await learningInsightRepository.update(insightId, {
    status: "dismissed",
    reviewed_by: session.user.id,
  });

  revalidatePath("/o-que-funcionou");
  return { ok: true, insight: toView(updated) };
}
