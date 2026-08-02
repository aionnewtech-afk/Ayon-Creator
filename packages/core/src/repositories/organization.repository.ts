import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type OrganizationInsert = Database["public"]["Tables"]["organizations"]["Insert"];
type OrganizationMemberRow = Database["public"]["Tables"]["organization_members"]["Row"];
type OrganizationMemberInsert = Database["public"]["Tables"]["organization_members"]["Insert"];

/**
 * Único ponto de código que fala com as tabelas `organizations` e
 * `organization_members` (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class OrganizationRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: OrganizationInsert): Promise<OrganizationRow> {
    const { data, error } = await this.db
      .from("organizations")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<OrganizationRow | null> {
    const { data, error } = await this.db
      .from("organizations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findBySlug(slug: string): Promise<OrganizationRow | null> {
    const { data, error } = await this.db
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async addMember(input: OrganizationMemberInsert): Promise<OrganizationMemberRow> {
    const { data, error } = await this.db
      .from("organization_members")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findMembershipsByUserId(userId: string): Promise<OrganizationMemberRow[]> {
    const { data, error } = await this.db
      .from("organization_members")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) throw error;
    return data ?? [];
  }
}
