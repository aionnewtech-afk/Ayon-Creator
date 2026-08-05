import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SubscriptionPlan, SubscriptionStatus } from "@ayon/types";

export interface TrialOverviewRow {
  organizationId: string;
  organizationName: string;
  subscriptionId: string | null;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

/**
 * Visão de Trials (architecture.md §15.8, ux-design.md ADMIN-5) — uma linha
 * por organização (não só por assinatura), para permitir "criar trial" em
 * organizações que ainda não têm nenhuma linha em `subscriptions`. Ambas as
 * tabelas cobertas por `is_org_member`/`organizations_select_members`
 * (§15.2) — client de sessão.
 */
export async function getTrialsOverview(db: SupabaseClient<Database>): Promise<TrialOverviewRow[]> {
  const [organizationsResult, subscriptionsResult] = await Promise.all([
    db.from("organizations").select("id, name").eq("is_platform_account", false).is("deleted_at", null),
    db.from("subscriptions").select("*"),
  ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const subscriptionByOrg = new Map((subscriptionsResult.data ?? []).map((row) => [row.organization_id, row]));
  const now = new Date();

  return (organizationsResult.data ?? []).map((organization) => {
    const subscription = subscriptionByOrg.get(organization.id);
    const daysRemaining = subscription?.trial_ends_at
      ? Math.ceil((new Date(subscription.trial_ends_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      subscriptionId: subscription?.id ?? null,
      plan: subscription?.plan ?? null,
      status: subscription?.status ?? null,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      daysRemaining,
    };
  });
}
