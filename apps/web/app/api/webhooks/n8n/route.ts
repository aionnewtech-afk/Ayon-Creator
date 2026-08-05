import { NextResponse, type NextRequest } from "next/server";
import {
  completePhotoPipelineSuccess,
  completeVideoPipelineFailure,
  completeVideoPipelineSuccess,
  logger,
} from "@ayon/core";
import { InvalidN8nWebhookSecretError, verifyN8nWebhookSecret } from "@ayon/core/src/shared/verify-n8n-webhook-secret";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Webhook de conclusão dos pipelines de vídeo/foto (Fluxo 13/15) — n8n chama
 * isso ao terminar (sucesso ou falha). Fonte de verdade da conclusão, mesmo
 * princípio do webhook do Mercado Pago (architecture.md §12.2): sempre 200
 * mesmo em erro interno já logado, para não causar reentrega indefinida por
 * um problema que reenviar não resolve.
 *
 * ★ Missão 11 — `kind` distingue vídeo de foto (arch. §14.4); ausente =
 * `"video"` (compatibilidade com o payload já usado desde a Missão 9).
 * Falha reaproveita `completeVideoPipelineFailure` nos dois casos — genérica
 * o bastante (só marca `content_pieces`/`pipeline_runs` como `failed`).
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

  const kind = body.kind === "photo" ? "photo" : "video";
  const serviceRoleDb = createServiceRoleClient();

  try {
    if (body.status === "completed") {
      if (!body.organizationId || !body.tier) {
        return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
      }

      if (kind === "photo") {
        if (!Array.isArray(body.options) || body.options.length === 0) {
          return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }

        await completePhotoPipelineSuccess({
          serviceRoleDb,
          organizationId: body.organizationId,
          contentPieceId: body.contentPieceId,
          pipelineRunId: body.pipelineRunId,
          tier: body.tier,
          options: body.options,
        });
      } else {
        if (!body.videoStoragePath || !body.voiceProviderKey || !body.mediaProviderKey || !body.videoRenderProviderKey) {
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
      }
    } else {
      await completeVideoPipelineFailure({
        serviceRoleDb,
        contentPieceId: body.contentPieceId,
        pipelineRunId: body.pipelineRunId,
        errorMessage: typeof body.error === "string" ? body.error : `Falha não especificada no pipeline de ${kind === "photo" ? "foto" : "vídeo"}.`,
      });
    }
  } catch (error) {
    logger.error("pipeline.webhook_processing_failed", {
      kind,
      contentPieceId: body.contentPieceId,
      pipelineRunId: body.pipelineRunId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({ ok: true });
}
