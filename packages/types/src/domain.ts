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

export const PROVIDER_CAPABILITIES = ["llm", "avatar", "voice", "media", "trend_source", "video_render"] as const;
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

/** `brand` ★ novo (Missão 8) — `learning_analysis` não tem campanha/peça/pesquisa de tendência específica como assunto, é uma análise agregada em nível de marca (extensão aditiva, database.md §4.4). */
export const INTELLIGENCE_HUB_RELATED_ENTITY_TYPES = ["trend_research", "campaign", "content_piece", "brand"] as const;
export type IntelligenceHubRelatedEntityType = (typeof INTELLIGENCE_HUB_RELATED_ENTITY_TYPES)[number];

export const INTELLIGENCE_HUB_SESSION_STATUSES = ["running", "completed", "failed"] as const;
export type IntelligenceHubSessionStatus = (typeof INTELLIGENCE_HUB_SESSION_STATUSES)[number];

export const TREND_RESEARCH_STATUSES = ["pending", "completed", "failed"] as const;
export type TrendResearchStatus = (typeof TREND_RESEARCH_STATUSES)[number];

export const CAMPAIGN_STATUSES = [
  "draft",
  "generating",
  "ready_for_review",
  "approved",
  "package_ready",
  "failed",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SUBSCRIPTION_PLANS = ["starter", "pro", "business"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = ["active", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const CREDIT_LEDGER_ENTRY_TYPES = ["grant_plan", "purchase", "consumption", "adjustment"] as const;
export type CreditLedgerEntryType = (typeof CREDIT_LEDGER_ENTRY_TYPES)[number];

export const CREDIT_PRICING_STATUSES = ["active", "inactive"] as const;
export type CreditPricingStatus = (typeof CREDIT_PRICING_STATUSES)[number];

export const CREDIT_PACKAGE_STATUSES = ["active", "inactive"] as const;
export type CreditPackageStatus = (typeof CREDIT_PACKAGE_STATUSES)[number];

export const PLAN_STATUSES = ["active", "inactive"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const CONTENT_PIECE_FORMATS = [
  "video",
  "caption",
  "stories",
  "carousel",
  "thumbnail",
  "blog_post",
  "email",
  "script",
  "teleprompter",
] as const;
export type ContentPieceFormat = (typeof CONTENT_PIECE_FORMATS)[number];

/** Formatos gerados por IA (LLM Provider) no MVP da Missão 7 — os demais exigem upload manual (`own_media`). */
export const TEXT_ONLY_CONTENT_PIECE_FORMATS = ["caption", "blog_post", "email", "script", "teleprompter"] as const;

/** `licensed_stock_photo` ★ novo (Missão 11) — stories/carousel/thumbnail gerados automaticamente via banco de fotos licenciadas + composição (arch. §14.4); upload manual (`own_media`) continua disponível como alternativa por peça. */
export const PRODUCTION_MODES = ["ai_avatar", "licensed_stock_video", "licensed_stock_photo", "own_media", "hybrid", "text_only"] as const;
export type ProductionMode = (typeof PRODUCTION_MODES)[number];

export const CONTENT_PIECE_STATUSES = [
  "draft",
  "generating",
  "ready_for_review",
  "approved",
  "rejected",
  "failed",
] as const;
export type ContentPieceStatus = (typeof CONTENT_PIECE_STATUSES)[number];

export const CONTENT_PACKAGE_STATUSES = ["building", "ready", "failed"] as const;
export type ContentPackageStatus = (typeof CONTENT_PACKAGE_STATUSES)[number];

/** MVP da Missão 8 só emite `approved`/`rejected`/`edited` — `engagement_metric` reservado no schema para uma missão futura (database.md §4.7). */
export const LEARNING_SIGNAL_TYPES = ["approved", "rejected", "edited", "engagement_metric"] as const;
export type LearningSignalType = (typeof LEARNING_SIGNAL_TYPES)[number];

/** MVP da Missão 8 só emite os tipos acima — `engagement_metric` fica fora até existir um mecanismo de captura (flows.md, Fluxo 5, passo 4). */
export const LEARNING_SIGNAL_TYPES_EMITTED_IN_MVP = ["approved", "rejected", "edited"] as const;

/** Rótulo descritivo de qual comportamento futuro o insight pretende influenciar — não é um destino de escrita separado; todo insight aceito grava em `brand_brain_profiles.learned_preferences` (database.md §4.7). */
export const LEARNING_INSIGHT_APPLIED_TO = ["brand_brain", "trend_engine", "intelligence_hub", "asset_engine"] as const;
export type LearningInsightAppliedTo = (typeof LEARNING_INSIGHT_APPLIED_TO)[number];

export const LEARNING_INSIGHT_STATUSES = ["pending_review", "applied", "dismissed"] as const;
export type LearningInsightStatus = (typeof LEARNING_INSIGHT_STATUSES)[number];

/**
 * ★ novo (Missão 9) — `pipeline_runs` estava documentada desde revisões
 * antigas de database.md, mas nenhuma migration a criou até agora (nenhuma
 * missão anterior precisou de execução assíncrona via n8n de fato). Primeira
 * escrita real: pipeline de geração de vídeo (Fluxo 13).
 */
export const PIPELINE_RUN_ENTITY_TYPES = ["trend_research", "campaign", "content_piece", "intelligence_hub_session"] as const;
export type PipelineRunEntityType = (typeof PIPELINE_RUN_ENTITY_TYPES)[number];

export const PIPELINE_RUN_ENGINES = ["trend_engine", "intelligence_hub", "asset_engine", "brand_brain", "learning_engine"] as const;
export type PipelineRunEngine = (typeof PIPELINE_RUN_ENGINES)[number];

export const PIPELINE_RUN_STATUSES = ["queued", "running", "completed", "failed"] as const;
export type PipelineRunStatus = (typeof PIPELINE_RUN_STATUSES)[number];

/** ★ novo (Missão 10) — categorias do botão global "Enviar feedback" (arch. §13). `other` incluído a pedido do dono do produto: nem todo feedback se encaixa nas 3 primeiras. */
export const USER_FEEDBACK_CATEGORIES = ["suggestion", "bug", "difficulty", "other"] as const;
export type UserFeedbackCategory = (typeof USER_FEEDBACK_CATEGORIES)[number];
