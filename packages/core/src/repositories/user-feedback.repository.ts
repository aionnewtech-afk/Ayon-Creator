import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type UserFeedbackRow = Database["public"]["Tables"]["user_feedback"]["Row"];
type UserFeedbackInsert = Database["public"]["Tables"]["user_feedback"]["Insert"];
type UserFeedbackUpdate = Database["public"]["Tables"]["user_feedback"]["Update"];

/**
 * Único ponto de código que fala com a tabela `user_feedback`
 * (ver CONVENTIONS.md §2 — Repository Pattern). ★ novo (Missão 10).
 *
 * `create` não usa `.select()` de propósito: a tabela não tem policy de
 * select para `authenticated` (database.md §8, leitura só via service role).
 * Encadear `.select().single()` depois do insert forçaria o PostgREST a
 * tentar ler a linha recém-criada pela mesma sessão do usuário, o que o
 * Postgres recusa com o mesmo erro 42501 de RLS do INSERT — mesmo o INSERT
 * em si tendo sido permitido (achado real, validado com chamada real).
 */
export class UserFeedbackRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: UserFeedbackInsert): Promise<void> {
    const { error } = await this.db.from("user_feedback").insert(input);

    if (error) throw error;
  }

  /** CRM interno (tela Feedbacks, admin) — sempre via service role, mesma tabela sem policy de select para o usuário final. */
  async findAll(): Promise<UserFeedbackRow[]> {
    const { data, error } = await this.db
      .from("user_feedback")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async update(id: string, patch: UserFeedbackUpdate): Promise<UserFeedbackRow> {
    const { data, error } = await this.db.from("user_feedback").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }

  /** Soft delete — nunca hard delete, mesmo padrão do resto do schema. */
  async softDelete(id: string): Promise<void> {
    const { error } = await this.db.from("user_feedback").update({ deleted_at: new Date().toISOString() }).eq("id", id);

    if (error) throw error;
  }
}
