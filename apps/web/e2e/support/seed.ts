import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

/**
 * Smoke test de CI (Missão H2, CONVENTIONS.md §10) — nunca aponta para o
 * projeto Supabase real. Mesma convenção de nomes de env var de
 * `supabase/tests/support/env.ts`: sempre explícitas, sem fallback
 * hardcoded, para nunca arriscar rodar por engano contra produção.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} não configurada — o smoke test de e2e/ precisa de um Supabase local rodando ` +
        `(\`supabase start\`) com SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY exportadas.`,
    );
  }
  return value;
}

function getAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export interface SeededSmokeBrand {
  userId: string;
  email: string;
  password: string;
  organizationId: string;
  brandId: string;
}

/**
 * Semeia diretamente via service role uma organização/marca já "onboarded"
 * (pula a conversa real de onboarding — que depende de um LLM de verdade e
 * é validada manualmente a cada missão, não pelo smoke test) com assinatura
 * ativa e créditos suficientes para uma campanha completa. Decisão de
 * escopo do H2: o smoke test cobre login → campanha → aprovação → pacote;
 * a conversa de onboarding em si fica fora (ver docs/hardening-plan.md,
 * Missão H2, nota do FakeLlmProvider).
 */
export async function seedSmokeBrand(): Promise<SeededSmokeBrand> {
  const admin = getAdminClient();
  const email = `h2-smoke-${Date.now()}@ayoncreator.test`;
  const password = "H2SmokeTest!2026";

  const { data: user, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !user.user) throw userErr ?? new Error("usuário de smoke test não criado");

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: "H2 Smoke Test Bakery", slug: `h2-smoke-test-bakery-${Date.now()}`, created_by: user.user.id })
    .select()
    .single();
  if (orgErr || !org) throw orgErr ?? new Error("organização de smoke test não criada");

  await admin
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.user.id, role: "owner", created_by: user.user.id });

  const { data: brand, error: brandErr } = await admin
    .from("brands")
    .insert({ organization_id: org.id, name: "Padaria Smoke Test", created_by: user.user.id })
    .select()
    .single();
  if (brandErr || !brand) throw brandErr ?? new Error("marca de smoke test não criada");

  await admin.from("brand_brain_profiles").insert({
    brand_id: brand.id,
    company_history: "Padaria fictícia usada só pelo smoke test de CI.",
    onboarding_completed_at: new Date(0).toISOString(),
    onboarding_confirmed_at: new Date(0).toISOString(),
    created_by: user.user.id,
  });

  await admin.from("user_profiles").insert({ user_id: user.user.id }).select().maybeSingle();

  await admin.from("subscriptions").insert({ organization_id: org.id, plan: "starter", status: "active" });

  // campaign_strategy (tier economico) = 5 créditos, asset_generation
  // (tier economico) = 3 créditos — 50 dá folga para reexecuções manuais.
  await admin
    .from("credit_ledger")
    .insert({ organization_id: org.id, type: "grant_plan", amount: 50, description: "smoke test grant" });

  return { userId: user.user.id, email, password, organizationId: org.id, brandId: brand.id };
}

export async function cleanupSmokeBrand(seed: SeededSmokeBrand): Promise<void> {
  const admin = getAdminClient();

  const { data: learningInsights } = await admin.from("learning_insights").select("id").eq("brand_id", seed.brandId);
  if (learningInsights?.length) {
    await admin.from("learning_insights").delete().in("id", learningInsights.map((i) => i.id));
  }
  const { data: learningSignals } = await admin.from("learning_signals").select("id").eq("brand_id", seed.brandId);
  if (learningSignals?.length) {
    await admin.from("learning_signals").delete().in("id", learningSignals.map((s) => s.id));
  }

  const { data: campaigns } = await admin.from("campaigns").select("id").eq("brand_id", seed.brandId);
  const campaignIds = (campaigns ?? []).map((c) => c.id);

  if (campaignIds.length) {
    const { data: pieces } = await admin.from("content_pieces").select("id").in("campaign_id", campaignIds);
    const pieceIds = (pieces ?? []).map((p) => p.id);
    if (pieceIds.length) {
      await admin.from("content_versions").delete().in("content_piece_id", pieceIds);
      await admin.from("credit_ledger").delete().in("related_content_piece_id", pieceIds);
      await admin.from("content_pieces").delete().in("id", pieceIds);
    }
    await admin.from("content_packages").delete().in("campaign_id", campaignIds);

    for (const campaignId of campaignIds) {
      const folderPath = `${seed.organizationId}/${campaignId}`;
      const { data: files } = await admin.storage.from("content-output").list(folderPath, { limit: 1000 });
      if (files?.length) {
        await admin.storage.from("content-output").remove(files.map((f) => `${folderPath}/${f.name}`));
      }
    }
  }

  const { data: sessions } = await admin
    .from("intelligence_hub_sessions")
    .select("id")
    .eq("brand_id", seed.brandId);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length) {
    await admin.from("specialist_opinions").delete().in("session_id", sessionIds);
    await admin.from("credit_ledger").delete().in("related_intelligence_hub_session_id", sessionIds);
  }

  if (campaignIds.length) await admin.from("campaigns").delete().in("id", campaignIds);
  if (sessionIds.length) await admin.from("intelligence_hub_sessions").delete().in("id", sessionIds);

  await admin.from("credit_ledger").delete().eq("organization_id", seed.organizationId);
  await admin.from("subscriptions").delete().eq("organization_id", seed.organizationId);
  await admin.from("audit_logs").delete().eq("organization_id", seed.organizationId);
  await admin.from("brand_brain_profiles").delete().eq("brand_id", seed.brandId);
  await admin.from("user_profiles").delete().eq("user_id", seed.userId);
  await admin.from("brands").delete().eq("id", seed.brandId);
  await admin.from("organization_members").delete().eq("organization_id", seed.organizationId);
  await admin.from("organizations").delete().eq("id", seed.organizationId);
  await admin.auth.admin.deleteUser(seed.userId).catch(() => undefined);
}
