import { NextResponse, type NextRequest } from "next/server";
import { logger, markPipelineStage, narrateVideoContentPiece } from "@ayon/core";
import { InvalidN8nWebhookSecretError, verifyN8nWebhookSecret } from "@ayon/core/src/shared/verify-n8n-webhook-secret";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Rota interna acionada pelo n8n (Fluxo 13, passo 3) — narração via Voice
 * Provider. Nunca chamada pelo client/navegador; autenticada por segredo
 * compartilhado (`x-ayon-webhook-secret`), mesmo princípio do webhook do
 * Mercado Pago. Usa service role para tudo — não existe sessão de usuário
 * numa chamada servidor-a-servidor do n8n.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    verifyN8nWebhookSecret(request.headers.get("x-ayon-webhook-secret"));
  } catch (error) {
    if (error instanceof InvalidN8nWebhookSecretError) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  if (!body?.contentPieceId || !body?.organizationId || !body?.campaignId || !body?.tier || !body?.pipelineRunId) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  try {
    const serviceRoleDb = createServiceRoleClient();
    await markPipelineStage(serviceRoleDb, body.pipelineRunId, "video", "narrating");
    const result = await narrateVideoContentPiece({
      db: serviceRoleDb,
      serviceRoleDb,
      tier: body.tier,
      organizationId: body.organizationId,
      campaignId: body.campaignId,
      contentPieceId: body.contentPieceId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("pipeline.video.narrate_failed", {
      contentPieceId: body.contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
  }
}
