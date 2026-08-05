import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type PlatformAdminRow = Database["public"]["Tables"]["platform_admins"]["Row"];
type PlatformAdminInsert = Database["public"]["Tables"]["platform_admins"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `platform_admins`
 * (ver CONVENTIONS.md §2 — Repository Pattern). Criar/revogar é ação
 * exclusiva de `super_admin` (architecture.md §15.1.1) — o guard fica na
 * Server Action que chama este repository, nunca aqui.
 */
export class PlatformAdminRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: PlatformAdminInsert): Promise<PlatformAdminRow> {
    const { data, error } = await this.db.from("platform_admins").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async findAll(): Promise<PlatformAdminRow[]> {
    const { data, error } = await this.db
      .from("platform_admins")
      .select("*")
      .is("deleted_at", null)
      .order("granted_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async revoke(id: string): Promise<PlatformAdminRow> {
    const { data, error } = await this.db
      .from("platform_admins")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
