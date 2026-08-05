import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
type FeatureFlagUpdate = Database["public"]["Tables"]["feature_flags"]["Update"];

/** Único ponto de código que fala com a tabela `feature_flags` (ver CONVENTIONS.md §2 — Repository Pattern). Primeira interface administrativa desta tabela (tela Configurações, Missão 12). */
export class FeatureFlagRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findAll(): Promise<FeatureFlagRow[]> {
    const { data, error } = await this.db.from("feature_flags").select("*").order("key", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async update(id: string, patch: FeatureFlagUpdate): Promise<FeatureFlagRow> {
    const { data, error } = await this.db.from("feature_flags").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }
}
