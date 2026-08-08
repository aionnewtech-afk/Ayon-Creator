import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type TrendResearchRow = Database["public"]["Tables"]["trend_research"]["Row"];
type TrendResearchInsert = Database["public"]["Tables"]["trend_research"]["Insert"];
type TrendResearchUpdate = Database["public"]["Tables"]["trend_research"]["Update"];

/**
 * Único ponto de código que fala com a tabela `trend_research`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class TrendResearchRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: TrendResearchInsert): Promise<TrendResearchRow> {
    const { data, error } = await this.db.from("trend_research").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: TrendResearchUpdate): Promise<TrendResearchRow> {
    const { data, error } = await this.db
      .from("trend_research")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<TrendResearchRow | null> {
    const { data, error } = await this.db.from("trend_research").select("*").eq("id", id).maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Mais recente primeiro — TREND-1 mostra a última execução da marca. */
  async findLatestByBrandId(brandId: string): Promise<TrendResearchRow | null> {
    const { data, error } = await this.db
      .from("trend_research")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Últimas N execuções concluídas — usado para extrair títulos já
   * mostrados ao usuário (achado real, sprint de estabilização: "Buscar
   * novidades" sempre trazia as mesmas tendências, porque nada avisava o
   * Trend Source Provider quais já tinham sido mostradas antes).
   */
  async findRecentCompletedByBrandId(brandId: string, limit = 5): Promise<TrendResearchRow[]> {
    const { data, error } = await this.db
      .from("trend_research")
      .select("*")
      .eq("brand_id", brandId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }
}
