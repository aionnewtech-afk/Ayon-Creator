import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@ayon/types";
import { triggerPhotoGeneration } from "./photo-pipeline-trigger";

/**
 * Validação real de ponta a ponta do Fluxo 15 **via n8n de verdade** (mesmo
 * padrão de `video-pipeline-trigger-real.test.ts`) — dispara
 * `triggerPhotoGeneration`, que chama o webhook do n8n com `kind: "photo"`;
 * o nó "É pipeline de foto?" roteia para Photo Select → Photo Compose →
 * webhook de conclusão. Requer o container `ayon-creator-n8n` e o servidor
 * Next.js local rodando.
 */
const hasAllEnv =
  process.env.PEXELS_API_KEY &&
  process.env.SHOTSTACK_API_KEY &&
  process.env.SHOTSTACK_HOST &&
  process.env.ANTHROPIC_API_KEY &&
  process.env.N8N_WEBHOOK_URL &&
  process.env.N8N_WEBHOOK_SECRET &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!hasAllEnv)("Fluxo 15 via n8n real — trigger → workflow → completion", () => {
  let db: SupabaseClient<Database>;
  let organizationId: string;
  let brandId: string;
  let campaignId: string;
  let contentPieceId: string;
  // ★ Missão 12 — pipeline_runs.actor_user_id referencia auth.users; precisa
  // de um usuário real (não um uuid arbitrário) para satisfazer a FK.
  let actorUserId: string;

  beforeAll(async () => {
    db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const suffix = Date.now();

    const { data: user, error: userError } = await db.auth.admin.createUser({
      email: `photo-pipeline-trigger-test-${suffix}@ayoncreator.test`,
      password: "PhotoPipelineTriggerTest!2026",
      email_confirm: true,
    });
    if (userError || !user.user) throw userError ?? new Error("usuário de teste não criado");
    actorUserId = user.user.id;

    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({ name: "Missão 11 n8n Photo Test", slug: `missao-11-n8n-photo-test-${suffix}` })
      .select()
      .single();
    if (orgError || !org) throw orgError ?? new Error("organização de teste não criada");
    organizationId = org.id;

    const { data: brand, error: brandError } = await db
      .from("brands")
      .insert({ organization_id: organizationId, name: "Marca de Teste — n8n Foto", niche: "turismo de serra" })
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
    if (actorUserId) await db.auth.admin.deleteUser(actorUserId);
  }, 30_000);

  it(
    "dispara via n8n real e chega a ready_for_review com foto + crédito debitado",
    async () => {
      const { pipelineRunId } = await triggerPhotoGeneration({
        db,
        serviceRoleDb: db,
        organizationId,
        actorUserId,
        campaignId,
        tier: "economico",
        contentPieceId,
      });
      expect(pipelineRunId).toBeTruthy();

      const finalRun = await pollUntilTerminal(db, pipelineRunId, 3 * 60_000);
      expect(finalRun.status).toBe("completed");
      expect(finalRun.error).toBeNull();

      const { data: piece } = await db.from("content_pieces").select("*").eq("id", contentPieceId).single();
      expect(piece?.status).toBe("ready_for_review");

      const { data: versions } = await db
        .from("content_versions")
        .select("*")
        .eq("content_piece_id", contentPieceId);
      expect(versions?.length).toBeGreaterThan(0);
      expect(versions?.[0]?.output_storage_path).toMatch(new RegExp(`^${organizationId}/${campaignId}/${contentPieceId}-option-\\d+\\.jpg$`));

      const { data: ledgerRows } = await db
        .from("credit_ledger")
        .select("*")
        .eq("related_pipeline_run_id", pipelineRunId);
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows?.[0]?.amount).toBe(-5); // credit_pricing.image_generation, tier economico
    },
    4 * 60_000,
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
