import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ProviderConfigRepository } from "../repositories/provider-config.repository";
import { AnthropicLlmProvider } from "./anthropic-llm-provider";
import type { LlmProvider } from "./llm-provider";

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
): Promise<LlmProvider> {
  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("llm", tier);

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
