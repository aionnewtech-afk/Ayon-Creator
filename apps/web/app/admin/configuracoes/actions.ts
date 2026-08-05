"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CreditPricingRepository, FeatureFlagRepository, getPlatformAdminRole, recordAdminAction, requireSuperAdmin } from "@ayon/core";
import type { CreditPricingStatus } from "@ayon/types";
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

export async function updateCreditPricingAction(id: string, credits: number, status: CreditPricingStatus): Promise<AdminActionResult> {
  try {
    if (!Number.isInteger(credits) || credits < 0) return { ok: false, error: "Informe uma quantidade de créditos válida." };

    const actor = await requireActor();
    const repository = new CreditPricingRepository(actor.serviceRoleDb);
    const before = await repository.findAll().then((rows) => rows.find((row) => row.id === id) ?? null);
    if (!before) return { ok: false, error: "Preço não encontrado." };

    const after = await repository.update(id, { credits, status });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "credit_pricing.update",
      entityType: "credit_pricing",
      entityId: id,
      before: { credits: before.credits, status: before.status },
      after: { credits: after.credits, status: after.status },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/configuracoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function toggleFeatureFlagAction(id: string, enabled: boolean): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const repository = new FeatureFlagRepository(actor.serviceRoleDb);
    const before = await repository.findAll().then((rows) => rows.find((row) => row.id === id) ?? null);
    if (!before) return { ok: false, error: "Flag não encontrada." };

    const after = await repository.update(id, { enabled });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "feature_flag.toggle",
      entityType: "feature_flag",
      entityId: id,
      before: { enabled: before.enabled },
      after: { enabled: after.enabled },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/configuracoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}
