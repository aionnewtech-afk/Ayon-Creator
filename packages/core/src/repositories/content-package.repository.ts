import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type ContentPackageRow = Database["public"]["Tables"]["content_packages"]["Row"];
type ContentPackageInsert = Database["public"]["Tables"]["content_packages"]["Insert"];
type ContentPackageUpdate = Database["public"]["Tables"]["content_packages"]["Update"];

/**
 * Único ponto de código que fala com a tabela `content_packages`
 * (ver CONVENTIONS.md §2 — Repository Pattern). 1:1 com `campaigns`
 * (`campaign_id` é `unique`).
 */
export class ContentPackageRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async upsertByCampaignId(campaignId: string, patch: Omit<ContentPackageInsert, "campaign_id">): Promise<ContentPackageRow> {
    const { data, error } = await this.db
      .from("content_packages")
      .upsert({ ...patch, campaign_id: campaignId }, { onConflict: "campaign_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: ContentPackageUpdate): Promise<ContentPackageRow> {
    const { data, error } = await this.db.from("content_packages").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }

  async findByCampaignId(campaignId: string): Promise<ContentPackageRow | null> {
    const { data, error } = await this.db
      .from("content_packages")
      .select("*")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
