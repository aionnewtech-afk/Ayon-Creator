import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";

type CreditPricingRow = Database["public"]["Tables"]["credit_pricing"]["Row"];
type CreditPricingUpdate = Database["public"]["Tables"]["credit_pricing"]["Update"];

/**
 * Único ponto de código que fala com a tabela `credit_pricing`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class CreditPricingRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findActive(triggerReason: string, tier: ProviderTier): Promise<CreditPricingRow | null> {
    const { data, error } = await this.db
      .from("credit_pricing")
      .select("*")
      .eq("trigger_reason", triggerReason)
      .eq("tier", tier)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Todos os preços, qualquer status — uso administrativo (tela Configurações, §15.8). */
  async findAll(): Promise<CreditPricingRow[]> {
    const { data, error } = await this.db.from("credit_pricing").select("*").order("trigger_reason", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async update(id: string, patch: CreditPricingUpdate): Promise<CreditPricingRow> {
    const { data, error } = await this.db.from("credit_pricing").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }
}
