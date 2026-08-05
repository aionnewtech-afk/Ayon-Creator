"use server";

import { headers } from "next/headers";
import { UserFeedbackRepository, logger } from "@ayon/core";
import type { UserFeedbackCategory } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import packageJson from "../../package.json";

const FRIENDLY_ERROR = "Não consegui enviar seu feedback agora. Pode tentar de novo em instantes?";

export interface SendFeedbackActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Botão global "Enviar feedback" (arch. §13, Fluxo 14). `pathname` vem do
 * client (usePathname()); `app_version`/`user_agent` são sempre lidos no
 * servidor, nunca confiados ao client (arch. §13.1.1).
 */
export async function sendFeedbackAction(
  category: UserFeedbackCategory,
  description: string,
  pathname: string | null,
): Promise<SendFeedbackActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.user) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  const trimmedDescription = description.trim();
  if (!trimmedDescription) {
    return { ok: false, error: "Descreva seu feedback antes de enviar." };
  }

  try {
    const db = await createClient();
    const userFeedbackRepository = new UserFeedbackRepository(db);
    const requestHeaders = await headers();

    await userFeedbackRepository.create({
      organization_id: session.organization.id,
      user_id: session.user.id,
      category,
      description: trimmedDescription,
      pathname,
      app_version: `v${packageJson.version}`,
      user_agent: requestHeaders.get("user-agent"),
    });

    return { ok: true };
  } catch (error) {
    logger.error("user_feedback.send_failed", {
      organizationId: session.organization.id,
      reason: error instanceof Error ? error.message : JSON.stringify(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}
