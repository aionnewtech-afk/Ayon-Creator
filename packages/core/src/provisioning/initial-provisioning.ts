import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { OrganizationRepository } from "../repositories/organization.repository";
import { BrandRepository } from "../repositories/brand.repository";
import { UserRepository } from "../repositories/user.repository";
import { AuditRepository } from "../repositories/audit.repository";
import { slugify, withRandomSuffix } from "../slug";
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
 * Estruturado para reuso: novos recursos de inicialização de conta entram
 * como passos adicionais dentro do mesmo bloco "se ainda não provisionado",
 * sem mudar quem aciona esta função.
 */
export async function ensureInitialProvisioning(
  db: SupabaseClient<Database>,
  user: ProvisioningUser,
): Promise<ProvisioningResult> {
  const organizationRepository = new OrganizationRepository(db);
  const brandRepository = new BrandRepository(db);
  const userRepository = new UserRepository(db);
  const auditRepository = new AuditRepository(db);

  const existingMemberships = await organizationRepository.findMembershipsByUserId(user.id);
  const existingMembership = existingMemberships[0];
  if (existingMembership) {
    return { alreadyProvisioned: true, organizationId: existingMembership.organization_id };
  }

  const organizationName =
    user.organizationName?.trim() || user.email?.split("@")[0] || "Minha Organização";
  const baseSlug = slugify(organizationName) || "organizacao";

  let organization;
  try {
    organization = await organizationRepository.create({
      name: organizationName,
      slug: baseSlug,
      created_by: user.id,
    });
  } catch {
    organization = await organizationRepository.create({
      name: organizationName,
      slug: withRandomSuffix(baseSlug),
      created_by: user.id,
    });
  }

  await organizationRepository.addMember({
    organization_id: organization.id,
    user_id: user.id,
    role: "owner",
    created_by: user.id,
  });

  await brandRepository.create({
    organization_id: organization.id,
    name: organizationName,
    created_by: user.id,
  });

  const existingProfile = await userRepository.findByUserId(user.id);
  if (!existingProfile) {
    await userRepository.createProfile({ user_id: user.id });
  }

  await auditRepository.record({
    organization_id: organization.id,
    actor_user_id: user.id,
    action: "organization.provisioned",
    entity_type: "organization",
    entity_id: organization.id,
  });

  logger.info("provisioning.completed", { userId: user.id, organizationId: organization.id });

  return { alreadyProvisioned: false, organizationId: organization.id };
}
