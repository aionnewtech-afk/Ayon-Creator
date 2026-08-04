import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@ayon/types";
import { triggerVideoGeneration } from "./video-pipeline-trigger";

/**
 * Validação real de ponta a ponta do Fluxo 13 **via n8n de verdade**
 * (não chamando as funções internas diretamente, como em
 * `video-pipeline-real.test.ts`) — dispara `triggerVideoGeneration`, que
 * chama o webhook do n8n; o workflow "Ayon Creator - Fluxo 13 (Pipeline de
 * Video)" processa narrate → scenes → render → completion de forma
 * assíncrona; este teste faz polling em `pipeline_runs`/`content_pieces`
 * até ver o resultado final. Requer o container `ayon-creator-n8n` rodando
 * (`docker compose --env-file n8n/.env.local -f n8n/docker-compose.yml up -d`)
 * e o servidor Next.js local (`pnpm dev`) — ambos alcançáveis a partir do
 * container via `host.docker.internal`.
 */
const hasAllEnv =
  process.env.ELEVENLABS_API_KEY &&
  process.env.PEXELS_API_KEY &&
  process.env.SHOTSTACK_API_KEY &&
  process.env.SHOTSTACK_HOST &&
  process.env.N8N_WEBHOOK_URL &&
  process.env.N8N_WEBHOOK_SECRET &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!hasAllEnv)("Fluxo 13 via n8n real — trigger → workflow → completion", () => {
  let db: SupabaseClient<Database>;
  let organizationId: string;
  let brandId: string;
  let campaignId: string;
  let contentPieceId: string;

  beforeAll(async () => {
    db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const suffix = Date.now();

    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({ name: "Missão 9 n8n Test", slug: `missao-9-n8n-test-${suffix}` })
      .select()
      .single();
    if (orgError || !org) throw orgError ?? new Error("organização de teste não criada");
    organizationId = org.id;

    const { data: brand, error: brandError } = await db
      .from("brands")
      .insert({ organization_id: organizationId, name: "Marca de Teste — n8n" })
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
        title: "cidade à noite",
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
        script: "A cidade nunca dorme. Descubra como a Ayon Creator transforma sua marca em movimento.",
      })
      .select()
      .single();
    if (pieceError || !piece) throw pieceError ?? new Error("peça de teste não criada");
    contentPieceId = piece.id;
  }, 30_000);

  afterAll(async () => {
    if (!organizationId) return;
    const folderPath = `${organizationId}/${campaignId}`;
    const { data: files } = await db.storage.from("content-output").list(folderPath, { limit: 1000 });
    if (files?.length) await db.storage.from("content-output").remove(files.map((f) => `${folderPath}/${f.name}`));

    if (contentPieceId) {
      await db.from("content_versions").delete().eq("content_piece_id", contentPieceId);
      await db.from("credit_ledger").delete().eq("organization_id", organizationId);
    }
    const { data: runs } = await db.from("pipeline_runs").select("id").eq("entity_id", contentPieceId);
    if (runs?.length) await db.from("pipeline_runs").delete().in("id", runs.map((r) => r.id));
    if (contentPieceId) await db.from("content_pieces").delete().eq("id", contentPieceId);
    if (campaignId) await db.from("campaigns").delete().eq("id", campaignId);
    await db.from("intelligence_hub_sessions").delete().eq("brand_id", brandId);
    await db.from("subscriptions").delete().eq("organization_id", organizationId);
    if (brandId) await db.from("brands").delete().eq("id", brandId);
    await db.from("organizations").delete().eq("id", organizationId);
  }, 30_000);

  it(
    "dispara via n8n real e chega a ready_for_review com vídeo + crédito debitado",
    async () => {
      const { pipelineRunId } = await triggerVideoGeneration({
        db,
        serviceRoleDb: db,
        organizationId,
        campaignId,
        tier: "economico",
        contentPieceId,
        searchQuery: "cidade à noite",
      });
      expect(pipelineRunId).toBeTruthy();

      const finalRun = await pollUntilTerminal(db, pipelineRunId, 4 * 60_000);
      expect(finalRun.status).toBe("completed");
      expect(finalRun.error).toBeNull();

      const { data: piece } = await db.from("content_pieces").select("*").eq("id", contentPieceId).single();
      expect(piece?.status).toBe("ready_for_review");

      const { data: version } = await db
        .from("content_versions")
        .select("*")
        .eq("content_piece_id", contentPieceId)
        .single();
      expect(version?.output_storage_path).toBe(`${organizationId}/${campaignId}/${contentPieceId}-video.mp4`);
      expect((version?.generation_metadata as Record<string, unknown> | null)?.video_render_provider_key).toBe(
        "shotstack",
      );

      const { data: ledgerRows } = await db
        .from("credit_ledger")
        .select("*")
        .eq("related_pipeline_run_id", pipelineRunId);
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows?.[0]?.amount).toBe(-15);
    },
    5 * 60_000,
  );
});

async function pollUntilTerminal(
  db: SupabaseClient<Database>,
  pipelineRunId: string,
  timeoutMs: number,
): Promise<Database["public"]["Tables"]["pipeline_runs"]["Row"]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data: run, error } = await db.from("pipeline_runs").select("*").eq("id", pipelineRunId).single();
    if (error) throw error;
    if (run.status === "completed" || run.status === "failed") return run;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`pipeline_run ${pipelineRunId} não chegou a um estado terminal dentro de ${timeoutMs}ms.`);
}
