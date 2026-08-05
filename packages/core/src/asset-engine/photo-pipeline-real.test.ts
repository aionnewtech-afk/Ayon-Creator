import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@ayon/types";
import { completePhotoPipelineSuccess } from "./photo-pipeline-complete";
import { composePhotoContentPiece } from "./photo-pipeline-compose";
import { selectPhotoCandidates } from "./photo-pipeline-select";

/**
 * Validação real de ponta a ponta do pipeline de foto (Fluxo 15, arch.
 * §14.4) — mesma disciplina do pipeline de vídeo
 * (`video-pipeline-real.test.ts`): fixture própria, contra o projeto
 * Supabase remoto real, nunca dados de produção.
 */
const hasAllEnv =
  process.env.PEXELS_API_KEY &&
  process.env.SHOTSTACK_API_KEY &&
  process.env.SHOTSTACK_HOST &&
  process.env.ANTHROPIC_API_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!hasAllEnv)("Pipeline de foto — select → compose → complete (chamada real)", () => {
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
      .insert({ name: "Missão 11 Photo Pipeline Test", slug: `missao-11-photo-test-${suffix}` })
      .select()
      .single();
    if (orgError || !org) throw orgError ?? new Error("organização de teste não criada");
    organizationId = org.id;

    const { data: brand, error: brandError } = await db
      .from("brands")
      .insert({ organization_id: organizationId, name: "Marca de Teste — Missão 11", niche: "turismo de serra" })
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
        title: "Conheça Gramado na Serra Gaúcha",
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
        format: "thumbnail",
        production_mode: "licensed_stock_photo",
        is_primary: false,
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
    "roda o pipeline completo (economico, 1 opção) e deixa a peça pronta para revisão, com crédito debitado",
    async () => {
      const selectResult = await selectPhotoCandidates({
        db,
        serviceRoleDb: db,
        tier: "economico",
        campaignId,
        contentPieceId,
      });
      expect(selectResult.candidates.length).toBe(1); // economico = 1 opção (OPTIONS_PER_TIER)
      expect(selectResult.format).toBe("thumbnail");

      const options = await composePhotoContentPiece({
        db,
        serviceRoleDb: db,
        tier: "economico",
        organizationId,
        campaignId,
        contentPieceId,
        format: selectResult.format,
        candidates: selectResult.candidates,
      });
      expect(options).toHaveLength(1);
      expect(options[0]?.storagePath).toBe(`${organizationId}/${campaignId}/${contentPieceId}-option-1.jpg`);

      const balanceBefore = await getBalance(db, organizationId);

      await completePhotoPipelineSuccess({
        serviceRoleDb: db,
        organizationId,
        contentPieceId,
        pipelineRunId,
        tier: "economico",
        options,
      });

      const { data: piece } = await db.from("content_pieces").select("*").eq("id", contentPieceId).single();
      expect(piece?.status).toBe("ready_for_review");

      const { data: versions } = await db
        .from("content_versions")
        .select("*")
        .eq("content_piece_id", contentPieceId);
      expect(versions).toHaveLength(1);
      expect(versions?.[0]?.output_storage_path).toBe(options[0]?.storagePath);

      const { data: run } = await db.from("pipeline_runs").select("*").eq("id", pipelineRunId).single();
      expect(run?.status).toBe("completed");

      const { data: campaignAfter } = await db.from("campaigns").select("visual_brief").eq("id", campaignId).single();
      expect((campaignAfter?.visual_brief as { shortTitle?: string } | null)?.shortTitle).toBeTruthy();

      const balanceAfter = await getBalance(db, organizationId);
      expect(balanceBefore - balanceAfter).toBe(5); // credit_pricing.image_generation, tier economico (migration 0019)
    },
    3 * 60_000,
  );
});

async function getBalance(db: SupabaseClient<Database>, organizationId: string): Promise<number> {
  const { data } = await db.from("credit_ledger").select("amount").eq("organization_id", organizationId);
  return (data ?? []).reduce((total, row) => total + row.amount, 0);
}
