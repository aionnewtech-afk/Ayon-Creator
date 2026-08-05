"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { PlanRepository, getPlatformAdminRole, recordAdminAction, requireSuperAdmin } from "@ayon/core";
import type { Database, SubscriptionPlan } from "@ayon/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

type PlanUpdate = Database["public"]["Tables"]["plans"]["Update"];

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

/** Edição de plano — só `super_admin` (architecture.md §15.1.1). Nunca migração destrutiva, só UPDATE. */
export async function updatePlanAction(plan: SubscriptionPlan, patch: PlanUpdate): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const planRepository = new PlanRepository(actor.serviceRoleDb);
    const before = await planRepository.findByPlan(plan);
    const after = await planRepository.update(plan, patch);

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "plan.update",
      entityType: "plan",
      entityId: plan,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/planos");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}
