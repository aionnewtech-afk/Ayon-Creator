import "server-only";
import { OrganizationRepository, UserRepository, ensureInitialProvisioning } from "@ayon/core";
import { createClient } from "./supabase/server";

export async function getCurrentSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const organizationRepository = new OrganizationRepository(supabase);
  const userRepository = new UserRepository(supabase);

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

  return { user, profile, membership: memberships[0] ?? null, organization };
}
