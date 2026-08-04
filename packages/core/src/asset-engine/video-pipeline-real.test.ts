import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@ayon/types";
import { completeVideoPipelineSuccess } from "./video-pipeline-complete";
import { narrateVideoContentPiece } from "./video-pipeline-narrate";
import { renderVideoContentPiece } from "./video-pipeline-render";
import { selectVideoScenes } from "./video-pipeline-scenes";

/**
 * Validação real de ponta a ponta do pipeline de vídeo (Fluxo 13, passos
 * 3-6) — exatamente a sequência que o n8n vai orquestrar via as rotas
 * `/api/pipeline/video/*`, só que chamando as funções diretamente em vez de
 * via HTTP (n8n ainda não está provisionado — ver docs/changelog.md).
 * Contra o projeto Supabase remoto real (mesmo padrão de
 * `provider-gateway-video-real.test.ts`), com fixture própria criada e
 * removida a cada execução — nunca contra dados de produção de verdade.
 */
const hasAllEnv =
  process.env.ELEVENLABS_API_KEY &&
  process.env.PEXELS_API_KEY &&
  process.env.SHOTSTACK_API_KEY &&
  process.env.SHOTSTACK_HOST &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!hasAllEnv)("Pipeline de vídeo — narrate → scenes → render → complete (chamada real)", () => {
  let db: SupabaseClient<Database>;
  let organizationId: string;
  let brandId: string;
  let campaignId: string;
  let contentPieceId: string;
  let pipelineRunId: string;

  beforeAll(async () => {
    db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const suffix = Date.now();

    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({ name: "Missão 9 Pipeline Test", slug: `missao-9-pipeline-test-${suffix}` })
      .select()
      .single();
    if (orgError || !org) throw orgError ?? new Error("organização de teste não criada");
    organizationId = org.id;

    const { data: brand, error: brandError } = await db
      .from("brands")
      .insert({ organization_id: organizationId, name: "Marca de Teste — Missão 9" })
      .select()
      .single();
    if (brandError || !brand) throw brandError ?? new Error("marca de teste não criada");
    brandId = brand.id;

    await db.from("subscriptions").insert({ organization_id: organizationId, plan: "starter", status: "active" });
    await db
      .from("credit_ledger")
      .insert({ organization_id: organizationId, type: "grant_plan", amount: 100, description: "grant de teste" });

    const { data: session, error: sessionError } = await db
      .from("intelligence_hub_sessions")
      .insert({
        brand_id: brandId,
        related_entity_type: "campaign",
        related_entity_id: brandId,
        trigger_reason: "campaign_strategy",
        status: "completed",
        consolidated_result: { rationale: "sessão fictícia de teste" },
      })
      .select()
      .single();
    if (sessionError || !session) throw sessionError ?? new Error("sessão de teste não criada");

    const { data: campaign, error: campaignError } = await db
      .from("campaigns")
      .insert({
        brand_id: brandId,
        intelligence_hub_session_id: session.id,
        title: "Campanha de Teste — Pipeline de Vídeo",
        status: "generating",
      })
      .select()
      .single();
    if (campaignError || !campaign) throw campaignError ?? new Error("campanha de teste não criada");
    campaignId = campaign.id;

    const { data: piece, error: pieceError } = await db
      .from("content_pieces")
      .insert({
        campaign_id: campaignId,
        format: "video",
        production_mode: "licensed_stock_video",
        is_primary: true,
        script: "Descubra o pôr do sol perfeito. A Ayon Creator te ajuda a contar essa história em vídeo, automaticamente.",
      })
      .select()
      .single();
    if (pieceError || !piece) throw pieceError ?? new Error("peça de teste não criada");
    contentPieceId = piece.id;

    const { data: run, error: runError } = await db
      .from("pipeline_runs")
      .insert({ entity_type: "content_piece", entity_id: contentPieceId, engine: "asset_engine", status: "running" })
      .select()
      .single();
    if (runError || !run) throw runError ?? new Error("pipeline_run de teste não criado");
    pipelineRunId = run.id;
  }, 30_000);

  afterAll(async () => {
    if (!organizationId) return;
    const folderPath = `${organizationId}/${campaignId}`;
    const { data: files } = await db.storage.from("content-output").list(folderPath, { limit: 1000 });
    if (files?.length) await db.storage.from("content-output").remove(files.map((f) => `${folderPath}/${f.name}`));

    if (contentPieceId) {
      await db.from("content_versions").delete().eq("content_piece_id", contentPieceId);
      await db.from("credit_ledger").delete().eq("related_pipeline_run_id", pipelineRunId);
    }
    if (pipelineRunId) await db.from("pipeline_runs").delete().eq("id", pipelineRunId);
    if (contentPieceId) await db.from("content_pieces").delete().eq("id", contentPieceId);
    if (campaignId) await db.from("campaigns").delete().eq("id", campaignId);
    await db.from("intelligence_hub_sessions").delete().eq("brand_id", brandId);
    await db.from("credit_ledger").delete().eq("organization_id", organizationId);
    await db.from("subscriptions").delete().eq("organization_id", organizationId);
    if (brandId) await db.from("brands").delete().eq("id", brandId);
    await db.from("organizations").delete().eq("id", organizationId);
  }, 30_000);

  it(
    "roda o pipeline completo e deixa a peça pronta para revisão, com crédito debitado",
    async () => {
      const narrateResult = await narrateVideoContentPiece({
        db,
        serviceRoleDb: db,
        tier: "economico",
        organizationId,
        campaignId,
        contentPieceId,
      });
      expect(narrateResult.audioUrl).toMatch(/^https:\/\//);
      expect(narrateResult.durationMs).toBeGreaterThan(0);
      expect(narrateResult.captionCues.length).toBeGreaterThan(0);

      const scenesResult = await selectVideoScenes({
        serviceRoleDb: db,
        tier: "economico",
        totalDurationMs: narrateResult.durationMs,
        searchQuery: "pôr do sol praia",
      });
      expect(scenesResult.videoSources.length).toBeGreaterThan(0);

      const renderResult = await renderVideoContentPiece({
        db,
        serviceRoleDb: db,
        tier: "economico",
        organizationId,
        campaignId,
        contentPieceId,
        audioUrl: narrateResult.audioUrl,
        videoSources: scenesResult.videoSources,
        captionCues: narrateResult.captionCues.map((cue) => ({
          text: cue.text,
          startSeconds: cue.startMs / 1000,
          lengthSeconds: (cue.endMs - cue.startMs) / 1000,
        })),
      });
      expect(renderResult.videoStoragePath).toBe(`${organizationId}/${campaignId}/${contentPieceId}-video.mp4`);

      const balanceBefore = await getBalance(db, organizationId);

      await completeVideoPipelineSuccess({
        serviceRoleDb: db,
        organizationId,
        contentPieceId,
        pipelineRunId,
        tier: "economico",
        videoStoragePath: renderResult.videoStoragePath,
        voiceProviderKey: narrateResult.voiceProviderKey,
        mediaProviderKey: scenesResult.mediaProviderKey,
        videoRenderProviderKey: renderResult.videoRenderProviderKey,
      });

      const { data: piece } = await db.from("content_pieces").select("*").eq("id", contentPieceId).single();
      expect(piece?.status).toBe("ready_for_review");

      const { data: version } = await db
        .from("content_versions")
        .select("*")
        .eq("content_piece_id", contentPieceId)
        .single();
      expect(version?.output_storage_path).toBe(renderResult.videoStoragePath);

      const { data: run } = await db.from("pipeline_runs").select("*").eq("id", pipelineRunId).single();
      expect(run?.status).toBe("completed");

      const balanceAfter = await getBalance(db, organizationId);
      expect(balanceBefore - balanceAfter).toBe(15); // credit_pricing.video_generation, tier economico (migration 0017)

      // Idempotência do webhook (Fluxo 13, passo 6) — reentrega não deve debitar de novo.
      await completeVideoPipelineSuccess({
        serviceRoleDb: db,
        organizationId,
        contentPieceId,
        pipelineRunId,
        tier: "economico",
        videoStoragePath: renderResult.videoStoragePath,
        voiceProviderKey: narrateResult.voiceProviderKey,
        mediaProviderKey: scenesResult.mediaProviderKey,
        videoRenderProviderKey: renderResult.videoRenderProviderKey,
      });
      const balanceAfterRetry = await getBalance(db, organizationId);
      expect(balanceAfterRetry).toBe(balanceAfter);
    },
    5 * 60_000,
  );
});

async function getBalance(db: SupabaseClient<Database>, organizationId: string): Promise<number> {
  const { data } = await db.from("credit_ledger").select("amount").eq("organization_id", organizationId);
  return (data ?? []).reduce((total, row) => total + row.amount, 0);
}
