import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];

/**
 * Único ponto de código que fala com a tabela `campaigns`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class CampaignRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: CampaignInsert): Promise<CampaignRow> {
    const { data, error } = await this.db.from("campaigns").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: CampaignUpdate): Promise<CampaignRow> {
    const { data, error } = await this.db
      .from("campaigns")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<CampaignRow | null> {
    const { data, error } = await this.db.from("campaigns").select("*").eq("id", id).maybeSingle();

    if (error) throw error;
    return data;
  }

  async findByBrandId(brandId: string): Promise<CampaignRow[]> {
    const { data, error } = await this.db
      .from("campaigns")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
