"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ProviderConfigRepository, getPlatformAdminRole, recordAdminAction, requireSuperAdmin } from "@ayon/core";
import type { ProviderConfigStatus } from "@ayon/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

async function requireActor() {
  const sessionDb = await createClient();
  const {
    data: { user },
  } = await sessionDb.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const serviceRoleDb = createServiceRoleClient();
  await requireSuperAdmin(serviceRoleDb, user.id);
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

export interface UpdateProviderConfigInput {
  status: ProviderConfigStatus;
  priority: number;
  credentialValue?: string;
}

/**
 * Edita uma config de provider — status (ativar/desativar/manutenção),
 * prioridade (efetivamente "trocar provider padrão" da capability+tier,
 * §15.11) e credencial (nunca exibida em texto claro de volta à UI, só
 * substituída — §15.11). Só `super_admin`.
 */
export async function updateProviderConfigAction(configId: string, input: UpdateProviderConfigInput): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const repository = new ProviderConfigRepository(actor.serviceRoleDb);
    const before = await repository.findAll().then((rows) => rows.find((row) => row.id === configId) ?? null);
    if (!before) return { ok: false, error: "Configuração não encontrada." };

    const after = await repository.update(configId, {
      status: input.status,
      priority: input.priority,
      ...(input.credentialValue ? { credential_value: input.credentialValue } : {}),
    });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "provider_config.update",
      entityType: "provider_config",
      entityId: configId,
      before: { status: before.status, priority: before.priority },
      after: { status: after.status, priority: after.priority, credential_changed: Boolean(input.credentialValue) },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/providers");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}
