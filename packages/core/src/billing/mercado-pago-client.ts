import { MercadoPagoConfig, Payment, PreApproval, Preference, WebhookSignatureValidator } from "mercadopago";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import type { PreApprovalResponse } from "mercadopago/dist/clients/preApproval/commonTypes";

/**
 * Único arquivo do monorepo que importa o SDK do Mercado Pago — módulo de
 * Billing dedicado (architecture.md §12), não Provider Layer: checkout,
 * webhooks e ciclo de assinatura são específicos do fornecedor, não
 * escondidos atrás de um contrato genérico.
 */
function getConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "MERCADO_PAGO_ACCESS_TOKEN não configurada — necessária para o módulo de Billing (ver README/`.env.local.example`).",
    );
  }
  return new MercadoPagoConfig({ accessToken });
}

export interface CreateSubscriptionPreapprovalParams {
  organizationId: string;
  plan: string;
  payerEmail: string;
  reason: string;
  transactionAmountCents: number;
  backUrl: string;
}

export interface SubscriptionPreapprovalResult {
  preapprovalId: string;
  initPoint: string;
}

/** Cria a assinatura recorrente (Preapproval) — Fluxo 12, "assinar/trocar de plano". */
export async function createSubscriptionPreapproval(
  params: CreateSubscriptionPreapprovalParams,
): Promise<SubscriptionPreapprovalResult> {
  const preApproval = new PreApproval(getConfig());

  const response = await preApproval.create({
    body: {
      reason: params.reason,
      external_reference: `${params.organizationId}:${params.plan}`,
      payer_email: params.payerEmail,
      back_url: params.backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: params.transactionAmountCents / 100,
        currency_id: "BRL",
      },
      status: "pending",
    },
  });

  if (!response.id || !response.init_point) {
    throw new Error("Mercado Pago não retornou id/init_point ao criar a assinatura.");
  }

  return { preapprovalId: response.id, initPoint: response.init_point };
}

export async function getMercadoPagoPreapproval(preapprovalId: string): Promise<PreApprovalResponse> {
  const preApproval = new PreApproval(getConfig());
  return preApproval.get({ id: preapprovalId });
}

export interface CreateCreditPurchasePreferenceParams {
  organizationId: string;
  creditPackageId: string;
  packageName: string;
  credits: number;
  priceCents: number;
  backUrl: string;
  notificationUrl: string;
}

export interface CreditPurchasePreferenceResult {
  preferenceId: string;
  initPoint: string;
}

/** Cria a preferência de pagamento único (Checkout Pro) — Fluxo 12, "comprar créditos avulsos". */
export async function createCreditPurchasePreference(
  params: CreateCreditPurchasePreferenceParams,
): Promise<CreditPurchasePreferenceResult> {
  const preference = new Preference(getConfig());

  const response = await preference.create({
    body: {
      items: [
        {
          id: params.creditPackageId,
          title: `${params.packageName} — ${params.credits} créditos Ayon Creator`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: params.priceCents / 100,
        },
      ],
      external_reference: params.organizationId,
      notification_url: params.notificationUrl,
      back_urls: { success: params.backUrl, pending: params.backUrl, failure: params.backUrl },
      metadata: {
        organization_id: params.organizationId,
        credit_package_id: params.creditPackageId,
        credits: params.credits,
      },
    },
  });

  if (!response.id || !response.init_point) {
    throw new Error("Mercado Pago não retornou id/init_point ao criar a preferência de compra.");
  }

  return { preferenceId: response.id, initPoint: response.init_point };
}

export async function getMercadoPagoPayment(paymentId: string): Promise<PaymentResponse> {
  const payment = new Payment(getConfig());
  return payment.get({ id: Number(paymentId) });
}

export interface VerifyWebhookSignatureParams {
  xSignature: string | string[] | null | undefined;
  xRequestId: string | string[] | null | undefined;
  dataId: string | string[] | null | undefined;
}

/**
 * Valida a assinatura do webhook do Mercado Pago (`x-signature`) contra o
 * secret configurado — nunca processa um payload sem validar a origem
 * (architecture.md §12.2, mesmo princípio dos webhooks de n8n, §9.1).
 * Lança `InvalidWebhookSignatureError` (re-exportado do SDK) se inválida.
 */
export function verifyMercadoPagoWebhookSignature(params: VerifyWebhookSignatureParams): void {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("MERCADO_PAGO_WEBHOOK_SECRET não configurado — necessário para validar webhooks do Mercado Pago.");
  }

  WebhookSignatureValidator.validate({
    xSignature: params.xSignature,
    xRequestId: params.xRequestId,
    dataId: params.dataId,
    secret,
    toleranceSeconds: 300,
  });
}

export { InvalidWebhookSignatureError } from "mercadopago";
