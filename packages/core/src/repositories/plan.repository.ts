import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SubscriptionPlan } from "@ayon/types";

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
type PlanUpdate = Database["public"]["Tables"]["plans"]["Update"];

/**
 * Único ponto de código que fala com a tabela `plans`
 * (ver CONVENTIONS.md §2 — Repository Pattern). Números de cada plano
 * (créditos/mês, marcas, tier, preço) são dado, não código — única fonte da
 * verdade compartilhada entre o handler de webhook (packages/core) e a UI
 * de Configurações (apps/web), evitando duas constantes divergentes.
 */
export class PlanRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findByPlan(plan: SubscriptionPlan): Promise<PlanRow | null> {
    const { data, error } = await this.db.from("plans").select("*").eq("plan", plan).maybeSingle();

    if (error) throw error;
    return data;
  }

  async findAllActive(): Promise<PlanRow[]> {
    const { data, error } = await this.db
      .from("plans")
      .select("*")
      .eq("status", "active")
      .order("price_cents", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  /** Todos os planos, ativos ou não — uso administrativo (tela Planos, §15.8). */
  async findAll(): Promise<PlanRow[]> {
    const { data, error } = await this.db.from("plans").select("*").order("price_cents", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async update(plan: SubscriptionPlan, patch: PlanUpdate): Promise<PlanRow> {
    const { data, error } = await this.db.from("plans").update(patch).eq("plan", plan).select().single();

    if (error) throw error;
    return data;
  }
}
