import path from "node:path";
import { test, expect } from "@playwright/test";
import { cleanupSmokeBrand, seedSmokeBrand, type SeededSmokeBrand } from "./support/seed";

/**
 * Smoke test de CI (Missão H2, item 7.1/7.2, CONVENTIONS.md §10) — exercita
 * Server Actions, o credit gate e o Intelligence Hub/Asset Engine de ponta
 * a ponta com o `LlmProvider` fake (LLM_PROVIDER_MODE=fake), sem chamar a
 * Anthropic de verdade. Garante que o encanamento não regrediu; não
 * substitui a validação manual com LLM real feita a cada missão.
 *
 * Fluxo: login → objetivo de campanha → aprovar estratégia → 5 peças de
 * texto geradas → upload de mídia própria nas 4 peças visuais → aprovar
 * todas as 9 → pacote montado automaticamente → link de download aparece.
 * A conversa de onboarding fica fora do escopo (ver support/seed.ts).
 */
test.describe("smoke: login → campanha → aprovação → pacote", () => {
  let seed: SeededSmokeBrand;

  test.beforeAll(async () => {
    seed = await seedSmokeBrand();
  });

  test.afterAll(async () => {
    await cleanupSmokeBrand(seed);
  });

  test("fluxo completo com LlmProvider fake", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(seed.email);
    await page.getByLabel("Senha").fill(seed.password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await page.waitForURL("**/painel");

    await page.getByRole("navigation").getByRole("link", { name: "Criar Campanha" }).click();
    await page.waitForURL("**/criar-campanha");

    await page
      .getByPlaceholder(/quero atrair mais clientes/i)
      .fill("Quero divulgar nosso pão de fermentação natural para atrair novos clientes do bairro.");
    await page.getByRole("button", { name: "Reunir a equipe de especialistas" }).click();

    await expect(page.getByRole("heading", { name: "Estratégia consolidada" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Estratégia de teste consolidada pelo FakeLlmProvider")).toBeVisible();

    await page.getByRole("button", { name: "Aprovar estratégia" }).click();

    await expect(page.getByRole("heading", { name: "Revisão do pacote de conteúdo" })).toBeVisible({
      timeout: 15_000,
    });

    const textFormats = ["Legenda", "Teleprompter", "E-mail", "Roteiro (peça principal)", "Post de blog"];
    for (const format of textFormats) {
      const section = page.locator("section, div").filter({ hasText: format }).first();
      await expect(section.getByText("Pronta para revisão").first()).toBeVisible({ timeout: 15_000 });
    }

    const fixtureImage = path.join(__dirname, "fixtures", "test-image.png");
    const fileInputs = page.locator('input[type="file"]');
    const uploadCount = await fileInputs.count();
    expect(uploadCount).toBe(4); // Vídeo, Thumbnail, Carrossel, Stories (own_media)
    for (let i = 0; i < uploadCount; i++) {
      await fileInputs.nth(i).setInputFiles(fixtureImage);
    }
    await expect(page.getByText("Arquivo enviado — pronto para revisão.")).toHaveCount(4);

    const approveButtons = page.getByRole("button", { name: "Aprovar", exact: true });
    const approveCount = await approveButtons.count();
    expect(approveCount).toBe(9); // 5 peças de texto + 4 own_media

    // Locators são consultas vivas — reavaliar "primeiro habilitado" em duas
    // etapas (checar .isEnabled() e só depois clicar num índice separado)
    // corre risco de o React reordenar/re-renderizar a lista entre as duas
    // chamadas. O filtro `:not([disabled])` direto no locator torna a busca
    // pelo alvo e o clique uma operação atômica; esperar a contagem de
    // habilitados cair em exatamente 1 confirma que aquele approve
    // específico terminou antes de seguir pro próximo.
    const enabledApprove = page
      .getByRole("button", { name: "Aprovar", exact: true })
      .and(page.locator("button:not([disabled])"));
    for (let i = 0; i < approveCount; i++) {
      const beforeCount = await enabledApprove.count();
      await enabledApprove.first().click();
      await expect(enabledApprove).toHaveCount(beforeCount - 1, { timeout: 15_000 });
    }

    await expect(page.getByRole("heading", { name: "Pacote pronto" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Baixar pacote (.zip)" })).toBeVisible();
  });
});
