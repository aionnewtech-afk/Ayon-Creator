import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];
type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

/**
 * Único ponto de código que fala com a tabela `audit_logs`
 * (ver database.md §9.1 — escrita só pela camada de Repository, nunca pelo client).
 */
export class AuditRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async record(input: AuditLogInsert): Promise<AuditLogRow> {
    const { data, error } = await this.db
      .from("audit_logs")
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
