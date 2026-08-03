import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type KnowledgeBaseItemRow = Database["public"]["Tables"]["knowledge_base_items"]["Row"];
type KnowledgeBaseItemInsert = Database["public"]["Tables"]["knowledge_base_items"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `knowledge_base_items`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class KnowledgeBaseItemRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: KnowledgeBaseItemInsert): Promise<KnowledgeBaseItemRow> {
    const { data, error } = await this.db
      .from("knowledge_base_items")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByBrandId(brandId: string): Promise<KnowledgeBaseItemRow[]> {
    const { data, error } = await this.db
      .from("knowledge_base_items")
      .select("*")
      .eq("brand_id", brandId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
