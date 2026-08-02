import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants, EmptyState } from "@ayon/ui";
import { navItemHref, NAV_ITEMS } from "@/config/navigation";

export default function PainelPage() {
  const criarCampanha = NAV_ITEMS.find((item) => item.slug === "criar-campanha");

  return (
    <EmptyState
      icon={Sparkles}
      title="Bem-vindo(a) à Ayon Creator"
      description="Sua organização está pronta. Quando as próximas funcionalidades chegarem, suas campanhas e tendências vão aparecer aqui."
      action={
        criarCampanha ? (
          <Link href={navItemHref(criarCampanha)} className={buttonVariants()}>
            Criar Campanha
          </Link>
        ) : undefined
      }
    />
  );
}
