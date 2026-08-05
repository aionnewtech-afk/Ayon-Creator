import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OrganizationMemberRole, UserProfileStatus } from "@ayon/types";

export interface UserOverviewRow {
  membershipId: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  role: OrganizationMemberRole;
  fullName: string | null;
  email: string | null;
  profileStatus: UserProfileStatus | null;
  lastSignInAt: string | null;
  createdAt: string;
}

/**
 * Visão de Usuários (architecture.md §15.8) — sempre via service role:
 * `user_profiles` não é coberta pela extensão de RLS (achado real, revisão
 * 37 — só tem policy `user_id = auth.uid()`), e `auth.users` só é acessível
 * via Admin API do Supabase, que já exige service role.
 */
export async function getUsersOverview(serviceRoleDb: SupabaseClient<Database>): Promise<UserOverviewRow[]> {
  const [membershipsResult, organizationsResult, profilesResult, authListResult] = await Promise.all([
    serviceRoleDb.from("organization_members").select("*").is("deleted_at", null),
    serviceRoleDb.from("organizations").select("id, name").is("deleted_at", null),
    serviceRoleDb.from("user_profiles").select("*").is("deleted_at", null),
    serviceRoleDb.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (membershipsResult.error) throw membershipsResult.error;
  if (organizationsResult.error) throw organizationsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (authListResult.error) throw authListResult.error;

  const organizationNameById = new Map((organizationsResult.data ?? []).map((row) => [row.id, row.name]));
  const profileByUserId = new Map((profilesResult.data ?? []).map((row) => [row.user_id, row]));
  const authUserById = new Map(authListResult.data.users.map((user) => [user.id, user]));

  return (membershipsResult.data ?? []).map((membership) => {
    const profile = profileByUserId.get(membership.user_id);
    const authUser = authUserById.get(membership.user_id);
    return {
      membershipId: membership.id,
      userId: membership.user_id,
      organizationId: membership.organization_id,
      organizationName: organizationNameById.get(membership.organization_id) ?? "—",
      role: membership.role,
      fullName: profile?.full_name ?? null,
      email: authUser?.email ?? null,
      profileStatus: profile?.status ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      createdAt: membership.created_at,
    };
  });
}
