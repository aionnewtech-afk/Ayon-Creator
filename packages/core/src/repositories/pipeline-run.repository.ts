import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PipelineRunEntityType } from "@ayon/types";

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

  /** ★ novo (Missão 11) — usado pela UI para ler `stage`/`progress_percent`/`estimated_remaining_seconds` durante o polling (arch. §14.9), sem precisar do `pipelineRunId` explícito. */
  async findLatestByEntity(entityType: PipelineRunEntityType, entityId: string): Promise<PipelineRunRow | null> {
    const { data, error } = await this.db
      .from("pipeline_runs")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
