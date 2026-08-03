import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type BrandBrainProfileRow = Database["public"]["Tables"]["brand_brain_profiles"]["Row"];
type BrandBrainProfileInsert = Database["public"]["Tables"]["brand_brain_profiles"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `brand_brain_profiles`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 *
 * Não faz merge de campos (ex.: acrescentar a `competitors`) — isso é lógica
 * de negócio da conversa "Conheça sua empresa" e fica no Core Engine/Server
 * Action que chama este repository, não aqui.
 */
export class BrandBrainRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findByBrandId(brandId: string): Promise<BrandBrainProfileRow | null> {
    const { data, error } = await this.db
      .from("brand_brain_profiles")
      .select("*")
      .eq("brand_id", brandId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async upsertByBrandId(
    brandId: string,
    patch: Omit<BrandBrainProfileInsert, "brand_id">,
  ): Promise<BrandBrainProfileRow> {
    const { data, error } = await this.db
      .from("brand_brain_profiles")
      .upsert({ ...patch, brand_id: brandId }, { onConflict: "brand_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
