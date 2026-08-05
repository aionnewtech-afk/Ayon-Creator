"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { SubscriptionRepository, getPlatformAdminRole, recordAdminAction, requirePlatformAdmin, requireSuperAdmin } from "@ayon/core";
import { cancelMercadoPagoPreapproval } from "@ayon/core/src/billing/mercado-pago-client";
import { handleMercadoPagoWebhook } from "@ayon/core/src/billing/mercado-pago-webhook-handler";
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

/** Sincronizar/reenviar webhook — mesmo handler já existente, nunca duplica lógica (architecture.md §15.8). */
export async function syncMercadoPagoSubscriptionAction(organizationId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const subscriptionRepository = new SubscriptionRepository(actor.serviceRoleDb);
    const subscription = await subscriptionRepository.findByOrganizationId(organizationId);
    if (!subscription?.billing_provider_ref) {
      return { ok: false, error: "Esta organização não tem assinatura vinculada ao Mercado Pago." };
    }

    await handleMercadoPagoWebhook({
      serviceRoleDb: actor.serviceRoleDb,
      type: "subscription_preapproval",
      dataId: subscription.billing_provider_ref,
    });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "mercado_pago.sync",
      entityType: "subscription",
      entityId: subscription.id,
      after: { billing_provider_ref: subscription.billing_provider_ref },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/mercado-pago");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

/** Cancelar assinatura — só `super_admin` (architecture.md §15.1.1). Cancela no Mercado Pago quando há vínculo real. */
export async function cancelMercadoPagoSubscriptionAction(organizationId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    await requireSuperAdmin(actor.serviceRoleDb, actor.userId);

    const subscriptionRepository = new SubscriptionRepository(actor.serviceRoleDb);
    const before = await subscriptionRepository.findByOrganizationId(organizationId);
    if (!before) return { ok: false, error: "Organização não tem assinatura." };

    if (before.billing_provider_ref) {
      await cancelMercadoPagoPreapproval(before.billing_provider_ref);
    }

    const after = await subscriptionRepository.update(before.id, { status: "canceled" });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "mercado_pago.cancel_subscription",
      entityType: "subscription",
      entityId: after.id,
      before: { status: before.status },
      after: { status: after.status },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/mercado-pago");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}
