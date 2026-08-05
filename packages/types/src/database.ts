/**
 * Tipos escritos à mão a partir de supabase/migrations/0001_init.sql.
 * Quando o projeto Supabase estiver linkado, substituir por:
 *   supabase gen types typescript --linked > packages/types/src/database.ts
 * mantendo o mesmo shape (Database.public.Tables.<tabela>.Row/Insert/Update).
 */
import type {
  BrandStatus,
  CampaignStatus,
  ContentPackageStatus,
  ContentPieceFormat,
  ContentPieceStatus,
  IntelligenceHubRelatedEntityType,
  IntelligenceHubSessionStatus,
  KnowledgeBaseSourceType,
  LearningInsightAppliedTo,
  LearningInsightStatus,
  LearningSignalType,
  OnboardingQuestionKey,
  CreditLedgerEntryType,
  CreditPackageStatus,
  CreditPricingStatus,
  OrganizationMemberRole,
  PipelineRunEngine,
  PipelineRunEntityType,
  PipelineRunStatus,
  PlanStatus,
  ProductionMode,
  ProviderCapability,
  ProviderConfigStatus,
  ProviderTier,
  SpecialistRole,
  SpecialistStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  TrendResearchStatus,
  UserFeedbackCategory,
} from "./domain";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          provider_tier: ProviderTier;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          provider_tier?: ProviderTier;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrganizationMemberRole;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: OrganizationMemberRole;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["organization_members"]["Insert"]>;
        Relationships: [];
      };
      brands: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          niche: string | null;
          provider_tier: ProviderTier | null;
          status: BrandStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          niche?: string | null;
          provider_tier?: ProviderTier | null;
          status?: BrandStatus;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["brands"]["Insert"]>;
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          locale: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
      feature_flags: {
        Row: {
          id: string;
          key: string;
          description: string | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          description?: string | null;
          enabled?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["feature_flags"]["Insert"]>;
        Relationships: [];
      };
      brand_brain_profiles: {
        Row: {
          id: string;
          brand_id: string;
          company_history: string | null;
          products_summary: string | null;
          target_audience: string | null;
          tone_of_voice: string | null;
          competitors: string[];
          objectives: string | null;
          differentiators: string | null;
          forbidden_words: string[];
          favorite_words: string[];
          visual_guidelines: Record<string, unknown>;
          default_avatar_ref: string | null;
          default_voice_ref: string | null;
          learned_preferences: Record<string, unknown>;
          last_learning_update_at: string | null;
          onboarding_completed_at: string | null;
          onboarding_confirmed_at: string | null;
          onboarding_synthesis: unknown[] | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          company_history?: string | null;
          products_summary?: string | null;
          target_audience?: string | null;
          tone_of_voice?: string | null;
          competitors?: string[];
          objectives?: string | null;
          differentiators?: string | null;
          forbidden_words?: string[];
          favorite_words?: string[];
          visual_guidelines?: Record<string, unknown>;
          default_avatar_ref?: string | null;
          default_voice_ref?: string | null;
          learned_preferences?: Record<string, unknown>;
          last_learning_update_at?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_confirmed_at?: string | null;
          onboarding_synthesis?: unknown[] | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["brand_brain_profiles"]["Insert"]>;
        Relationships: [];
      };
      brand_onboarding_answers: {
        Row: {
          id: string;
          brand_id: string;
          question_key: OnboardingQuestionKey;
          answer_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          question_key: OnboardingQuestionKey;
          answer_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["brand_onboarding_answers"]["Insert"]>;
        Relationships: [];
      };
      provider_configs: {
        Row: {
          id: string;
          capability: ProviderCapability;
          tier: ProviderTier;
          specialist_id: string | null;
          provider_key: string;
          credentials_ref: string | null;
          priority: number;
          fallback_provider_key: string | null;
          status: ProviderConfigStatus;
          updated_at: string;
        };
        Insert: {
          id?: string;
          capability: ProviderCapability;
          tier: ProviderTier;
          specialist_id?: string | null;
          provider_key: string;
          credentials_ref?: string | null;
          priority?: number;
          fallback_provider_key?: string | null;
          status?: ProviderConfigStatus;
        };
        Update: Partial<Database["public"]["Tables"]["provider_configs"]["Insert"]>;
        Relationships: [];
      };
      knowledge_base_items: {
        Row: {
          id: string;
          brand_id: string;
          source_type: KnowledgeBaseSourceType;
          title: string;
          content_text: string | null;
          storage_path: string | null;
          tags: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          brand_id: string;
          source_type: KnowledgeBaseSourceType;
          title: string;
          content_text?: string | null;
          storage_path?: string | null;
          tags?: string[];
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_base_items"]["Insert"]> & {
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      specialists: {
        Row: {
          id: string;
          key: string;
          role: SpecialistRole;
          name: string;
          objective: string;
          system_prompt: string;
          provider_capability: ProviderCapability;
          applies_to: string[];
          priority: number;
          parameters: Record<string, unknown>;
          status: SpecialistStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          role?: SpecialistRole;
          name: string;
          objective: string;
          system_prompt: string;
          provider_capability?: ProviderCapability;
          applies_to?: string[];
          priority?: number;
          parameters?: Record<string, unknown>;
          status?: SpecialistStatus;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["specialists"]["Insert"]>;
        Relationships: [];
      };
      intelligence_hub_sessions: {
        Row: {
          id: string;
          brand_id: string;
          related_entity_type: IntelligenceHubRelatedEntityType;
          related_entity_id: string;
          trigger_reason: string;
          status: IntelligenceHubSessionStatus;
          consolidated_result: Record<string, unknown> | null;
          coordinator_provider_key: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          brand_id: string;
          related_entity_type: IntelligenceHubRelatedEntityType;
          related_entity_id: string;
          trigger_reason: string;
          status?: IntelligenceHubSessionStatus;
          consolidated_result?: Record<string, unknown> | null;
          coordinator_provider_key?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["intelligence_hub_sessions"]["Insert"]>;
        Relationships: [];
      };
      specialist_opinions: {
        Row: {
          id: string;
          session_id: string;
          specialist_id: string;
          opinion: Record<string, unknown>;
          llm_provider_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          specialist_id: string;
          opinion: Record<string, unknown>;
          llm_provider_key?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["specialist_opinions"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          brand_id: string;
          trend_research_id: string | null;
          intelligence_hub_session_id: string;
          title: string;
          strategy_summary: Record<string, unknown> | null;
          status: CampaignStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          trend_research_id?: string | null;
          intelligence_hub_session_id: string;
          title: string;
          strategy_summary?: Record<string, unknown> | null;
          status?: CampaignStatus;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
        Relationships: [];
      };
      trend_research: {
        Row: {
          id: string;
          brand_id: string;
          provider_key: string | null;
          summary: Record<string, unknown> | null;
          intelligence_hub_session_id: string | null;
          status: TrendResearchStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          provider_key?: string | null;
          summary?: Record<string, unknown> | null;
          intelligence_hub_session_id?: string | null;
          status?: TrendResearchStatus;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["trend_research"]["Insert"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          plan: SubscriptionPlan;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          billing_provider_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan: SubscriptionPlan;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          billing_provider_ref?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      credit_ledger: {
        Row: {
          id: string;
          organization_id: string;
          type: CreditLedgerEntryType;
          amount: number;
          related_intelligence_hub_session_id: string | null;
          related_content_piece_id: string | null;
          related_pipeline_run_id: string | null;
          external_payment_id: string | null;
          description: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          type: CreditLedgerEntryType;
          amount: number;
          related_intelligence_hub_session_id?: string | null;
          related_content_piece_id?: string | null;
          related_pipeline_run_id?: string | null;
          external_payment_id?: string | null;
          description?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["credit_ledger"]["Insert"]>;
        Relationships: [];
      };
      credit_pricing: {
        Row: {
          id: string;
          trigger_reason: string;
          tier: ProviderTier;
          credits: number;
          status: CreditPricingStatus;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trigger_reason: string;
          tier: ProviderTier;
          credits: number;
          status?: CreditPricingStatus;
        };
        Update: Partial<Database["public"]["Tables"]["credit_pricing"]["Insert"]>;
        Relationships: [];
      };
      credit_packages: {
        Row: {
          id: string;
          name: string;
          credits: number;
          price_cents: number;
          status: CreditPackageStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          credits: number;
          price_cents: number;
          status?: CreditPackageStatus;
        };
        Update: Partial<Database["public"]["Tables"]["credit_packages"]["Insert"]>;
        Relationships: [];
      };
      plans: {
        Row: {
          plan: SubscriptionPlan;
          brands_included: number;
          tier_included: ProviderTier;
          credits_per_month: number;
          price_cents: number;
          status: PlanStatus;
          updated_at: string;
        };
        Insert: {
          plan: SubscriptionPlan;
          brands_included: number;
          tier_included: ProviderTier;
          credits_per_month: number;
          price_cents: number;
          status?: PlanStatus;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Insert"]>;
        Relationships: [];
      };
      content_pieces: {
        Row: {
          id: string;
          campaign_id: string;
          format: ContentPieceFormat;
          production_mode: ProductionMode | null;
          is_primary: boolean;
          intelligence_hub_session_id: string | null;
          script: string | null;
          brand_rationale: string | null;
          status: ContentPieceStatus;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          format: ContentPieceFormat;
          production_mode?: ProductionMode | null;
          is_primary?: boolean;
          intelligence_hub_session_id?: string | null;
          script?: string | null;
          brand_rationale?: string | null;
          status?: ContentPieceStatus;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["content_pieces"]["Insert"]>;
        Relationships: [];
      };
      content_versions: {
        Row: {
          id: string;
          content_piece_id: string;
          version_number: number;
          output_storage_path: string | null;
          generation_metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_piece_id: string;
          version_number?: number;
          output_storage_path?: string | null;
          generation_metadata?: Record<string, unknown> | null;
        };
        Update: Partial<Database["public"]["Tables"]["content_versions"]["Insert"]>;
        Relationships: [];
      };
      pipeline_runs: {
        Row: {
          id: string;
          entity_type: PipelineRunEntityType;
          entity_id: string;
          engine: PipelineRunEngine;
          n8n_execution_id: string | null;
          status: PipelineRunStatus;
          error: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          entity_type: PipelineRunEntityType;
          entity_id: string;
          engine: PipelineRunEngine;
          n8n_execution_id?: string | null;
          status?: PipelineRunStatus;
          error?: string | null;
          finished_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pipeline_runs"]["Insert"]>;
        Relationships: [];
      };
      user_feedback: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          category: UserFeedbackCategory;
          description: string;
          pathname: string | null;
          app_version: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          category: UserFeedbackCategory;
          description: string;
          pathname?: string | null;
          app_version?: string | null;
          user_agent?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_feedback"]["Insert"]>;
        Relationships: [];
      };
      content_packages: {
        Row: {
          id: string;
          campaign_id: string;
          storage_path: string | null;
          status: ContentPackageStatus;
          generated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          storage_path?: string | null;
          status?: ContentPackageStatus;
          generated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["content_packages"]["Insert"]>;
        Relationships: [];
      };
      learning_signals: {
        Row: {
          id: string;
          brand_id: string;
          content_piece_id: string | null;
          signal_type: LearningSignalType;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          content_piece_id?: string | null;
          signal_type: LearningSignalType;
          payload?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["learning_signals"]["Insert"]>;
        Relationships: [];
      };
      learning_insights: {
        Row: {
          id: string;
          brand_id: string;
          insight_type: string;
          summary: Record<string, unknown>;
          applied_to: LearningInsightAppliedTo;
          status: LearningInsightStatus;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          insight_type: string;
          summary: Record<string, unknown>;
          applied_to: LearningInsightAppliedTo;
          status?: LearningInsightStatus;
          reviewed_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["learning_insights"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ensure_initial_provisioning: {
        Args: {
          p_user_id: string;
          p_organization_name: string;
          p_base_slug: string;
        };
        Returns: { already_provisioned: boolean; organization_id: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
