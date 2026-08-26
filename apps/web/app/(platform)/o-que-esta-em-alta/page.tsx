import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { TREND_CATEGORIES, TrendResearchRepository, hasMinimumRole } from "@ayon/core";
import { EmptyState } from "@ayon/ui";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { RankedTrendView } from "./actions";
import { TrendList, type TrendResearchView } from "./trend-list";

/**
 * TREND-1/TREND-2 (Missão 5) — descoberta de tendências. A busca em si é
 * disparada pelo usuário (actions.ts, `runTrendDiscoveryAction`); esta tela
 * mostra a última execução já feita para a marca, se existir.
 */
export default async function OQueEstaEmAltaPage() {
  const session = await getCurrentSession();

  if (!session?.brand || !session.membership) {
    redirect("/painel");
  }

  const db = await createClient();
  const trendResearchRepository = new TrendResearchRepository(db);
  const latest = await trendResearchRepository.findLatestByBrandId(session.brand.id);

  const canTrigger = hasMinimumRole(session.membership.role, "editor");

  if (!session.brand.niche && !latest) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Ainda não sabemos o nicho da sua empresa"
        description="Complete a conversa em “Conheça sua Empresa” para a Ayon poder buscar tendências relevantes para o seu negócio."
      />
    );
  }

  const initialTrendResearch: TrendResearchView | null =
    latest && latest.status === "completed"
      ? {
          id: latest.id,
          rankings: normalizeRankings((latest.summary as { rankings?: unknown[] } | null)?.rankings),
          overallRationale:
            ((latest.summary as { overall_rationale?: string } | null)?.overall_rationale) ?? "",
        }
      : null;

  return (
    <TrendList
      brandName={session.brand.name}
      canTrigger={canTrigger}
      initialTrendResearch={initialTrendResearch}
    />
  );
}

/**
 * ★ `trend_research.summary` é jsonb livre — pesquisas salvas antes da
 * categorização (achado real, pedido de blocos por tipo de sinal) não têm
 * `category` nenhuma. Nunca deixa a tela quebrar com uma categoria
 * inválida/ausente — cai em "geral" (sempre existe como bloco na UI).
 */
function normalizeRankings(raw: unknown[] | undefined): RankedTrendView[] {
  if (!raw) return [];
  return raw.map((item) => {
    const ranking = item as Partial<RankedTrendView>;
    const category = TREND_CATEGORIES.includes(ranking.category as (typeof TREND_CATEGORIES)[number])
      ? (ranking.category as RankedTrendView["category"])
      : "geral";
    return {
      title: ranking.title ?? "",
      summary: ranking.summary ?? "",
      rationale: ranking.rationale ?? "",
      sourceUrl: ranking.sourceUrl ?? null,
      category,
    };
  });
}
