import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@ayon/ui";
import { getCurrentSession } from "@/lib/session";
import { CampaignWorkspace } from "../../criar-campanha/campaign-workspace";
import { getCampaignContentPiecesAction } from "../../criar-campanha/asset-actions";
import { getCampaignStrategyForResumeAction } from "../../criar-campanha/actions";

export default async function CampanhaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getCurrentSession();
  if (!session?.brand || !session.membership) {
    redirect("/painel");
  }

  const result = await getCampaignContentPiecesAction(id);
  if (!result.ok) {
    redirect("/campanhas");
  }

  const avatarLooks =
    (session.brand.avatar_looks as { lookId: string; name: string; status: string }[] | null) ?? [];

  if (result.contentPieces && result.contentPieces.length > 0) {
    return (
      <CampaignWorkspace
        brandName={session.brand.name}
        campaignId={id}
        avatarReady={session.brand.avatar_ready}
        avatarName={session.brand.avatar_name}
        avatarLooks={avatarLooks}
        initialMode="content"
        initialContentPieces={result.contentPieces}
        campaignTitle={result.campaignTitle}
        initialPackageReady={result.campaignStatus === "package_ready"}
        initialDownloadUrl={result.packageDownloadUrl}
      />
    );
  }

  // ★ Achado real (pedido direto do usuário — "quero que as alterações nas
  // campanhas sejam salvas automaticamente, pra quando eu retomar não
  // começar do zero"): campanha ainda sem `content_pieces` (saiu antes de
  // clicar em "Aprovar estratégia") — a estratégia consolidada já está
  // persistida, só faltava reabrir esta tela em vez de mandar digitar o
  // objetivo de novo.
  const strategy = await getCampaignStrategyForResumeAction(id);
  if (strategy.ok && strategy.campaignId && strategy.opinions && strategy.consolidatedStrategy && strategy.rationale) {
    return (
      <CampaignWorkspace
        brandName={session.brand.name}
        campaignId={strategy.campaignId}
        avatarReady={session.brand.avatar_ready}
        avatarName={session.brand.avatar_name}
        avatarLooks={avatarLooks}
        initialMode="strategy"
        initialStrategy={{
          opinions: strategy.opinions,
          executiveSummary: strategy.executiveSummary ?? null,
          consolidatedStrategy: strategy.consolidatedStrategy,
          rationale: strategy.rationale,
          divergences: strategy.divergences ?? null,
        }}
      />
    );
  }

  return (
    <EmptyState
      icon={AlertTriangle}
      title="Essa campanha não tem conteúdo ainda"
      description="A estratégia dessa campanha não pôde ser recuperada — pode ter falhado antes de terminar. Crie uma nova campanha para continuar."
    />
  );
}
