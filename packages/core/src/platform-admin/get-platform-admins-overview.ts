import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlatformAdminRole } from "@ayon/types";
import { PlatformAdminRepository } from "../repositories/platform-admin.repository";

export interface PlatformAdminOverviewRow {
  id: string;
  userId: string;
  email: string | null;
  role: PlatformAdminRole;
  grantedByEmail: string | null;
  grantedAt: string;
}

/**
 * Visão de administradores da plataforma (architecture.md §15.1) — só
 * `super_admin` gerencia (criar/revogar), sempre service role
 * (`platform_admins` sem policy de RLS para `authenticated`, revisão 37).
 */
export async function getPlatformAdminsOverview(serviceRoleDb: SupabaseClient<Database>): Promise<PlatformAdminOverviewRow[]> {
  const platformAdminRepository = new PlatformAdminRepository(serviceRoleDb);
  const [admins, authListResult] = await Promise.all([platformAdminRepository.findAll(), serviceRoleDb.auth.admin.listUsers({ perPage: 1000 })]);

  if (authListResult.error) throw authListResult.error;

  const emailByUserId = new Map(authListResult.data.users.map((user) => [user.id, user.email ?? null]));

  return admins.map((admin) => ({
    id: admin.id,
    userId: admin.user_id,
    email: emailByUserId.get(admin.user_id) ?? null,
    role: admin.role,
    grantedByEmail: admin.granted_by ? (emailByUserId.get(admin.granted_by) ?? null) : null,
    grantedAt: admin.granted_at,
  }));
}
