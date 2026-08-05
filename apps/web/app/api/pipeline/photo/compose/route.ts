import { NextResponse, type NextRequest } from "next/server";
import { composePhotoContentPiece, logger, markPipelineStage } from "@ayon/core";
import { InvalidN8nWebhookSecretError, verifyN8nWebhookSecret } from "@ayon/core/src/shared/verify-n8n-webhook-secret";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Rota interna acionada pelo n8n (Fluxo 15, passo 3) — composição de cada
 * candidato em uma opção completa (foto + branding + título), via Video
 * Render Provider. Mesmo princípio de autenticação/service role de
 * `pipeline/video/render`.
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
  if (
    !body?.contentPieceId ||
    !body?.organizationId ||
    !body?.campaignId ||
    !body?.tier ||
    !body?.format ||
    !Array.isArray(body?.candidates) ||
    !body?.pipelineRunId
  ) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  try {
    const serviceRoleDb = createServiceRoleClient();
    await markPipelineStage(serviceRoleDb, body.pipelineRunId, "photo", "rendering");
    const options = await composePhotoContentPiece({
      db: serviceRoleDb,
      serviceRoleDb,
      tier: body.tier,
      organizationId: body.organizationId,
      campaignId: body.campaignId,
      contentPieceId: body.contentPieceId,
      format: body.format,
      candidates: body.candidates,
    });
    return NextResponse.json({ ok: true, options });
  } catch (error) {
    logger.error("pipeline.photo.compose_failed", {
      contentPieceId: body.contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
  }
}
