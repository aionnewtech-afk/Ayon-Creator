import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type AdminAuditLogRow = Database["public"]["Tables"]["admin_audit_logs"]["Row"];
type AdminAuditLogInsert = Database["public"]["Tables"]["admin_audit_logs"]["Insert"];

export interface FindAdminAuditLogsFilter {
  organizationId?: string;
  actorUserId?: string;
  limit?: number;
}

/**
 * Único ponto de código que fala com a tabela `admin_audit_logs`
 * (ver CONVENTIONS.md §2 — Repository Pattern, architecture.md §15.6).
 * Append-only — sem `update`/`delete`.
 */
export class AdminAuditLogRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async record(input: AdminAuditLogInsert): Promise<AdminAuditLogRow> {
    const { data, error } = await this.db.from("admin_audit_logs").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async find(filter: FindAdminAuditLogsFilter): Promise<AdminAuditLogRow[]> {
    let query = this.db
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 100);

    if (filter.organizationId) query = query.eq("organization_id", filter.organizationId);
    if (filter.actorUserId) query = query.eq("actor_user_id", filter.actorUserId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }
}
