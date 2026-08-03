import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type SessionRow = Database["public"]["Tables"]["intelligence_hub_sessions"]["Row"];
type SessionInsert = Database["public"]["Tables"]["intelligence_hub_sessions"]["Insert"];
type SessionUpdate = Database["public"]["Tables"]["intelligence_hub_sessions"]["Update"];

/**
 * Único ponto de código que fala com a tabela `intelligence_hub_sessions`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class IntelligenceHubSessionRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: SessionInsert): Promise<SessionRow> {
    const { data, error } = await this.db
      .from("intelligence_hub_sessions")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: SessionUpdate): Promise<SessionRow> {
    const { data, error } = await this.db
      .from("intelligence_hub_sessions")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<SessionRow | null> {
    const { data, error } = await this.db
      .from("intelligence_hub_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
