import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type UserFeedbackInsert = Database["public"]["Tables"]["user_feedback"]["Insert"];

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
}
