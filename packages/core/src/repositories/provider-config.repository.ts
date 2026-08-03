import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { ProviderCapability, ProviderTier, SpecialistType } from "@ayon/types";

type ProviderConfigRow = Database["public"]["Tables"]["provider_configs"]["Row"];

/**
 * Único ponto de código que fala com a tabela `provider_configs`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 *
 * Importante: `provider_configs` não tem policy de RLS para usuários finais
 * (database.md §8) — este repository só deve ser instanciado com um client
 * de service role (ver apps/web/lib/supabase/service-role.ts), nunca com o
 * client de sessão do usuário.
 */
export class ProviderConfigRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findActive(
    capability: ProviderCapability,
    tier: ProviderTier,
    specialistType?: SpecialistType,
  ): Promise<ProviderConfigRow | null> {
    let query = this.db
      .from("provider_configs")
      .select("*")
      .eq("capability", capability)
      .eq("tier", tier)
      .eq("status", "active");

    query = specialistType ? query.eq("specialist_type", specialistType) : query.is("specialist_type", null);

    const { data, error } = await query.order("priority", { ascending: false }).limit(1).maybeSingle();

    if (error) throw error;
    return data;
  }
}
