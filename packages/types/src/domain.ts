export const ORGANIZATION_PLANS = ["starter", "pro", "business"] as const;
export type OrganizationPlan = (typeof ORGANIZATION_PLANS)[number];

export const PROVIDER_TIERS = ["economico", "balanceado", "premium"] as const;
export type ProviderTier = (typeof PROVIDER_TIERS)[number];

export const ORGANIZATION_MEMBER_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type OrganizationMemberRole = (typeof ORGANIZATION_MEMBER_ROLES)[number];

export const BRAND_STATUSES = ["active", "archived"] as const;
export type BrandStatus = (typeof BRAND_STATUSES)[number];

export const ONBOARDING_QUESTION_KEYS = [
  "company_history",
  "products",
  "customers",
  "tone_of_voice",
  "competitors",
  "objectives",
  "differentiators",
  "forbidden_words",
  "favorite_words",
] as const;
export type OnboardingQuestionKey = (typeof ONBOARDING_QUESTION_KEYS)[number];

export const KNOWLEDGE_BASE_SOURCE_TYPES = [
  "document",
  "past_content",
  "faq",
  "performance_note",
  "manual_note",
  "onboarding_conversation",
] as const;
export type KnowledgeBaseSourceType = (typeof KNOWLEDGE_BASE_SOURCE_TYPES)[number];

export const PROVIDER_CAPABILITIES = ["llm", "avatar", "voice", "media", "trend_source"] as const;
export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export const SPECIALIST_TYPES = [
  "marketing",
  "copywriting",
  "branding",
  "niche",
  "seo",
  "social_media",
  "data",
  "coordinator",
] as const;
export type SpecialistType = (typeof SPECIALIST_TYPES)[number];

export const PROVIDER_CONFIG_STATUSES = ["active", "inactive", "error"] as const;
export type ProviderConfigStatus = (typeof PROVIDER_CONFIG_STATUSES)[number];
