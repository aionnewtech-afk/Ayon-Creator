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
      description="Sua organização está pronta. Crie uma campanha para começar — o histórico completo fica disponível em Campanhas."
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
