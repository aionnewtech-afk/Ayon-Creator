"use server";

import { revalidatePath } from "next/cache";
import {
  AuditRepository,
  BrandBrainRepository,
  OnboardingTurnParseError,
  hasMinimumRole,
  logger,
  replaceProfileFieldPatch,
  resolveLlmProvider,
  runOnboardingTurn,
  type SynthesisFieldEntry,
} from "@ayon/core";
import type { OnboardingQuestionKey } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface SendOnboardingMessageResult {
  ok: boolean;
  reply?: string;
  knowledgeChip?: string | null;
  conversationComplete?: boolean;
  synthesis?: SynthesisFieldEntry[];
  error?: string;
}

const FRIENDLY_ERROR =
  "Não consegui processar isso agora. Pode tentar de novo em instantes?";

/**
 * Processa um turno da conversa "Conheça sua empresa" (Fluxo 1). `message`
 * é `null` apenas na primeira chamada de uma conversa nova (kickoff — Ayon
 * abre o primeiro tema sem esperar nada do usuário).
 */
export async function sendOnboardingMessageAction(
  message: string | null,
): Promise<SendOnboardingMessageResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode conversar com a Ayon por enquanto." };
  }

  try {
    const sessionDb = await createClient();
    const serviceRoleDb = createServiceRoleClient();
    const tier = session.brand.provider_tier ?? session.organization.provider_tier;
    const llmProvider = await resolveLlmProvider(serviceRoleDb, tier);

    const result = await runOnboardingTurn({
      db: sessionDb,
      llmProvider,
      brandId: session.brand.id,
      brandName: session.brand.name,
      actorUserId: session.user.id,
      userMessage: message,
    });

    revalidatePath("/conheca-sua-empresa");

    return {
      ok: true,
      reply: result.reply,
      knowledgeChip: result.knowledgeChip,
      conversationComplete: result.conversationComplete,
      synthesis: result.synthesis,
    };
  } catch (error) {
    if (error instanceof OnboardingTurnParseError) {
      logger.warn("onboarding.turn_parse_failed", { brandId: session.brand.id, rawText: error.rawText });
    } else {
      logger.error("onboarding.turn_failed", {
        brandId: session.brand.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/**
 * Confirmação explícita da síntese (ONB-3 → "Isso mesmo, pode seguir") —
 * nunca automática (Princípio do Consultor Permanente, PRD §1.1).
 */
export async function confirmOnboardingSynthesisAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode confirmar o entendimento da Ayon." };
  }

  const db = await createClient();
  const brandBrainRepository = new BrandBrainRepository(db);
  const auditRepository = new AuditRepository(db);

  await brandBrainRepository.upsertByBrandId(session.brand.id, {
    onboarding_confirmed_at: new Date().toISOString(),
    created_by: session.user.id,
  });

  await auditRepository.record({
    organization_id: session.organization.id,
    actor_user_id: session.user.id,
    action: "brand.onboarding_confirmed",
    entity_type: "brand",
    entity_id: session.brand.id,
  });

  revalidatePath("/conheca-sua-empresa");
  revalidatePath("/painel");

  return { ok: true };
}

/**
 * Edição manual de um campo do Perfil da Marca (ONB-3/ONB-4) — sempre
 * disponível, nunca travada mesmo após a conversa concluída (ux-design.md §3.2).
 */
export async function updateBrandBrainFieldAction(
  questionKey: OnboardingQuestionKey,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode editar o perfil da marca." };
  }

  const db = await createClient();
  const brandBrainRepository = new BrandBrainRepository(db);
  const patch = replaceProfileFieldPatch(questionKey, value);

  await brandBrainRepository.upsertByBrandId(session.brand.id, {
    ...patch,
    created_by: session.user.id,
  });

  revalidatePath("/conheca-sua-empresa");
  revalidatePath("/conheca-sua-empresa/perfil");

  return { ok: true };
}
