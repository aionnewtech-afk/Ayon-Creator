import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type ContentPieceRow = Database["public"]["Tables"]["content_pieces"]["Row"];
type ContentPieceInsert = Database["public"]["Tables"]["content_pieces"]["Insert"];
type ContentPieceUpdate = Database["public"]["Tables"]["content_pieces"]["Update"];

/**
 * Único ponto de código que fala com a tabela `content_pieces`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class ContentPieceRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: ContentPieceInsert): Promise<ContentPieceRow> {
    const { data, error } = await this.db.from("content_pieces").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: ContentPieceUpdate): Promise<ContentPieceRow> {
    const { data, error } = await this.db.from("content_pieces").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<ContentPieceRow | null> {
    const { data, error } = await this.db.from("content_pieces").select("*").eq("id", id).maybeSingle();

    if (error) throw error;
    return data;
  }

  async findByCampaignId(campaignId: string): Promise<ContentPieceRow[]> {
    const { data, error } = await this.db
      .from("content_pieces")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
