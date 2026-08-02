import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `brands`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class BrandRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: BrandInsert): Promise<BrandRow> {
    const { data, error } = await this.db
      .from("brands")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByOrganizationId(organizationId: string): Promise<BrandRow[]> {
    const { data, error } = await this.db
      .from("brands")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
