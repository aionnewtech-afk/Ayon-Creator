import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SubscriptionStatus } from "@ayon/types";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { CreditLedgerRepository } from "../repositories/credit-ledger.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { OrganizationRepository } from "../repositories/organization.repository";
import { getMercadoPagoPayment, getMercadoPagoPreapproval } from "./mercado-pago-client";
import { logger } from "../logger";

export interface HandleMercadoPagoWebhookParams {
  /** Client de service role — subscriptions/credit_ledger não têm policy de escrita para usuário final. */
  serviceRoleDb: SupabaseClient<Database>;
  type: string;
  dataId: string;
}

/**
 * Processa uma notificação de webhook do Mercado Pago já com assinatura
 * validada (ver `verifyMercadoPagoWebhookSignature`, chamada na borda —
 * apps/web/app/api/webhooks/mercado-pago/route.ts). O webhook é a fonte de
 * verdade do pagamento, nunca o redirect do navegador (Fluxo 12).
 */
export async function handleMercadoPagoWebhook(params: HandleMercadoPagoWebhookParams): Promise<void> {
  if (params.type === "payment") {
    await handlePaymentNotification(params.serviceRoleDb, params.dataId);
    return;
  }

  if (params.type === "subscription_preapproval") {
    await handlePreapprovalNotification(params.serviceRoleDb, params.dataId);
    return;
  }

  logger.info("billing.webhook_ignored", { type: params.type, dataId: params.dataId });
}

/** Compra avulsa de créditos (Checkout Pro) — Fluxo 12, "comprar créditos avulsos". */
async function handlePaymentNotification(db: SupabaseClient<Database>, paymentId: string): Promise<void> {
  const payment = await getMercadoPagoPayment(paymentId);

  if (payment.status !== "approved") {
    logger.info("billing.payment_not_approved", { paymentId, status: payment.status });
    return;
  }

  const metadata = payment.metadata as
    | { organization_id?: string; credit_package_id?: string; credits?: number }
    | undefined;

  if (!metadata?.organization_id || !metadata.credits) {
    logger.warn("billing.payment_missing_metadata", { paymentId });
    return;
  }

  const creditLedgerRepository = new CreditLedgerRepository(db);

  try {
    await creditLedgerRepository.create({
      organization_id: metadata.organization_id,
      type: "purchase",
      amount: metadata.credits,
      external_payment_id: String(payment.id),
      description: `Compra de créditos avulsos${metadata.credit_package_id ? ` — pacote ${metadata.credit_package_id}` : ""}`,
    });
  } catch (error) {
    // external_payment_id é unique — uma reentrega do mesmo webhook falha
    // aqui em vez de duplicar crédito (arch. §12.2, idempotência).
    if (isUniqueViolation(error)) {
      logger.info("billing.payment_already_processed", { paymentId });
      return;
    }
    throw error;
  }
}

const PREAPPROVAL_STATUS_MAP: Record<string, SubscriptionStatus> = {
  authorized: "active",
  paused: "past_due",
  pending: "past_due",
  cancelled: "canceled",
};

/** Assinatura de plano (Preapproval) — Fluxo 12, "assinar/trocar de plano". */
async function handlePreapprovalNotification(db: SupabaseClient<Database>, preapprovalId: string): Promise<void> {
  const preapproval = await getMercadoPagoPreapproval(preapprovalId);

  const [organizationId, plan] = (preapproval.external_reference ?? "").split(":");
  if (!organizationId || !plan) {
    logger.warn("billing.preapproval_missing_external_reference", { preapprovalId });
    return;
  }

  const status = PREAPPROVAL_STATUS_MAP[preapproval.status ?? ""] ?? "past_due";

  const subscriptionRepository = new SubscriptionRepository(db);
  const existing = await subscriptionRepository.findByOrganizationId(organizationId);
  const wasActive = existing?.status === "active";

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await subscriptionRepository.upsertByOrganizationId(organizationId, {
    plan: plan as Database["public"]["Tables"]["subscriptions"]["Row"]["plan"],
    status,
    billing_provider_ref: preapprovalId,
    current_period_start: status === "active" ? now.toISOString() : (existing?.current_period_start ?? null),
    current_period_end: status === "active" ? periodEnd.toISOString() : (existing?.current_period_end ?? null),
  });

  // grant_plan só na transição PARA active (nova ativação ou renovação) —
  // nunca em toda reentrega de webhook, senão duplicaria crédito a cada
  // notificação repetida do mesmo status.
  if (status === "active" && !wasActive) {
    await activatePlan(db, organizationId, plan);
  }
}

/**
 * Concede os créditos do ciclo e sincroniza `organizations.provider_tier`
 * com o tier incluso no plano (PRD §8: "Pro inclui tier Balanceado",
 * "Business inclui tier Premium") — achado durante a validação real: sem
 * isso, um cliente pagando Pro/Business continuava recebendo o tier
 * Econômico em toda geração, porque `organizations.provider_tier` nunca
 * era atualizado pela assinatura.
 */
async function activatePlan(db: SupabaseClient<Database>, organizationId: string, plan: string): Promise<void> {
  const planRepository = new PlanRepository(db);
  const planRow = await planRepository.findByPlan(plan as Database["public"]["Tables"]["plans"]["Row"]["plan"]);

  if (!planRow) {
    logger.error("billing.plan_not_found", { organizationId, plan });
    return;
  }

  const organizationRepository = new OrganizationRepository(db);
  await organizationRepository.update(organizationId, { provider_tier: planRow.tier_included });

  const creditLedgerRepository = new CreditLedgerRepository(db);
  await creditLedgerRepository.create({
    organization_id: organizationId,
    type: "grant_plan",
    amount: planRow.monthly_credits,
    description: `Créditos do ciclo — plano ${plan}`,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
}
