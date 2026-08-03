import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type OpinionRow = Database["public"]["Tables"]["specialist_opinions"]["Row"];
type OpinionInsert = Database["public"]["Tables"]["specialist_opinions"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `specialist_opinions`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class SpecialistOpinionRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: OpinionInsert): Promise<OpinionRow> {
    const { data, error } = await this.db
      .from("specialist_opinions")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findBySessionId(sessionId: string): Promise<OpinionRow[]> {
    const { data, error } = await this.db
      .from("specialist_opinions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
