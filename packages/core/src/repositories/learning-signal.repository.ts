import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type LearningSignalRow = Database["public"]["Tables"]["learning_signals"]["Row"];
type LearningSignalInsert = Database["public"]["Tables"]["learning_signals"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `learning_signals`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class LearningSignalRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: LearningSignalInsert): Promise<LearningSignalRow> {
    const { data, error } = await this.db.from("learning_signals").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  /**
   * Sinais da marca ainda não considerados numa análise anterior — "não
   * usado" é definido como criado depois da última `learning_insights` da
   * marca (nenhuma análise anterior considerou algo que não existia ainda
   * quando rodou). Sem coluna própria de "consumido": database.md §4.7 não
   * previu isso, e o corte por timestamp cobre a mesma regra sem mudar
   * schema. Se a marca nunca teve uma análise, todos os sinais contam.
   */
  async findUnusedByBrandId(brandId: string): Promise<LearningSignalRow[]> {
    const { data: lastInsight, error: lastInsightError } = await this.db
      .from("learning_insights")
      .select("created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastInsightError) throw lastInsightError;

    let query = this.db.from("learning_signals").select("*").eq("brand_id", brandId).order("created_at", { ascending: true });

    if (lastInsight) {
      query = query.gt("created_at", lastInsight.created_at);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ?? [];
  }
}
