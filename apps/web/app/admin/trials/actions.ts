"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { SubscriptionRepository, getPlatformAdminRole, recordAdminAction, requirePlatformAdmin } from "@ayon/core";
import type { SubscriptionPlan } from "@ayon/types";
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

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function createTrialAction(organizationId: string, plan: SubscriptionPlan, days: number): Promise<AdminActionResult> {
  try {
    if (!Number.isInteger(days) || days <= 0) return { ok: false, error: "Informe um número de dias válido." };

    const actor = await requireActor();
    const subscriptionRepository = new SubscriptionRepository(actor.serviceRoleDb);
    const existing = await subscriptionRepository.findByOrganizationId(organizationId);
    if (existing) return { ok: false, error: "Esta organização já tem uma assinatura." };

    const after = await subscriptionRepository.upsertByOrganizationId(organizationId, {
      plan,
      status: "trialing",
      trial_ends_at: addDaysIso(days),
    });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "trial.create",
      entityType: "subscription",
      entityId: after.id,
      after: { plan: after.plan, trial_ends_at: after.trial_ends_at },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/trials");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function renewTrialAction(organizationId: string, days: number): Promise<AdminActionResult> {
  try {
    if (!Number.isInteger(days) || days <= 0) return { ok: false, error: "Informe um número de dias válido." };

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
      action: "trial.renew",
      entityType: "subscription",
      entityId: after.id,
      before: { trial_ends_at: before.trial_ends_at },
      after: { trial_ends_at: after.trial_ends_at },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/trials");
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
      action: "trial.cancel",
      entityType: "subscription",
      entityId: after.id,
      before: { status: before.status },
      after: { status: after.status },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/trials");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function convertTrialToActiveAction(organizationId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const subscriptionRepository = new SubscriptionRepository(actor.serviceRoleDb);
    const before = await subscriptionRepository.findByOrganizationId(organizationId);
    if (!before) return { ok: false, error: "Organização não tem assinatura." };

    const after = await subscriptionRepository.update(before.id, { status: "active" });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "trial.convert",
      entityType: "subscription",
      entityId: after.id,
      before: { status: before.status },
      after: { status: after.status },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/trials");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}
