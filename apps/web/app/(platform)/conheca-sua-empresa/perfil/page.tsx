import { redirect } from "next/navigation";
import {
  BrandBrainRepository,
  BrandOnboardingAnswerRepository,
  buildOnboardingSynthesis,
} from "@ayon/core";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { SynthesisFieldCard } from "../conversa/synthesis-field-card";
import { updateBrandBrainFieldAction } from "../actions";

/**
 * ONB-4 — Perfil da Marca (ux-design.md §3.2): visão persistente e editável
 * da identidade, disponível a qualquer momento pelo menu "Conheça sua
 * Empresa" — nunca trava mesmo depois de confirmada.
 */
export default async function PerfilDaMarcaPage() {
  const session = await getCurrentSession();

  if (!session?.brand) {
    redirect("/painel");
  }

  const db = createClient();
  const brandBrainRepository = new BrandBrainRepository(db);
  const answersRepository = new BrandOnboardingAnswerRepository(db);

  const profile = await brandBrainRepository.findByBrandId(session.brand.id);

  if (!profile?.onboarding_confirmed_at) {
    redirect("/conheca-sua-empresa");
  }

  const answers = await answersRepository.findByBrandId(session.brand.id);
  const synthesis = buildOnboardingSynthesis(profile, answers);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Perfil da {session.brand.name}</h1>
        <p className="text-sm text-muted-foreground">
          O que a Ayon sabe sobre a empresa até agora — editável a qualquer momento.
        </p>
      </div>

      <div className="space-y-3">
        {synthesis.map((field) => (
          <SynthesisFieldCard key={field.questionKey} field={field} onSave={updateBrandBrainFieldAction} />
        ))}
      </div>
    </div>
  );
}
