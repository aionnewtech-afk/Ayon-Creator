import type { OrganizationMemberRole } from "@ayon/types";

const ROLE_RANK: Record<OrganizationMemberRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function hasMinimumRole(role: OrganizationMemberRole, minimum: OrganizationMemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
