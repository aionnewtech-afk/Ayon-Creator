import "server-only";
import type { Database } from "@ayon/types";
import { BrandRepository, OrganizationRepository, UserRepository, ensureInitialProvisioning, getPlatformAdminRole } from "@ayon/core";
import { createClient } from "./supabase/server";
import { createServiceRoleClient } from "./supabase/service-role";
import { getImpersonatingOrganizationId } from "./impersonation";

type OrganizationMemberRow = Database["public"]["Tables"]["organization_members"]["Row"];

/**
 * Membership sintética usada só durante impersonação (architecture.md
 * §15.4) — o admin não é de fato membro da organização visitada, mas todo
 * `hasMinimumRole(session.membership.role, ...)` do produto precisa de um
 * valor para não bloquear a navegação. `role: "owner"` (o mais alto já
 * existente) — nenhum código do produto lê `.id`/`.created_at` desta
 * membership, só `.role` (achado de auditoria antes de implementar).
 */
function syntheticOwnerMembership(organizationId: string, userId: string): OrganizationMemberRow {
  const now = new Date().toISOString();
  return {
    id: "impersonated",
    organization_id: organizationId,
    user_id: userId,
    role: "owner",
    created_by: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

export async function getCurrentSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const organizationRepository = new OrganizationRepository(supabase);
  const userRepository = new UserRepository(supabase);
  const brandRepository = new BrandRepository(supabase);

  // ★ Missão 12 — impersonação: revalida is_platform_admin no servidor a
  // cada leitura de sessão, nunca confia no cookie sozinho. `platform_admins`
  // não tem policy de RLS para `authenticated` (mesmo padrão de
  // provider_configs/specialists — leitura só via service role), então esta
  // consulta específica precisa do client de service role, mesmo sendo a
  // própria linha do admin.
  const platformAdminRole = await getPlatformAdminRole(createServiceRoleClient(), user.id);
  const impersonatingOrganizationId = platformAdminRole ? await getImpersonatingOrganizationId() : null;

  if (impersonatingOrganizationId) {
    const organization = await organizationRepository.findById(impersonatingOrganizationId);
    const [profile, brands] = await Promise.all([
      userRepository.findByUserId(user.id),
      organization ? brandRepository.findByOrganizationId(organization.id) : Promise.resolve([]),
    ]);

    return {
      user,
      profile,
      membership: organization ? syntheticOwnerMembership(organization.id, user.id) : null,
      organization,
      brand: brands[0] ?? null,
      platformAdminRole,
      isImpersonating: Boolean(organization),
    };
  }

  let memberships = await organizationRepository.findMembershipsByUserId(user.id);

  if (memberships.length === 0) {
    await ensureInitialProvisioning(supabase, {
      id: user.id,
      email: user.email ?? null,
      organizationName: (user.user_metadata?.organization_name as string | undefined) ?? null,
    });
    memberships = await organizationRepository.findMembershipsByUserId(user.id);
  }

  const [profile, organization] = await Promise.all([
    userRepository.findByUserId(user.id),
    memberships[0] ? organizationRepository.findById(memberships[0].organization_id) : null,
  ]);

  // Single-brand-por-organização nesta fase (multi-marca é plano Business,
  // fora do escopo da Missão 2) — sempre a primeira/única brand da org.
  const brands = organization ? await brandRepository.findByOrganizationId(organization.id) : [];

  return {
    user,
    profile,
    membership: memberships[0] ?? null,
    organization,
    brand: brands[0] ?? null,
    platformAdminRole,
    isImpersonating: false,
  };
}
