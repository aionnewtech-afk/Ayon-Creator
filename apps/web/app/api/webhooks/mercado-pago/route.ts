import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@ayon/core";
import { handleMercadoPagoWebhook } from "@ayon/core/src/billing/mercado-pago-webhook-handler";
import { verifyMercadoPagoWebhookSignature } from "@ayon/core/src/billing/mercado-pago-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Recebe notificações do Mercado Pago (Fluxo 12) — pagamento avulso de
 * créditos (`type: "payment"`) e mudança de status de assinatura
 * (`type: "subscription_preapproval"`). O webhook é a fonte de verdade,
 * nunca o redirect do navegador (architecture.md §12.2). Assinatura validada
 * antes de processar qualquer payload — nunca confia na origem sem checar.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || typeof body.type !== "string" || !body.data?.id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId: request.nextUrl.searchParams.get("data.id") ?? String(body.data.id),
    });
  } catch (error) {
    logger.warn("billing.webhook_invalid_signature", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const serviceRoleDb = createServiceRoleClient();
    await handleMercadoPagoWebhook({
      serviceRoleDb,
      type: body.type,
      dataId: String(body.data.id),
    });
  } catch (error) {
    logger.error("billing.webhook_processing_failed", {
      type: body.type,
      reason: error instanceof Error ? error.message : String(error),
    });
    // 200 mesmo em erro interno — evita que o Mercado Pago reenvie
    // indefinidamente por uma falha que não é da notificação em si; o erro
    // já foi logado para investigação manual.
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({ ok: true });
}
