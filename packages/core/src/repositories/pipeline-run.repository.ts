import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type PipelineRunRow = Database["public"]["Tables"]["pipeline_runs"]["Row"];
type PipelineRunInsert = Database["public"]["Tables"]["pipeline_runs"]["Insert"];
type PipelineRunUpdate = Database["public"]["Tables"]["pipeline_runs"]["Update"];

/**
 * Único ponto de código que fala com a tabela `pipeline_runs`
 * (ver CONVENTIONS.md §2 — Repository Pattern). ★ Ativada na Missão 9 —
 * primeira escrita real desta tabela, documentada desde revisões antigas de
 * database.md mas nunca migrada até agora (ver migration `0017`).
 */
export class PipelineRunRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: PipelineRunInsert): Promise<PipelineRunRow> {
    const { data, error } = await this.db.from("pipeline_runs").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: PipelineRunUpdate): Promise<PipelineRunRow> {
    const { data, error } = await this.db.from("pipeline_runs").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<PipelineRunRow | null> {
    const { data, error } = await this.db.from("pipeline_runs").select("*").eq("id", id).maybeSingle();

    if (error) throw error;
    return data;
  }
}
