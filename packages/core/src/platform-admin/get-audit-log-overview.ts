import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlatformAdminRole } from "@ayon/types";
import { AdminAuditLogRepository } from "../repositories/admin-audit-log.repository";

export interface AuditLogOverviewRow {
  id: string;
  actorUserId: string;
  actorEmail: string | null;
  actorRole: PlatformAdminRole;
  organizationId: string | null;
  organizationName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * Visão de Auditoria (architecture.md §15.6/§15.8) — admin_audit_logs
 * (service role, achado real revisão 37) com ator/organização resolvidos
 * para leitura humana (e-mail via Admin API, nome da organização).
 */
export async function getAuditLogOverview(serviceRoleDb: SupabaseClient<Database>, limit = 200): Promise<AuditLogOverviewRow[]> {
  const adminAuditLogRepository = new AdminAuditLogRepository(serviceRoleDb);

  const [logs, organizationsResult, authListResult] = await Promise.all([
    adminAuditLogRepository.find({ limit }),
    serviceRoleDb.from("organizations").select("id, name"),
    serviceRoleDb.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (authListResult.error) throw authListResult.error;

  const organizationNameById = new Map((organizationsResult.data ?? []).map((row) => [row.id, row.name]));
  const emailByUserId = new Map(authListResult.data.users.map((user) => [user.id, user.email ?? null]));

  return logs.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorEmail: emailByUserId.get(row.actor_user_id) ?? null,
    actorRole: row.actor_role,
    organizationId: row.organization_id,
    organizationName: row.organization_id ? (organizationNameById.get(row.organization_id) ?? null) : null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row.before,
    after: row.after,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}
