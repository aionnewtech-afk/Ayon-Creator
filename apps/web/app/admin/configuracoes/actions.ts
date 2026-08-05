"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CreditPricingRepository, FeatureFlagRepository, PlatformAdminRepository, getPlatformAdminRole, recordAdminAction, requireSuperAdmin } from "@ayon/core";
import type { CreditPricingStatus, PlatformAdminRole } from "@ayon/types";
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

/**
 * Criar novo admin — ação exclusiva de `super_admin` (architecture.md
 * §15.1/§15.1.1). Resolve o e-mail para um `user_id` real via Admin API
 * (nunca cria conta nova — o usuário precisa já existir na plataforma).
 */
export async function createPlatformAdminAction(email: string, role: PlatformAdminRole): Promise<AdminActionResult> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return { ok: false, error: "Informe um e-mail." };

    const actor = await requireActor();

    const { data: authList, error: authError } = await actor.serviceRoleDb.auth.admin.listUsers({ perPage: 1000 });
    if (authError) return { ok: false, error: authError.message };

    const matchedUser = authList.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (!matchedUser) return { ok: false, error: "Nenhum usuário com este e-mail encontrado na plataforma." };

    const platformAdminRepository = new PlatformAdminRepository(actor.serviceRoleDb);
    const existing = await platformAdminRepository.findAll();
    if (existing.some((admin) => admin.user_id === matchedUser.id)) {
      return { ok: false, error: "Este usuário já é um administrador da plataforma." };
    }

    const created = await platformAdminRepository.create({ user_id: matchedUser.id, role, granted_by: actor.userId });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "platform_admin.create",
      entityType: "platform_admin",
      entityId: created.id,
      after: { email: normalizedEmail, role },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/configuracoes");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

/** Revogar admin — ação exclusiva de `super_admin`. Nunca permite auto-revogação (evita se trancar fora do painel). */
export async function revokePlatformAdminAction(id: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const platformAdminRepository = new PlatformAdminRepository(actor.serviceRoleDb);
    const target = await platformAdminRepository.findAll().then((rows) => rows.find((row) => row.id === id) ?? null);
    if (!target) return { ok: false, error: "Administrador não encontrado." };
    if (target.user_id === actor.userId) return { ok: false, error: "Você não pode revogar seu próprio acesso." };

    await platformAdminRepository.revoke(id);

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "platform_admin.revoke",
      entityType: "platform_admin",
      entityId: id,
      before: { role: target.role, user_id: target.user_id },
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
