import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type CreditLedgerRow = Database["public"]["Tables"]["credit_ledger"]["Row"];
type CreditLedgerInsert = Database["public"]["Tables"]["credit_ledger"]["Insert"];

/**
 * Único ponto de código que fala com a tabela `credit_ledger`
 * (ver CONVENTIONS.md §2 — Repository Pattern). Livro-razão append-only —
 * este repository nunca expõe update/delete, só create e leitura.
 *
 * Sem policy de insert para usuário final (database.md §8) — só grava com
 * um client de service role (portão de crédito ou webhook do Mercado Pago).
 */
export class CreditLedgerRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: CreditLedgerInsert): Promise<CreditLedgerRow> {
    const { data, error } = await this.db.from("credit_ledger").insert(input).select().single();

    if (error) throw error;
    return data;
  }

  /** Saldo atual da organização — sempre SUM(amount), nunca uma coluna cacheada. */
  async getBalance(organizationId: string): Promise<number> {
    const { data, error } = await this.db.from("credit_ledger").select("amount").eq("organization_id", organizationId);

    if (error) throw error;
    return (data ?? []).reduce((total, row) => total + row.amount, 0);
  }

  async findByOrganizationId(organizationId: string, limit = 50): Promise<CreditLedgerRow[]> {
    const { data, error } = await this.db
      .from("credit_ledger")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }
}
