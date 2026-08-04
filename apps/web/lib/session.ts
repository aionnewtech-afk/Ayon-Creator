import "server-only";
import { BrandRepository, OrganizationRepository, UserRepository, ensureInitialProvisioning } from "@ayon/core";
import { createClient } from "./supabase/server";

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
  };
}
