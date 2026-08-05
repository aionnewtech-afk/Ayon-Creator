import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlatformAdminRole } from "@ayon/types";
import { AdminAuditLogRepository } from "../repositories/admin-audit-log.repository";

export interface RecordAdminActionParams {
  serviceRoleDb: SupabaseClient<Database>;
  actorUserId: string;
  actorRole: PlatformAdminRole;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Helper único de auditoria administrativa (architecture.md §15.6) — toda
 * Server Action administrativa que muda dado chama isto depois de aplicar a
 * mudança. IP/User-Agent são lidos no servidor por quem chama (`headers()`
 * do Next.js), nunca confiados do client — `packages/core` nunca importa
 * `next/headers` (CONVENTIONS.md §1).
 */
export async function recordAdminAction(params: RecordAdminActionParams): Promise<void> {
  const adminAuditLogRepository = new AdminAuditLogRepository(params.serviceRoleDb);

  await adminAuditLogRepository.record({
    actor_user_id: params.actorUserId,
    actor_role: params.actorRole,
    organization_id: params.organizationId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });
}
