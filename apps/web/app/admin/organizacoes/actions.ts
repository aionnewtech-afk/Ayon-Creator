"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  CreditLedgerRepository,
  OrganizationRepository,
  SubscriptionRepository,
  getPlatformAdminRole,
  isSuperAdmin,
  recordAdminAction,
  requirePlatformAdmin,
} from "@ayon/core";
import type { OrganizationStatus, SubscriptionPlan } from "@ayon/types";
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
    sessionDb,
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

export async function updateOrganizationAction(
  organizationId: string,
  patch: { name?: string; status?: OrganizationStatus },
): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const organizationRepository = new OrganizationRepository(actor.sessionDb);
    const before = await organizationRepository.findById(organizationId);
    if (!before) return { ok: false, error: "Organização não encontrada." };

    const after = await organizationRepository.update(organizationId, patch);

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "organization.update",
      entityType: "organization",
      entityId: organizationId,
      before: { name: before.name, status: before.status },
      after: { name: after.name, status: after.status },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/organizacoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function changeOrganizationPlanAction(
  organizationId: string,
  plan: SubscriptionPlan,
): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const subscriptionRepository = new SubscriptionRepository(actor.serviceRoleDb);
    const before = await subscriptionRepository.findByOrganizationId(organizationId);

    const after = await subscriptionRepository.upsertByOrganizationId(organizationId, {
      plan,
      status: before?.status ?? "active",
      trial_ends_at: before?.trial_ends_at ?? null,
      current_period_start: before?.current_period_start ?? null,
      current_period_end: before?.current_period_end ?? null,
      billing_provider_ref: before?.billing_provider_ref ?? null,
    });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "organization.change_plan",
      entityType: "subscription",
      entityId: after.id,
      before: { plan: before?.plan ?? null },
      after: { plan: after.plan },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/organizacoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function adjustOrganizationCreditsAction(
  organizationId: string,
  amount: number,
  description: string,
): Promise<AdminActionResult> {
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
      action: "organization.adjust_credits",
      entityType: "credit_ledger",
      entityId: entry.id,
      after: { amount, description },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/organizacoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function renewTrialAction(organizationId: string, days: number): Promise<AdminActionResult> {
  try {
    if (!Number.isInteger(days) || days <= 0) {
      return { ok: false, error: "Informe um número de dias válido (inteiro, maior que zero)." };
    }

    const actor = await requireActor();
    const subscriptionRepository = new SubscriptionRepository(actor.serviceRoleDb);
    const before = await subscriptionRepository.findByOrganizationId(organizationId);
    if (!before) return { ok: false, error: "Organização não tem assinatura." };

    const base = before.trial_ends_at && new Date(before.trial_ends_at) > new Date() ? new Date(before.trial_ends_at) : new Date();
    const trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    const after = await subscriptionRepository.update(before.id, { status: "trialing", trial_ends_at: trialEndsAt });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "organization.renew_trial",
      entityType: "subscription",
      entityId: after.id,
      before: { trial_ends_at: before.trial_ends_at, status: before.status },
      after: { trial_ends_at: after.trial_ends_at, status: after.status },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/organizacoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function cancelTrialAction(organizationId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const subscriptionRepository = new SubscriptionRepository(actor.serviceRoleDb);
    const before = await subscriptionRepository.findByOrganizationId(organizationId);
    if (!before) return { ok: false, error: "Organização não tem assinatura." };
    if (before.status !== "trialing") return { ok: false, error: "Esta organização não está em trial." };

    const after = await subscriptionRepository.update(before.id, { status: "canceled" });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "organization.cancel_trial",
      entityType: "subscription",
      entityId: after.id,
      before: { status: before.status },
      after: { status: after.status },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/organizacoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

/** Exclusão (soft delete) — só `super_admin` (architecture.md §15.1.1). */
export async function deleteOrganizationAction(organizationId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    if (!(await isSuperAdmin(actor.serviceRoleDb, actor.userId))) {
      return { ok: false, error: "Ação restrita a Super Admin." };
    }

    const organizationRepository = new OrganizationRepository(actor.sessionDb);
    const before = await organizationRepository.findById(organizationId);
    if (!before) return { ok: false, error: "Organização não encontrada." };

    await organizationRepository.update(organizationId, { deleted_at: new Date().toISOString() });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "organization.delete",
      entityType: "organization",
      entityId: organizationId,
      before: { name: before.name },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/organizacoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}
