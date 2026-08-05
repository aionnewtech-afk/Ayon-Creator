import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
type SubscriptionInsert = Database["public"]["Tables"]["subscriptions"]["Insert"];
type SubscriptionUpdate = Database["public"]["Tables"]["subscriptions"]["Update"];

/**
 * Único ponto de código que fala com a tabela `subscriptions`
 * (ver CONVENTIONS.md §2 — Repository Pattern).
 *
 * `subscriptions` não tem policy de insert/update para usuário final
 * (database.md §8) — este repository só deve gravar com um client de
 * service role (portão de crédito ou webhook do Mercado Pago).
 */
export class SubscriptionRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findByOrganizationId(organizationId: string): Promise<SubscriptionRow | null> {
    const { data, error } = await this.db
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Todas as assinaturas — uso administrativo (telas Trials/Organizações, §15.8). */
  async findAll(): Promise<SubscriptionRow[]> {
    const { data, error } = await this.db.from("subscriptions").select("*").order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async findByBillingProviderRef(billingProviderRef: string): Promise<SubscriptionRow | null> {
    const { data, error } = await this.db
      .from("subscriptions")
      .select("*")
      .eq("billing_provider_ref", billingProviderRef)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Cria a assinatura se não existir, ou atualiza a existente — chave é `organization_id` (unique). */
  async upsertByOrganizationId(
    organizationId: string,
    patch: Omit<SubscriptionInsert, "organization_id">,
  ): Promise<SubscriptionRow> {
    const { data, error } = await this.db
      .from("subscriptions")
      .upsert({ ...patch, organization_id: organizationId }, { onConflict: "organization_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, patch: SubscriptionUpdate): Promise<SubscriptionRow> {
    const { data, error } = await this.db.from("subscriptions").update(patch).eq("id", id).select().single();

    if (error) throw error;
    return data;
  }
}
