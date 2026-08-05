"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { OrganizationRepository, UserRepository, getPlatformAdminRole, recordAdminAction, requirePlatformAdmin } from "@ayon/core";
import type { OrganizationMemberRole, UserProfileStatus } from "@ayon/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  data?: { recoveryLink?: string };
}

async function requireActor() {
  const sessionDb = await createClient();
  const {
    data: { user },
  } = await sessionDb.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const serviceRoleDb = createServiceRoleClient();
  await requirePlatformAdmin(serviceRoleDb, user.id);
  const role = await getPlatformAdminRole(serviceRoleDb, user.id);
  if (!role) throw new Error("Acesso restrito à administração da plataforma.");

  const headerList = await headers();
  return {
    serviceRoleDb,
    userId: user.id,
    role,
    ipAddress: headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip"),
    userAgent: headerList.get("user-agent"),
  };
}

function toErrorResult(error: unknown): AdminActionResult {
  return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado." };
}

export async function updateMemberRoleAction(
  membershipId: string,
  role: OrganizationMemberRole,
): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const organizationRepository = new OrganizationRepository(actor.serviceRoleDb);
    const after = await organizationRepository.updateMemberRole(membershipId, role);

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId: after.organization_id,
      action: "user.update_role",
      entityType: "organization_member",
      entityId: membershipId,
      after: { role },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function removeMemberAction(membershipId: string, organizationId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const organizationRepository = new OrganizationRepository(actor.serviceRoleDb);
    await organizationRepository.removeMember(membershipId);

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "user.remove",
      entityType: "organization_member",
      entityId: membershipId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function setUserStatusAction(
  userId: string,
  organizationId: string,
  status: UserProfileStatus,
): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const userRepository = new UserRepository(actor.serviceRoleDb);
    const before = await userRepository.findByUserId(userId);
    const after = await userRepository.update(userId, { status });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: status === "blocked" ? "user.block" : "user.unblock",
      entityType: "user_profile",
      entityId: userId,
      before: { status: before?.status ?? null },
      after: { status: after.status },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

/**
 * Reset de senha via Admin API (`auth.admin.generateLink`) — gera um link
 * de recuperação real sem disparar e-mail automaticamente (a API só gera o
 * link; enviá-lo é responsabilidade de quem chama), então é seguro exercer
 * de verdade em validação sem impactar a caixa de entrada do usuário.
 */
export async function resetUserPasswordAction(userId: string, organizationId: string, email: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();

    const { data, error } = await actor.serviceRoleDb.auth.admin.generateLink({ type: "recovery", email });
    if (error) return { ok: false, error: error.message };

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "user.reset_password",
      entityType: "user_profile",
      entityId: userId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { ok: true, data: { recoveryLink: data.properties.action_link } };
  } catch (error) {
    return toErrorResult(error);
  }
}
