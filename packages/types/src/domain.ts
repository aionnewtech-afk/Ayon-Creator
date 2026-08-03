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

export const PROVIDER_CONFIG_STATUSES = ["active", "inactive", "error"] as const;
export type ProviderConfigStatus = (typeof PROVIDER_CONFIG_STATUSES)[number];

/**
 * Especialistas do Intelligence Hub NÃO são um enum fixo (architecture.md
 * §4.1, Specialist Registry) — são linhas na tabela `specialists`, resolvidas
 * em runtime. `SpecialistRole` distingue só o papel estrutural (um
 * especialista opina; o coordinator consolida), nunca a identidade em si.
 */
export const SPECIALIST_ROLES = ["specialist", "coordinator"] as const;
export type SpecialistRole = (typeof SPECIALIST_ROLES)[number];

export const SPECIALIST_STATUSES = ["active", "inactive"] as const;
export type SpecialistStatus = (typeof SPECIALIST_STATUSES)[number];

export const INTELLIGENCE_HUB_RELATED_ENTITY_TYPES = ["trend_research", "campaign", "content_piece"] as const;
export type IntelligenceHubRelatedEntityType = (typeof INTELLIGENCE_HUB_RELATED_ENTITY_TYPES)[number];

export const INTELLIGENCE_HUB_SESSION_STATUSES = ["running", "completed", "failed"] as const;
export type IntelligenceHubSessionStatus = (typeof INTELLIGENCE_HUB_SESSION_STATUSES)[number];

export const CAMPAIGN_STATUSES = [
  "draft",
  "generating",
  "ready_for_review",
  "approved",
  "package_ready",
  "failed",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
