import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type BrandOnboardingAnswerRow = Database["public"]["Tables"]["brand_onboarding_answers"]["Row"];
type BrandOnboardingAnswerInsert = Database["public"]["Tables"]["brand_onboarding_answers"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `brand_onboarding_answers`
 * (ver CONVENTIONS.md §2 — Repository Pattern). Histórico bruto e imutável
 * da conversa "Conheça sua empresa" — uma resposta do usuário pode gerar
 * mais de um registro (um por campo estruturado identificado no turno).
 */
export class BrandOnboardingAnswerRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async createMany(inputs: BrandOnboardingAnswerInsert[]): Promise<BrandOnboardingAnswerRow[]> {
    if (inputs.length === 0) return [];

    const { data, error } = await this.db
      .from("brand_onboarding_answers")
      .insert(inputs)
      .select();

    if (error) throw error;
    return data ?? [];
  }

  async findByBrandId(brandId: string): Promise<BrandOnboardingAnswerRow[]> {
    const { data, error } = await this.db
      .from("brand_onboarding_answers")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
