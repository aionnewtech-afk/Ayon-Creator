"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "./supabase/server";
import { createServiceRoleClient } from "./supabase/service-role";
import { getPlatformAdminRole, recordAdminAction } from "@ayon/core";
import { IMPERSONATION_COOKIE_NAME } from "./impersonation";

export interface ImpersonationActionResult {
  ok: boolean;
  error?: string;
}

/**
 * "Entrar como organização" (Fluxo 16) — revalida `is_platform_admin()` no
 * servidor antes de setar o cookie, nunca confia em estado de UI. Disponível
 * aos 2 papéis administrativos (architecture.md §15.1.1).
 */
export async function startImpersonationAction(organizationId: string): Promise<ImpersonationActionResult> {
  const sessionDb = await createClient();
  const {
    data: { user },
  } = await sessionDb.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const serviceRoleDb = createServiceRoleClient();
  const role = await getPlatformAdminRole(serviceRoleDb, user.id);
  if (!role) return { ok: false, error: "Acesso restrito à administração da plataforma." };

  const { data: organization } = await serviceRoleDb
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!organization) return { ok: false, error: "Organização não encontrada." };

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE_NAME, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  const headerList = await headers();
  await recordAdminAction({
    serviceRoleDb,
    actorUserId: user.id,
    actorRole: role,
    organizationId,
    action: "impersonation.started",
    entityType: "organization",
    entityId: organizationId,
    after: { organization_name: organization.name },
    ipAddress: headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip"),
    userAgent: headerList.get("user-agent"),
  });

  return { ok: true };
}

/** "Sair da impersonação" (Fluxo 16) — sempre seguro, sem confirmação (nunca perde dado). */
export async function stopImpersonationAction(): Promise<ImpersonationActionResult> {
  const cookieStore = await cookies();
  const organizationId = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  cookieStore.delete(IMPERSONATION_COOKIE_NAME);

  if (organizationId) {
    const sessionDb = await createClient();
    const {
      data: { user },
    } = await sessionDb.auth.getUser();
    if (user) {
      const serviceRoleDb = createServiceRoleClient();
      const role = await getPlatformAdminRole(serviceRoleDb, user.id);
      if (role) {
        await recordAdminAction({
          serviceRoleDb,
          actorUserId: user.id,
          actorRole: role,
          organizationId,
          action: "impersonation.stopped",
          entityType: "organization",
          entityId: organizationId,
        });
      }
    }
  }

  return { ok: true };
}
