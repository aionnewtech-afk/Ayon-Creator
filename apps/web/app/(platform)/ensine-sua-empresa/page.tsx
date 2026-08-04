import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { KnowledgeBaseItemRepository, hasMinimumRole } from "@ayon/core";
import { EmptyState } from "@ayon/ui";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeLibrary } from "./knowledge-library";

/**
 * KB-1/2/3 (Missão 4) — Biblioteca de Conhecimento. Itens de
 * `onboarding_conversation` aparecem aqui só como leitura (editáveis via
 * Perfil da Marca, ONB-4) — o resto (documentos, conteúdo antigo, FAQs,
 * notas) é gerenciado inteiramente nesta tela.
 */
export default async function EnsineSuaEmpresaPage() {
  const session = await getCurrentSession();

  if (!session?.brand || !session.membership) {
    redirect("/painel");
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Só quem edita a conta pode ensinar a IA"
        description="Peça para um editor ou administrador da organização enviar documentos e materiais para a Ayon."
      />
    );
  }

  const db = await createClient();
  const knowledgeBaseRepository = new KnowledgeBaseItemRepository(db);
  const items = await knowledgeBaseRepository.findByBrandId(session.brand.id);

  return <KnowledgeLibrary brandName={session.brand.name} initialItems={items} />;
}
