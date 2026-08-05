import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];

/**
 * Único ponto de código que fala com a tabela `brands`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class BrandRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: BrandInsert): Promise<BrandRow> {
    const { data, error } = await this.db
      .from("brands")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<BrandRow | null> {
    const { data, error } = await this.db.from("brands").select("*").eq("id", id).maybeSingle();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: BrandUpdate): Promise<BrandRow> {
    const { data, error } = await this.db.from("brands").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }

  /** Todas as marcas, qualquer organização — uso administrativo (tela Branding, §15.8). */
  async findAll(): Promise<BrandRow[]> {
    const { data, error } = await this.db.from("brands").select("*").is("deleted_at", null).order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async findByOrganizationId(organizationId: string): Promise<BrandRow[]> {
    const { data, error } = await this.db
      .from("brands")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
