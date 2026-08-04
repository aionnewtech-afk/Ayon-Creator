import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { slugify } from "../slug";
import { logger } from "../logger";

export interface ProvisioningUser {
  id: string;
  email: string | null;
  organizationName?: string | null;
}

export interface ProvisioningResult {
  alreadyProvisioned: boolean;
  organizationId: string;
}

/**
 * Provisionamento Inicial (architecture.md §2.2) — cria organization/brand/
 * organization_member/user_profile/audit_log na primeira vez que um usuário
 * autenticado é visto sem organização. Idempotente: seguro de chamar a cada
 * requisição (a checagem inicial é sempre a fonte da verdade).
 *
 * ★ Hardening (Missão H1, docs/hardening-plan.md item 1.1): as 5 escritas
 * antes feitas aqui via chamadas separadas do PostgREST (sem transação —
 * checagem "check-then-act" vulnerável a race condition, já reproduzida ao
 * vivo na validação da Missão 4) foram consolidadas na função Postgres
 * `ensure_initial_provisioning` (migration `0014`), atômica e serializada
 * por `pg_advisory_xact_lock` por usuário. Esta função só monta os
 * parâmetros e chama a RPC — nenhuma lógica de negócio migrou para cá.
 */
export async function ensureInitialProvisioning(
  db: SupabaseClient<Database>,
  user: ProvisioningUser,
): Promise<ProvisioningResult> {
  const organizationName =
    user.organizationName?.trim() || user.email?.split("@")[0] || "Minha Organização";
  const baseSlug = slugify(organizationName) || "organizacao";

  const { data, error } = await db
    .rpc("ensure_initial_provisioning", {
      p_user_id: user.id,
      p_organization_name: organizationName,
      p_base_slug: baseSlug,
    })
    .single();

  if (error) throw error;

  logger.info("provisioning.completed", {
    userId: user.id,
    organizationId: data.organization_id,
    alreadyProvisioned: data.already_provisioned,
  });

  return { alreadyProvisioned: data.already_provisioned, organizationId: data.organization_id };
}
