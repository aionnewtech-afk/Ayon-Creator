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
 * texto geradas → upload de mídia própria nas 3 peças visuais restantes
 * (Thumbnail/Carrossel/Stories) → aprovar as 8 → confirma que a peça de
 * vídeo (`licensed_stock_video`, Missão 9) mostra corretamente o botão
 * "Gerar vídeo automaticamente", sem clicar nele.
 *
 * ★ Missão 11 — Thumbnail/Carrossel/Stories saíram de `own_media` para
 * `licensed_stock_photo` (geração automática via Fluxo 15, arch. §14.4).
 * O upload manual continua disponível como alternativa (arch. §14.4) — é
 * esse caminho, determinístico, que este smoke test continua exercitando;
 * a geração automática de foto depende de fornecedores externos reais
 * (Pexels/Shotstack), mesmo motivo pelo qual o vídeo é validado manualmente
 * (ver parágrafo abaixo).
 *
 * ★ Missão 9 — o pacote final (`content_packages`) exige TODAS as peças
 * aprovadas, inclusive a de vídeo (Fluxo 4: aprovação humana obrigatória
 * para toda peça, sem exceção). A peça de vídeo depende de 3 fornecedores
 * externos reais (ElevenLabs/Pexels/Shotstack) + n8n — nenhum tem
 * equivalente fake como o `LlmProvider`, então este smoke test determinístico
 * não tenta gerar o vídeo nem monta o pacote completo; isso é validado
 * manualmente com os fornecedores reais a cada missão (mesmo princípio já
 * documentado acima para o texto). Registrado aqui, não escondido — decisão
 * consciente, não lacuna esquecida.
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

    // ★ Missão 10 — botão global "Enviar feedback" (topbar, todas as telas
    // autenticadas). Só confirma que o botão de abrir o modal renderiza
    // (regressão de wiring); o envio real (Server Action + RLS) é validado
    // manualmente com Supabase real a cada missão (mesmo princípio já
    // documentado acima para vídeo/LLM).
    await expect(page.getByRole("button", { name: "Enviar feedback" })).toBeVisible();

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

    // ★ Missão 9 — Vídeo agora é `licensed_stock_video` (geração automática),
    // não mais `own_media`. Confirma a UI nova (botão "Gerar vídeo
    // automaticamente") antes de seguir para os 3 uploads restantes.
    const videoCard = page.locator("section, div").filter({ hasText: "Vídeo" }).first();
    await expect(videoCard.getByRole("button", { name: "Gerar vídeo automaticamente" })).toBeVisible({
      timeout: 15_000,
    });

    // ★ Missão 11 — upload manual continua disponível como alternativa nas 3
    // peças de foto (arch. §14.4), mesmo agora sendo `licensed_stock_photo`.
    const fixtureImage = path.join(__dirname, "fixtures", "test-image.png");
    const fileInputs = page.locator('input[type="file"]');
    const uploadCount = await fileInputs.count();
    expect(uploadCount).toBe(3); // Thumbnail, Carrossel, Stories — Vídeo não usa mais upload manual
    for (let i = 0; i < uploadCount; i++) {
      await fileInputs.nth(i).setInputFiles(fixtureImage);
    }

    // ★ Achado real (CI) — um locator amplo (`section, div` + `hasText`)
    // casa primeiro com um ancestral que já contém "Pronta para revisão" de
    // uma peça de texto qualquer, passando cedo demais e deixando os 3
    // uploads em voo quando a contagem abaixo era lida de uma vez só.
    // `toHaveCount` reavalia até o timeout, esperando de verdade os 3
    // uploads terminarem (cada um vira uma Server Action assíncrona).
    const approveButtons = page.getByRole("button", { name: "Aprovar", exact: true });
    await expect(approveButtons).toHaveCount(8, { timeout: 20_000 }); // 5 peças de texto + 3 fotos enviadas manualmente (Vídeo fica de fora — ver docstring acima)
    const approveCount = await approveButtons.count();

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

    // Pacote completo (Fluxo 3.3) exige TODAS as peças aprovadas, inclusive
    // a de vídeo — que este smoke test deliberadamente não gera (ver
    // docstring). "Pacote pronto" não é alcançável aqui; a peça de vídeo
    // segue disponível para gerar, provando que aprovar as outras 8 não a
    // afeta nem trava a tela.
    await expect(videoCard.getByRole("button", { name: "Gerar vídeo automaticamente" })).toBeVisible();
  });
});
