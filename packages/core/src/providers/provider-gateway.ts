import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ProviderConfigRepository } from "../repositories/provider-config.repository";
import { AnthropicLlmProvider } from "./anthropic-llm-provider";
import { AnthropicWebSearchTrendSourceProvider } from "./anthropic-web-search-trend-source-provider";
import type { LlmProvider } from "./llm-provider";
import type { TrendSourceProvider } from "./trend-source-provider";

/**
 * Único ponto de código que resolve `(capability, tier)` → adapter concreto
 * (architecture.md §5.1). Nenhum Core Engine deve importar um adapter
 * diretamente — sempre passar por aqui.
 *
 * `db` precisa ser um client de **service role** — `provider_configs` não
 * tem policy de RLS para o usuário final (database.md §8).
 */
export async function resolveLlmProvider(
  db: SupabaseClient<Database>,
  tier: ProviderTier,
  specialistId?: string,
): Promise<LlmProvider> {
  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("llm", tier, specialistId);

  if (!config) {
    throw new Error(`Nenhum provider_config ativo para (capability=llm, tier=${tier}).`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada — necessária para a Ayon conversar (ver README/`.env.local.example`).",
    );
  }

  return new AnthropicLlmProvider(config.provider_key, apiKey);
}

/**
 * Resolve `(capability: "trend_source", tier)` → adapter concreto
 * (architecture.md §3.3). O Trend Engine nunca conhece o fornecedor
 * concreto por trás desta função, apenas `TrendSourceProvider`.
 */
export async function resolveTrendSourceProvider(
  db: SupabaseClient<Database>,
  tier: ProviderTier,
): Promise<TrendSourceProvider> {
  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("trend_source", tier);

  if (!config) {
    throw new Error(`Nenhum provider_config ativo para (capability=trend_source, tier=${tier}).`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada — necessária para o Trend Engine pesquisar tendências (ver README/`.env.local.example`).",
    );
  }

  return new AnthropicWebSearchTrendSourceProvider(config.provider_key, apiKey);
}
