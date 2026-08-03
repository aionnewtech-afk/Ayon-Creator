/**
 * Tipos escritos à mão a partir de supabase/migrations/0001_init.sql.
 * Quando o projeto Supabase estiver linkado, substituir por:
 *   supabase gen types typescript --linked > packages/types/src/database.ts
 * mantendo o mesmo shape (Database.public.Tables.<tabela>.Row/Insert/Update).
 */
import type {
  BrandStatus,
  KnowledgeBaseSourceType,
  OnboardingQuestionKey,
  OrganizationMemberRole,
  OrganizationPlan,
  ProviderCapability,
  ProviderConfigStatus,
  ProviderTier,
  SpecialistType,
} from "./domain";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: OrganizationPlan;
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
          plan?: OrganizationPlan;
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
          specialist_type: SpecialistType | null;
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
          specialist_type?: SpecialistType | null;
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
        Update: Partial<Database["public"]["Tables"]["knowledge_base_items"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
