"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { UserFeedbackRepository, getPlatformAdminRole, recordAdminAction, requirePlatformAdmin } from "@ayon/core";
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

export async function archiveFeedbackAction(feedbackId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const repository = new UserFeedbackRepository(actor.serviceRoleDb);
    await repository.update(feedbackId, { archived_at: new Date().toISOString() });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "feedback.archive",
      entityType: "user_feedback",
      entityId: feedbackId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/feedbacks");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function respondFeedbackAction(feedbackId: string, internalResponse: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const repository = new UserFeedbackRepository(actor.serviceRoleDb);
    await repository.update(feedbackId, { internal_response: internalResponse });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "feedback.respond_internally",
      entityType: "user_feedback",
      entityId: feedbackId,
      after: { internal_response: internalResponse },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/feedbacks");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function resolveFeedbackAction(feedbackId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const repository = new UserFeedbackRepository(actor.serviceRoleDb);
    await repository.update(feedbackId, { status: "resolved" });

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "feedback.resolve",
      entityType: "user_feedback",
      entityId: feedbackId,
      after: { status: "resolved" },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/feedbacks");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function deleteFeedbackAction(feedbackId: string): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const repository = new UserFeedbackRepository(actor.serviceRoleDb);
    await repository.softDelete(feedbackId);

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "feedback.delete",
      entityType: "user_feedback",
      entityId: feedbackId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/feedbacks");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}
