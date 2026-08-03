import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type CreditPackageRow = Database["public"]["Tables"]["credit_packages"]["Row"];

/**
 * Único ponto de código que fala com a tabela `credit_packages`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class CreditPackageRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<CreditPackageRow | null> {
    const { data, error } = await this.db.from("credit_packages").select("*").eq("id", id).maybeSingle();

    if (error) throw error;
    return data;
  }

  async findAllActive(): Promise<CreditPackageRow[]> {
    const { data, error } = await this.db
      .from("credit_packages")
      .select("*")
      .eq("status", "active")
      .order("credits", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
