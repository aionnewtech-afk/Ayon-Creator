import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { getTestSupabaseConfig } from "./support/env";

/**
 * Formaliza os 2 testes ad hoc escritos e validados durante a Missão H1
 * (itens 1.1 e 1.2/5.4, docs/hardening-plan.md) — race condition do
 * provisionamento inicial e do portão de crédito. Roda contra o Postgres
 * local efêmero (`supabase start`), nunca contra o projeto remoto
 * (CONVENTIONS.md §10).
 */
describe("Concorrência — provisionamento inicial (ensure_initial_provisioning)", () => {
  const config = getTestSupabaseConfig();
  const admin = createClient<Database>(config.url, config.serviceRoleKey);

  const email = `h2-provisioning-race-${Date.now()}@ayoncreator.test`;
  const password = "H2TestRace!2026";
  let userId: string;
  const orgIdsToCleanup: string[] = [];

  beforeAll(async () => {
    const { data: user, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !user.user) throw error ?? new Error("usuário não criado");
    userId = user.user.id;
  });

  afterAll(async () => {
    const { data: allBrands } = await admin.from("brands").select("id").in("organization_id", orgIdsToCleanup);
    if (allBrands?.length) await admin.from("brands").delete().in("id", allBrands.map((b) => b.id));
    await admin.from("organization_members").delete().eq("user_id", userId);
    await admin.from("audit_logs").delete().in("organization_id", orgIdsToCleanup);
    await admin.from("user_profiles").delete().eq("user_id", userId);
    if (orgIdsToCleanup.length) await admin.from("organizations").delete().in("id", orgIdsToCleanup);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  });

  it("5 chamadas concorrentes do mesmo usuário criam exatamente 1 organização", async () => {
    const client = createClient<Database>(config.url, config.anonKey);
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;

    const orgName = email.split("@")[0] as string;
    const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-");

    const calls = Array.from({ length: 5 }, () =>
      client
        .rpc("ensure_initial_provisioning", {
          p_user_id: userId,
          p_organization_name: orgName,
          p_base_slug: baseSlug,
        })
        .single(),
    );
    const results = await Promise.all(calls);
    expect(results.every((r) => !r.error)).toBe(true);

    const { data: memberships } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id))];
    orgIdsToCleanup.push(...orgIds);

    expect(orgIds.length).toBe(1);

    const { data: brands } = await admin.from("brands").select("id").in("organization_id", orgIds);
    expect(brands?.length).toBe(1);
  });

  it("chamada anônima é rejeitada na camada de grant (anon sem EXECUTE)", async () => {
    const anonClient = createClient<Database>(config.url, config.anonKey);
    const { error } = await anonClient.rpc("ensure_initial_provisioning", {
      p_user_id: userId,
      p_organization_name: "Anon Attempt Org",
      p_base_slug: "anon-attempt-org",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("tentativa de impersonação (outro usuário autenticado) é rejeitada pelo guard", async () => {
    const otherEmail = `h2-provisioning-impersonate-${Date.now()}@ayoncreator.test`;
    const { data: otherUser, error: createErr } = await admin.auth.admin.createUser({
      email: otherEmail,
      password,
      email_confirm: true,
    });
    if (createErr || !otherUser.user) throw createErr ?? new Error("usuário B não criado");

    const otherClient = createClient<Database>(config.url, config.anonKey);
    const { error: signInErr } = await otherClient.auth.signInWithPassword({ email: otherEmail, password });
    if (signInErr) throw signInErr;

    const { error } = await otherClient.rpc("ensure_initial_provisioning", {
      p_user_id: userId, // tenta provisionar em nome do usuário do describe acima, não de si mesmo
      p_organization_name: "Impersonation Attempt Org",
      p_base_slug: "impersonation-attempt-org",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    await admin.auth.admin.deleteUser(otherUser.user.id).catch(() => undefined);
  });
});

describe("Concorrência — portão de crédito (enforce_credit_ledger_balance)", () => {
  const config = getTestSupabaseConfig();
  const admin = createClient<Database>(config.url, config.serviceRoleKey);

  const orgIdsToCleanup: string[] = [];

  afterEach(async () => {
    if (orgIdsToCleanup.length) {
      await admin.from("credit_ledger").delete().in("organization_id", orgIdsToCleanup);
      await admin.from("organizations").delete().in("id", orgIdsToCleanup);
      orgIdsToCleanup.length = 0;
    }
  });

  it("bloqueia consumo além do saldo (caso sequencial simples)", async () => {
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: "H2 Credit Trigger Test", slug: `h2-credit-trigger-test-${Date.now()}` })
      .select()
      .single();
    if (orgErr || !org) throw orgErr ?? new Error("org não criada");
    orgIdsToCleanup.push(org.id);

    const { error: grantErr } = await admin
      .from("credit_ledger")
      .insert({ organization_id: org.id, type: "grant_plan", amount: 10, description: "test grant" });
    expect(grantErr).toBeNull();

    const { error: consumeErr } = await admin
      .from("credit_ledger")
      .insert({ organization_id: org.id, type: "consumption", amount: -10, description: "consome tudo" });
    expect(consumeErr).toBeNull();

    const { error: overspendErr } = await admin
      .from("credit_ledger")
      .insert({ organization_id: org.id, type: "consumption", amount: -1, description: "overspend" });
    expect(overspendErr).not.toBeNull();

    const { data: rows } = await admin.from("credit_ledger").select("amount").eq("organization_id", org.id);
    const balance = (rows ?? []).reduce((sum, r) => sum + r.amount, 0);
    expect(balance).toBe(0);
  });

  it("10 débitos concorrentes contra saldo de 5 — exatamente 5 aceitos, saldo nunca negativo", async () => {
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: "H2 Credit Trigger Race Test", slug: `h2-credit-trigger-race-${Date.now()}` })
      .select()
      .single();
    if (orgErr || !org) throw orgErr ?? new Error("org não criada");
    orgIdsToCleanup.push(org.id);

    await admin.from("credit_ledger").insert({ organization_id: org.id, type: "grant_plan", amount: 5, description: "race test grant" });

    const attempts = Array.from({ length: 10 }, (_, i) =>
      admin.from("credit_ledger").insert({ organization_id: org.id, type: "consumption", amount: -1, description: `race attempt ${i}` }),
    );
    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => !r.error).length;

    expect(succeeded).toBe(5);

    const { data: rows } = await admin.from("credit_ledger").select("amount").eq("organization_id", org.id);
    const balance = (rows ?? []).reduce((sum, r) => sum + r.amount, 0);
    expect(balance).toBe(0);
  });
});
