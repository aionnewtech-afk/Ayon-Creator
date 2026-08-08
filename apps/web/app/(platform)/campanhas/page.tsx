import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { CampaignRepository } from "@ayon/core";
import { Badge, buttonVariants, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@ayon/ui";
import type { CampaignStatus } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  generating: "Gerando",
  ready_for_review: "Pronta para revisão",
  approved: "Aprovada",
  package_ready: "Pacote pronto",
  failed: "Falhou",
};

const STATUS_VARIANTS: Record<CampaignStatus, "default" | "secondary" | "outline" | "success" | "warning" | "destructive"> = {
  draft: "outline",
  generating: "warning",
  ready_for_review: "warning",
  approved: "secondary",
  package_ready: "success",
  failed: "destructive",
};

/**
 * ★ Sprint de estabilização (Missão 12) — histórico real de campanhas da
 * marca. Antes desta sprint, "Campanhas" era um item `implemented: false`
 * (tela "em breve") — raiz do problema relatado: conteúdo gerado (textos,
 * imagens, vídeos) não tinha nenhum lugar persistido para reaparecer depois
 * do fluxo de criação.
 */
export default async function CampanhasPage() {
  const session = await getCurrentSession();
  if (!session?.brand || !session.membership) {
    redirect("/painel");
  }

  const db = await createClient();
  const campaignRepository = new CampaignRepository(db);
  const campaigns = await campaignRepository.findByBrandId(session.brand.id);

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Nenhuma campanha ainda"
        description="Quando você criar uma campanha, ela aparece aqui com o histórico de todo o conteúdo gerado."
        action={
          <Link href="/criar-campanha" className={buttonVariants()}>
            Criar Campanha
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Campanhas</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de todas as campanhas da {session.brand.name} — conteúdos, imagens e vídeos gerados.
        </p>
      </div>

      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <Link key={campaign.id} href={`/campanhas/${campaign.id}`} className="block">
            <Card className="transition-colors hover:bg-accent/40">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{campaign.title}</CardTitle>
                <Badge variant={STATUS_VARIANTS[campaign.status]}>{STATUS_LABELS[campaign.status]}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Criada em{" "}
                  {new Date(campaign.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
