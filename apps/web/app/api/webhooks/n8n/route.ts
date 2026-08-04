import { NextResponse, type NextRequest } from "next/server";
import { completeVideoPipelineFailure, completeVideoPipelineSuccess, logger } from "@ayon/core";
import { InvalidN8nWebhookSecretError, verifyN8nWebhookSecret } from "@ayon/core/src/shared/verify-n8n-webhook-secret";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Webhook de conclusão do pipeline de vídeo (Fluxo 13, passos 5-6) — n8n
 * chama isso ao terminar (sucesso ou falha) a sequência narração → cenas →
 * composição. Fonte de verdade da conclusão, mesmo princípio do webhook do
 * Mercado Pago (architecture.md §12.2): sempre 200 mesmo em erro interno já
 * logado, para não causar reentrega indefinida por um problema que reenviar
 * não resolve.
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
  if (!body?.contentPieceId || !body?.pipelineRunId || !body?.status) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const serviceRoleDb = createServiceRoleClient();

  try {
    if (body.status === "completed") {
      if (
        !body.organizationId ||
        !body.tier ||
        !body.videoStoragePath ||
        !body.voiceProviderKey ||
        !body.mediaProviderKey ||
        !body.videoRenderProviderKey
      ) {
        return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
      }

      await completeVideoPipelineSuccess({
        serviceRoleDb,
        organizationId: body.organizationId,
        contentPieceId: body.contentPieceId,
        pipelineRunId: body.pipelineRunId,
        tier: body.tier,
        videoStoragePath: body.videoStoragePath,
        voiceProviderKey: body.voiceProviderKey,
        mediaProviderKey: body.mediaProviderKey,
        videoRenderProviderKey: body.videoRenderProviderKey,
      });
    } else {
      await completeVideoPipelineFailure({
        serviceRoleDb,
        contentPieceId: body.contentPieceId,
        pipelineRunId: body.pipelineRunId,
        errorMessage: typeof body.error === "string" ? body.error : "Falha não especificada no pipeline de vídeo.",
      });
    }
  } catch (error) {
    logger.error("pipeline.video.webhook_processing_failed", {
      contentPieceId: body.contentPieceId,
      pipelineRunId: body.pipelineRunId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({ ok: true });
}
