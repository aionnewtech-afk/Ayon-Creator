export const ORGANIZATION_PLANS = ["starter", "pro", "business"] as const;
export type OrganizationPlan = (typeof ORGANIZATION_PLANS)[number];

export const PROVIDER_TIERS = ["economico", "balanceado", "premium"] as const;
export type ProviderTier = (typeof PROVIDER_TIERS)[number];

export const ORGANIZATION_MEMBER_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type OrganizationMemberRole = (typeof ORGANIZATION_MEMBER_ROLES)[number];

export const BRAND_STATUSES = ["active", "archived"] as const;
export type BrandStatus = (typeof BRAND_STATUSES)[number];
