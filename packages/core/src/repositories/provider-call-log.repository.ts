import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type ProviderCallLogRow = Database["public"]["Tables"]["provider_call_logs"]["Row"];
type ProviderCallLogInsert = Database["public"]["Tables"]["provider_call_logs"]["Insert"];

export interface FindProviderCallLogsFilter {
  providerKey?: string;
  organizationId?: string;
  since?: string;
  limit?: number;
}

/**
 * Único ponto de código que fala com a tabela `provider_call_logs`
 * (ver CONVENTIONS.md §2 — Repository Pattern, architecture.md §15.7).
 * Append-only, alto volume — gravado pelos 4 adapters reais via
 * `logProviderCall` (packages/core/src/platform-admin/log-provider-call.ts).
 */
export class ProviderCallLogRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async record(input: ProviderCallLogInsert): Promise<ProviderCallLogRow> {
    const { data, error } = await this.db.from("provider_call_logs").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async find(filter: FindProviderCallLogsFilter): Promise<ProviderCallLogRow[]> {
    let query = this.db
      .from("provider_call_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 200);

    if (filter.providerKey) query = query.eq("provider_key", filter.providerKey);
    if (filter.organizationId) query = query.eq("organization_id", filter.organizationId);
    if (filter.since) query = query.gte("created_at", filter.since);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }
}
