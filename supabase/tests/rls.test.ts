import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { getTestSupabaseConfig } from "./support/env";

/**
 * Formaliza o teste ad hoc escrito e validado durante a Missão H1 (item
 * 5.1, docs/hardening-plan.md) — RLS de Storage restrita a is_org_editor
 * em escrita. Roda contra o Postgres local efêmero (`supabase start`),
 * nunca contra o projeto remoto (CONVENTIONS.md §10).
 */
describe("RLS — Storage (knowledge-base)", () => {
  const config = getTestSupabaseConfig();
  const admin = createClient<Database>(config.url, config.serviceRoleKey);

  const editorEmail = `h2-rls-editor-${Date.now()}@ayoncreator.test`;
  const viewerEmail = `h2-rls-viewer-${Date.now()}@ayoncreator.test`;
  const password = "H2TestRls!2026";

  let editorUserId: string;
  let viewerUserId: string;
  let orgId: string;
  let editorClient: SupabaseClient<Database>;
  let viewerClient: SupabaseClient<Database>;

  const editorPath = () => `${orgId}/rls-test-editor.txt`;
  const testFileContent = Buffer.from("hello rls test");

  beforeAll(async () => {
    const { data: editorUser, error: editorErr } = await admin.auth.admin.createUser({
      email: editorEmail,
      password,
      email_confirm: true,
    });
    if (editorErr || !editorUser.user) throw editorErr ?? new Error("editor user não criado");
    editorUserId = editorUser.user.id;

    const { data: viewerUser, error: viewerErr } = await admin.auth.admin.createUser({
      email: viewerEmail,
      password,
      email_confirm: true,
    });
    if (viewerErr || !viewerUser.user) throw viewerErr ?? new Error("viewer user não criado");
    viewerUserId = viewerUser.user.id;

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: "H2 RLS Test Org", slug: `h2-rls-test-org-${Date.now()}`, created_by: editorUserId })
      .select()
      .single();
    if (orgErr || !org) throw orgErr ?? new Error("org não criada");
    orgId = org.id;

    await admin.from("organization_members").insert([
      { organization_id: orgId, user_id: editorUserId, role: "editor", created_by: editorUserId },
      { organization_id: orgId, user_id: viewerUserId, role: "viewer", created_by: editorUserId },
    ]);

    editorClient = createClient<Database>(config.url, config.anonKey);
    viewerClient = createClient<Database>(config.url, config.anonKey);

    const { error: signInEditorErr } = await editorClient.auth.signInWithPassword({ email: editorEmail, password });
    if (signInEditorErr) throw signInEditorErr;
    const { error: signInViewerErr } = await viewerClient.auth.signInWithPassword({ email: viewerEmail, password });
    if (signInViewerErr) throw signInViewerErr;
  });

  afterAll(async () => {
    await admin.storage.from("knowledge-base").remove([editorPath()]);
    await admin.from("organization_members").delete().eq("organization_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    await admin.auth.admin.deleteUser(editorUserId).catch(() => undefined);
    await admin.auth.admin.deleteUser(viewerUserId).catch(() => undefined);
  });

  it("permite upload de editor", async () => {
    const { error } = await editorClient.storage
      .from("knowledge-base")
      .upload(editorPath(), testFileContent, { contentType: "text/plain", upsert: true });
    expect(error).toBeNull();
  });

  it("permite leitura de viewer (select continua is_org_member)", async () => {
    const { error } = await viewerClient.storage.from("knowledge-base").download(editorPath());
    expect(error).toBeNull();
  });

  it("bloqueia upload de viewer (insert exige is_org_editor)", async () => {
    const { error } = await viewerClient.storage
      .from("knowledge-base")
      .upload(`${orgId}/rls-test-viewer.txt`, testFileContent, { contentType: "text/plain" });
    expect(error).not.toBeNull();
  });

  it("bloqueia delete de viewer — confirmado por ground truth via service role", async () => {
    // .remove() do Supabase Storage retorna sucesso com array vazio (não
    // erro) quando o RLS filtra todas as linhas-alvo — por isso a
    // confirmação real é a leitura via service role depois, não o retorno
    // da própria chamada (achado da validação manual do H1).
    await viewerClient.storage.from("knowledge-base").remove([editorPath()]);

    const { data: filesAfter } = await admin.storage.from("knowledge-base").list(orgId);
    const stillExists = (filesAfter ?? []).some((f) => f.name === "rls-test-editor.txt");
    expect(stillExists).toBe(true);
  });
});
