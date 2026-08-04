import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    environment: "node",
    // RLS/concorrência batem num Postgres local real (supabase start) —
    // mais lento que unitário puro; 30s cobre os testes de concorrência
    // (10 inserts sequenciais reais) com folga.
    testTimeout: 30_000,
    // Testes deste diretório mudam estado compartilhado (mesma org/usuário
    // de teste) — nunca rodar em paralelo dentro do mesmo arquivo nem entre
    // arquivos.
    fileParallelism: false,
  },
});
