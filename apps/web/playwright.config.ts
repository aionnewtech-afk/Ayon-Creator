import { defineConfig } from "@playwright/test";

/**
 * Smoke test de CI (Missão H2, CONVENTIONS.md §10) — roda contra o Next
 * dev server local com LLM_PROVIDER_MODE=fake, apontado para o Supabase
 * local efêmero (`supabase start`). `webServer` sobe o app sozinho quando
 * `reuseExistingServer` não encontra um já rodando na porta.
 *
 * As credenciais do Supabase local vêm do ambiente do processo (nunca de
 * `.env.local`, que aponta pro projeto remoto de desenvolvimento) —
 * `webServer.env` repassa explicitamente para o `next dev` filho, com os
 * nomes de variável que a Next app espera (`NEXT_PUBLIC_*`), lidos das
 * mesmas `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`
 * que `e2e/support/seed.ts` e `supabase/tests/` também usam.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} não configurada — o smoke test precisa de um Supabase local rodando (\`supabase start\`).`,
    );
  }
  return value;
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3010",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // `webServer.env` substitui process.env por completo (não faz merge)
      // — espalhamos explicitamente para o processo filho não perder PATH
      // e o resto do ambiente necessário para `pnpm dev` rodar.
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: requireEnv("SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv("SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      LLM_PROVIDER_MODE: "fake",
      NEXT_PUBLIC_APP_URL: "http://localhost:3010",
    },
  },
});
