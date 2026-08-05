import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
type UserProfileInsert = Database["public"]["Tables"]["user_profiles"]["Insert"];
type UserProfileUpdate = Database["public"]["Tables"]["user_profiles"]["Update"];

/**
 * Único ponto de código que fala com a tabela `user_profiles`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 */
export class UserRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async createProfile(input: UserProfileInsert): Promise<UserProfileRow> {
    const { data, error } = await this.db
      .from("user_profiles")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByUserId(userId: string): Promise<UserProfileRow | null> {
    const { data, error } = await this.db
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async update(userId: string, patch: UserProfileUpdate): Promise<UserProfileRow> {
    const { data, error } = await this.db
      .from("user_profiles")
      .update(patch)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
