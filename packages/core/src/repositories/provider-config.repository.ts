import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { ProviderCapability, ProviderTier } from "@ayon/types";

type ProviderConfigRow = Database["public"]["Tables"]["provider_configs"]["Row"];
type ProviderConfigUpdate = Database["public"]["Tables"]["provider_configs"]["Update"];

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

  /**
   * Resolve `(capability, tier)` para um `provider_key`. Quando `specialistId`
   * é informado (architecture.md §4.1, Specialist Registry), tenta primeiro
   * uma linha específica para esse especialista — e cai para a linha genérica
   * (`specialist_id is null`) se não existir nenhuma. Isso significa que
   * nenhuma linha de `provider_configs` por especialista precisa existir para
   * o Intelligence Hub funcionar; elas são só um refinamento opcional futuro
   * (tier Premium, PRD §13.2).
   */
  async findActive(
    capability: ProviderCapability,
    tier: ProviderTier,
    specialistId?: string,
  ): Promise<ProviderConfigRow | null> {
    if (specialistId) {
      const specific = await this.findActiveBySpecialist(capability, tier, specialistId);
      if (specific) return specific;
    }

    return this.findActiveBySpecialist(capability, tier, null);
  }

  private async findActiveBySpecialist(
    capability: ProviderCapability,
    tier: ProviderTier,
    specialistId: string | null,
  ): Promise<ProviderConfigRow | null> {
    let query = this.db
      .from("provider_configs")
      .select("*")
      .eq("capability", capability)
      .eq("tier", tier)
      .eq("status", "active");

    query = specialistId ? query.eq("specialist_id", specialistId) : query.is("specialist_id", null);

    const { data, error } = await query.order("priority", { ascending: false }).limit(1).maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Todas as configs, qualquer status — uso administrativo (tela Providers, §15.8). */
  async findAll(): Promise<ProviderConfigRow[]> {
    const { data, error } = await this.db
      .from("provider_configs")
      .select("*")
      .order("capability", { ascending: true })
      .order("tier", { ascending: true })
      .order("priority", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async update(id: string, patch: ProviderConfigUpdate): Promise<ProviderConfigRow> {
    const { data, error } = await this.db.from("provider_configs").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }
}
