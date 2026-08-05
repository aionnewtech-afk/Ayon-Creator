"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CreditLedgerRepository, getPlatformAdminRole, recordAdminAction, requirePlatformAdmin } from "@ayon/core";
import type { Database } from "@ayon/types";
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

export async function adjustCreditsAction(organizationId: string, amount: number, description: string): Promise<AdminActionResult> {
  try {
    if (!Number.isInteger(amount) || amount === 0) {
      return { ok: false, error: "Informe uma quantidade de créditos válida (inteiro, diferente de zero)." };
    }

    const actor = await requireActor();
    const creditLedgerRepository = new CreditLedgerRepository(actor.serviceRoleDb);
    const entry = await creditLedgerRepository.create({
      organization_id: organizationId,
      type: "adjustment",
      amount,
      description,
      created_by: actor.userId,
    });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "credits.adjust",
      entityType: "credit_ledger",
      entityId: entry.id,
      after: { amount, description },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/creditos");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export interface CreditHistoryResult {
  ok: boolean;
  error?: string;
  entries?: Database["public"]["Tables"]["credit_ledger"]["Row"][];
}

export async function getCreditHistoryAction(organizationId: string): Promise<CreditHistoryResult> {
  try {
    const actor = await requireActor();
    const creditLedgerRepository = new CreditLedgerRepository(actor.serviceRoleDb);
    const entries = await creditLedgerRepository.findByOrganizationId(organizationId, 30);
    return { ok: true, entries };
  } catch (error) {
    return toErrorResult(error);
  }
}
