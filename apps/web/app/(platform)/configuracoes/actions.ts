"use server";

import { CreditPackageRepository, PlanRepository, hasMinimumRole, logger } from "@ayon/core";
import { createCreditPurchasePreference, createSubscriptionPreapproval } from "@ayon/core/src/billing/mercado-pago-client";
import type { SubscriptionPlan } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface CheckoutRedirectResult {
  ok: boolean;
  initPoint?: string;
  error?: string;
}

const FRIENDLY_ERROR = "Não consegui iniciar o pagamento agora. Pode tentar de novo em instantes?";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010";

/** Assinar ou trocar de plano (CFG-2) — Fluxo 12, "assinar/trocar de plano". */
export async function subscribeToPlanAction(plan: SubscriptionPlan): Promise<CheckoutRedirectResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.user.email) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode mudar o plano." };
  }

  try {
    const serviceRoleDb = createServiceRoleClient();
    const planRepository = new PlanRepository(serviceRoleDb);
    const planRow = await planRepository.findByPlan(plan);

    if (!planRow) {
      return { ok: false, error: FRIENDLY_ERROR };
    }

    const { initPoint } = await createSubscriptionPreapproval({
      organizationId: session.organization.id,
      plan,
      payerEmail: session.user.email,
      reason: `Ayon Creator — plano ${plan}`,
      transactionAmountCents: planRow.price_cents,
      backUrl: `${APP_URL}/configuracoes`,
    });

    return { ok: true, initPoint };
  } catch (error) {
    logger.error("billing.subscribe_failed", {
      organizationId: session.organization.id,
      plan,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/** Comprar um pacote de créditos avulsos (CFG-4) — Fluxo 12, "comprar créditos avulsos". */
export async function buyCreditsAction(creditPackageId: string): Promise<CheckoutRedirectResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode comprar créditos." };
  }

  try {
    const serviceRoleDb = createServiceRoleClient();
    const creditPackageRepository = new CreditPackageRepository(serviceRoleDb);
    const creditPackage = await creditPackageRepository.findById(creditPackageId);

    if (!creditPackage) {
      return { ok: false, error: FRIENDLY_ERROR };
    }

    const { initPoint } = await createCreditPurchasePreference({
      organizationId: session.organization.id,
      creditPackageId: creditPackage.id,
      packageName: creditPackage.name,
      credits: creditPackage.credits,
      priceCents: creditPackage.price_cents,
      backUrl: `${APP_URL}/configuracoes`,
      notificationUrl: `${APP_URL}/api/webhooks/mercado-pago`,
    });

    return { ok: true, initPoint };
  } catch (error) {
    logger.error("billing.buy_credits_failed", {
      organizationId: session.organization.id,
      creditPackageId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}
