import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { LearningInsightRepository, hasMinimumRole } from "@ayon/core";
import { EmptyState } from "@ayon/ui";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { InsightList } from "./insight-list";
import type { LearningInsightView } from "./actions";

/**
 * EVOL-1 (Missão 8) — Sugestões Pendentes + Histórico numa única tela
 * (ux-design.md §3.8, EVOL-2/EVOL-3 consolidadas). Só admin/owner administra
 * (mesmo nível de acesso de Configurações) — a busca em si é disparada pelo
 * usuário (actions.ts, `runLearningAnalysisAction`), gratuita, sem cron/n8n.
 */
export default async function OQueFuncionouPage() {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    redirect("/painel");
  }

  const canManage = hasMinimumRole(session.membership.role, "admin");

  if (!canManage) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Só quem administra a conta acessa O que Funcionou"
        description="Peça para um administrador ou dono da organização revisar as sugestões de aprendizado da marca."
      />
    );
  }

  const db = createClient();
  const learningInsightRepository = new LearningInsightRepository(db);
  const insights = await learningInsightRepository.findByBrandId(session.brand.id);

  const initialInsights: LearningInsightView[] = insights.map((row) => {
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
  });

  return <InsightList brandName={session.brand.name} initialInsights={initialInsights} />;
}
