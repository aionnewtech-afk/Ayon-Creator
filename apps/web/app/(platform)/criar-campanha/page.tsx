import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { hasMinimumRole } from "@ayon/core";
import { EmptyState } from "@ayon/ui";
import { getCurrentSession } from "@/lib/session";
import { CampaignStrategyFlow } from "./campaign-strategy-flow";

/**
 * CAMP-1/2/3 simplificado (Missão 3) — um objetivo de campanha entra, o
 * Intelligence Hub reúne o painel de especialistas do Specialist Registry e
 * o Coordinator, e a tela mostra opiniões individuais + estratégia
 * consolidada + justificativa ("Por que fiz assim?"). Ainda sem geração de
 * conteúdo (PRD §7, escopo da Missão 3).
 */
export default async function CriarCampanhaPage({
  searchParams,
}: {
  searchParams: { tema?: string };
}) {
  const session = await getCurrentSession();

  if (!session?.brand || !session.membership) {
    redirect("/painel");
  }

  const canCreate = hasMinimumRole(session.membership.role, "editor");

  if (!canCreate) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Só quem edita a conta pode criar campanhas"
        description="Peça para um editor ou administrador da organização criar essa campanha."
      />
    );
  }

  return <CampaignStrategyFlow brandName={session.brand.name} initialObjective={searchParams.tema} />;
}
