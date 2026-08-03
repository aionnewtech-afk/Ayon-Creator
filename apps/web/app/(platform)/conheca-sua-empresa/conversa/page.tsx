import { redirect } from "next/navigation";
import {
  BrandBrainRepository,
  KnowledgeBaseItemRepository,
  decodeConversationLog,
  hasMinimumRole,
  knownFieldsFromProfile,
  type SynthesisFieldEntry,
} from "@ayon/core";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { OnboardingChat } from "./onboarding-chat";

/**
 * ONB-2 — Conversa com o Consultor (ux-design.md §4.2). Server Component
 * responsável só por carregar o estado (retomada) e decidir se mostra o
 * chat ou, se a conversa já foi concluída mas não confirmada, a revisão da
 * síntese (ONB-3) — ambos vivem no mesmo componente cliente porque são uma
 * experiência contínua, não uma navegação de tela.
 */
export default async function ConversaPage() {
  const session = await getCurrentSession();

  if (!session?.brand || !session.membership) {
    redirect("/painel");
  }

  if (!hasMinimumRole(session.membership.role, "admin")) {
    redirect("/conheca-sua-empresa");
  }

  const db = createClient();
  const brandBrainRepository = new BrandBrainRepository(db);
  const knowledgeBaseRepository = new KnowledgeBaseItemRepository(db);

  const profile = await brandBrainRepository.findByBrandId(session.brand.id);

  if (profile?.onboarding_confirmed_at) {
    redirect("/conheca-sua-empresa/perfil");
  }

  const knowledgeBaseItems = await knowledgeBaseRepository.findByBrandId(session.brand.id);
  const conversationItems = knowledgeBaseItems.filter((item) => item.source_type === "onboarding_conversation");
  const initialMessages = decodeConversationLog(conversationItems);

  // Chips iniciais (retomada): derivados diretamente dos campos já
  // preenchidos — não são a frase exata que a Ayon usou ao vivo, mas
  // mantêm o painel "O que a Ayon já sabe" coerente entre sessões sem
  // precisar de uma tabela nova só para isso.
  const initialChips = knownFieldsFromProfile(profile).map(
    (field) => `${field.value}`.length > 80 ? `${field.value.slice(0, 77)}...` : field.value,
  );

  return (
    <OnboardingChat
      brandId={session.brand.id}
      brandName={session.brand.name}
      initialMessages={initialMessages}
      initialChips={initialChips}
      initiallyCompleted={Boolean(profile?.onboarding_completed_at)}
      initialSynthesis={(profile?.onboarding_synthesis as SynthesisFieldEntry[] | null) ?? null}
    />
  );
}
