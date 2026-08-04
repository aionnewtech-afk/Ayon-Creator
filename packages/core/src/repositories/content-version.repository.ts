import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type ContentVersionRow = Database["public"]["Tables"]["content_versions"]["Row"];
type ContentVersionInsert = Database["public"]["Tables"]["content_versions"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `content_versions`
 * (ver CONVENTIONS.md §2 — Repository Pattern). Append-only por design — uma
 * regeneração ou reenvio cria uma nova versão, nunca sobrescreve a anterior.
 */
export class ContentVersionRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: ContentVersionInsert): Promise<ContentVersionRow> {
    const { data, error } = await this.db.from("content_versions").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async findByContentPieceId(contentPieceId: string): Promise<ContentVersionRow[]> {
    const { data, error } = await this.db
      .from("content_versions")
      .select("*")
      .eq("content_piece_id", contentPieceId)
      .order("version_number", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async findLatestByContentPieceId(contentPieceId: string): Promise<ContentVersionRow | null> {
    const { data, error } = await this.db
      .from("content_versions")
      .select("*")
      .eq("content_piece_id", contentPieceId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
