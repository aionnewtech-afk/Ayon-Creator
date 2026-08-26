import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

/**
 * Único ponto de código que fala com `heygen_account_pool` (ver
 * CONVENTIONS.md §2 — Repository Pattern). Guarda chaves de API reais —
 * este repository só deve ser instanciado com um client de service role,
 * nunca com o client de sessão do usuário (a tabela nem tem policy de RLS
 * para `authenticated`/`anon` — só o service role, que ignora RLS, ou a
 * função `claim_heygen_account`, alcançam estas linhas).
 */
export class HeygenAccountPoolRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Total de linhas no pool (independente de atribuídas ou não) — usado só pra distinguir "pool nunca configurado" (0 linhas, cai no fallback de `.env`) de "pool em uso, mas esgotado" (nenhuma disponível, erro explícito). */
  async count(): Promise<number> {
    const { count, error } = await this.db.from("heygen_account_pool").select("*", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Reivindica (ou devolve a já atribuída) 1 conta HeyGen real pra esta
   * organização — atômico via `claim_heygen_account` (RPC, `for update skip
   * locked`), nunca 2 organizações recebem a mesma conta mesmo com pedidos
   * concorrentes. `null` quando o pool está sem conta disponível.
   */
  async claimForOrganization(organizationId: string): Promise<string | null> {
    const { data, error } = await this.db.rpc("claim_heygen_account", { p_organization_id: organizationId });
    if (error) throw error;
    return data;
  }
}
