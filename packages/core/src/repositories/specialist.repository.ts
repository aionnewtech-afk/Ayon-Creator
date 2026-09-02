import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type SpecialistRow = Database["public"]["Tables"]["specialists"]["Row"];

/**
 * Único ponto de código que fala com a tabela `specialists` — o Specialist
 * Registry (architecture.md §4.1). Nenhum papel de especialista é hardcoded
 * em lugar nenhum do código; tudo passa por aqui.
 *
 * Importante: `specialists` não tem policy de RLS para usuários finais
 * (database.md §8) — este repository só deve ser instanciado com um client
 * de service role (ver apps/web/lib/supabase/service-role.ts).
 */
export class SpecialistRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Especialistas ativos aplicáveis a um tipo de decisão, ordenados por prioridade. */
  async findApplicable(decisionType: string): Promise<SpecialistRow[]> {
    const { data, error } = await this.db
      .from("specialists")
      .select("*")
      .eq("role", "specialist")
      .eq("status", "active")
      .contains("applies_to", [decisionType])
      .order("priority", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  /** Nome/dados de especialistas específicos, por id — usado para reidratar opiniões já gravadas (ex.: retomar a revisão de uma estratégia pendente sem rodar o painel de novo). */
  async findByIds(ids: string[]): Promise<SpecialistRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from("specialists").select("*").in("id", ids);

    if (error) throw error;
    return data ?? [];
  }

  /** O Coordinator ativo — assume-se um único registro com este papel. */
  async findCoordinator(): Promise<SpecialistRow | null> {
    const { data, error } = await this.db
      .from("specialists")
      .select("*")
      .eq("role", "coordinator")
      .eq("status", "active")
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
