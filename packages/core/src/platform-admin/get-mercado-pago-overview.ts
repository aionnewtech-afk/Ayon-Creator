import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SubscriptionPlan, SubscriptionStatus } from "@ayon/types";

export interface MercadoPagoOverviewRow {
  organizationId: string;
  organizationName: string;
  subscriptionId: string | null;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  billingProviderRef: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  purchasesCount: number;
}

/**
 * Visão de Mercado Pago (architecture.md §15.8) — subscriptions +
 * credit_ledger (compras avulsas via `external_payment_id`), ambas cobertas
 * por `is_org_member` (§15.2) — client de sessão.
 */
export async function getMercadoPagoOverview(db: SupabaseClient<Database>): Promise<MercadoPagoOverviewRow[]> {
  const [organizationsResult, subscriptionsResult, purchasesResult] = await Promise.all([
    db.from("organizations").select("id, name").eq("is_platform_account", false).is("deleted_at", null),
    db.from("subscriptions").select("*"),
    db.from("credit_ledger").select("organization_id").eq("type", "purchase"),
  ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  if (purchasesResult.error) throw purchasesResult.error;

  const subscriptionByOrg = new Map((subscriptionsResult.data ?? []).map((row) => [row.organization_id, row]));
  const purchasesCountByOrg = new Map<string, number>();
  for (const row of purchasesResult.data ?? []) {
    purchasesCountByOrg.set(row.organization_id, (purchasesCountByOrg.get(row.organization_id) ?? 0) + 1);
  }

  return (organizationsResult.data ?? []).map((organization) => {
    const subscription = subscriptionByOrg.get(organization.id);
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      subscriptionId: subscription?.id ?? null,
      plan: subscription?.plan ?? null,
      status: subscription?.status ?? null,
      billingProviderRef: subscription?.billing_provider_ref ?? null,
      currentPeriodStart: subscription?.current_period_start ?? null,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      purchasesCount: purchasesCountByOrg.get(organization.id) ?? 0,
    };
  });
}
