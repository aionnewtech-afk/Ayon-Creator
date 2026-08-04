import { NextResponse, type NextRequest } from "next/server";
import { logger, selectVideoScenes } from "@ayon/core";
import { InvalidN8nWebhookSecretError, verifyN8nWebhookSecret } from "@ayon/core/src/shared/verify-n8n-webhook-secret";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Rota interna acionada pelo n8n (Fluxo 13, passo 3) — seleção de cenas via
 * Media Provider. Mesmo princípio de autenticação/service role de
 * `pipeline/video/narrate`.
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
  if (!body?.contentPieceId || !body?.tier || !body?.totalDurationMs || !body?.searchQuery) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  try {
    const serviceRoleDb = createServiceRoleClient();
    const result = await selectVideoScenes({
      serviceRoleDb,
      tier: body.tier,
      totalDurationMs: body.totalDurationMs,
      searchQuery: body.searchQuery,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("pipeline.video.scenes_failed", {
      contentPieceId: body.contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown_error" }, { status: 500 });
  }
}
