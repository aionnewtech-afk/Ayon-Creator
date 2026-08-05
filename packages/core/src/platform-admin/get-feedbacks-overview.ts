import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

export interface FeedbackOverviewRow {
  id: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  category: Database["public"]["Tables"]["user_feedback"]["Row"]["category"];
  description: string;
  pathname: string | null;
  status: Database["public"]["Tables"]["user_feedback"]["Row"]["status"];
  internalResponse: string | null;
  archivedAt: string | null;
  createdAt: string;
}

/**
 * CRM interno de Feedbacks (architecture.md §15.8, ux-design.md ADMIN-8) —
 * `user_feedback` não tem policy de select para `authenticated` (primeira
 * interface de leitura desta tabela, database.md §9.3) — sempre service role.
 */
export async function getFeedbacksOverview(serviceRoleDb: SupabaseClient<Database>): Promise<FeedbackOverviewRow[]> {
  const [feedbackResult, organizationsResult] = await Promise.all([
    serviceRoleDb.from("user_feedback").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    serviceRoleDb.from("organizations").select("id, name"),
  ]);

  if (feedbackResult.error) throw feedbackResult.error;
  if (organizationsResult.error) throw organizationsResult.error;

  const organizationNameById = new Map((organizationsResult.data ?? []).map((row) => [row.id, row.name]));

  return (feedbackResult.data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationName: organizationNameById.get(row.organization_id) ?? "—",
    userId: row.user_id,
    category: row.category,
    description: row.description,
    pathname: row.pathname,
    status: row.status,
    internalResponse: row.internal_response,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }));
}
