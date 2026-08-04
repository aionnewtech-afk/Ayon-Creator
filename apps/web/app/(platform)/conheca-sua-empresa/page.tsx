import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { BrandBrainRepository, hasMinimumRole } from "@ayon/core";
import { Button, EmptyState } from "@ayon/ui";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * ONB-1 — Convite para a conversa (ux-design.md §3.2). Nunca "vamos fazer
 * algumas perguntas" — prepara o usuário para conversar com a Ayon, não
 * para preencher um cadastro (Princípio do Consultor Permanente, PRD §1.1).
 */
export default async function ConhecaSuaEmpresaPage() {
  const session = await getCurrentSession();

  if (!session?.brand || !session.membership) {
    redirect("/painel");
  }

  const db = await createClient();
  const brandBrainRepository = new BrandBrainRepository(db);
  const profile = await brandBrainRepository.findByBrandId(session.brand.id);

  if (profile?.onboarding_confirmed_at) {
    redirect("/conheca-sua-empresa/perfil");
  }

  const canConverse = hasMinimumRole(session.membership.role, "admin");
  const inProgress = Boolean(profile);

  if (!canConverse) {
    return (
      <EmptyState
        icon={Building2}
        title="A Ayon ainda está conhecendo a sua empresa"
        description="Só quem administra a conta pode conversar com a Ayon por enquanto. Peça para um admin ou responsável da organização continuar essa conversa."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Building2 className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Vamos conhecer a {session.brand.name}
        </h1>
        <p className="text-muted-foreground">
          Isso não é um formulário — é uma conversa real com a Ayon, sua consultora de marketing
          permanente. Ela vai reagir ao que você contar, conectar os pontos e, no final, já vai
          pensar na {session.brand.name} como parte do time.
        </p>
      </div>
      <Link href="/conheca-sua-empresa/conversa">
        <Button size="lg">{inProgress ? "Continuar a conversa" : "Vamos conversar"}</Button>
      </Link>
    </div>
  );
}
