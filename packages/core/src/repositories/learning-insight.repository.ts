import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type LearningInsightRow = Database["public"]["Tables"]["learning_insights"]["Row"];
type LearningInsightInsert = Database["public"]["Tables"]["learning_insights"]["Insert"];
type LearningInsightUpdate = Database["public"]["Tables"]["learning_insights"]["Update"];

/**
 * Único ponto de código que fala com a tabela `learning_insights`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class LearningInsightRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: LearningInsightInsert): Promise<LearningInsightRow> {
    const { data, error } = await this.db.from("learning_insights").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: LearningInsightUpdate): Promise<LearningInsightRow> {
    const { data, error } = await this.db.from("learning_insights").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<LearningInsightRow | null> {
    const { data, error } = await this.db.from("learning_insights").select("*").eq("id", id).maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Todas as sugestões da marca (pendentes + histórico), mais recentes primeiro — EVOL-1. */
  async findByBrandId(brandId: string): Promise<LearningInsightRow[]> {
    const { data, error } = await this.db
      .from("learning_insights")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
