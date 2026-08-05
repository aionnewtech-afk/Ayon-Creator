import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

export interface PlatformDashboardMetrics {
  organizationsCount: number;
  usersCount: number;
  campaignsCount: number;
  videosCount: number;
  imagesCount: number;
  activeTrialsCount: number;
  trialToPaidConversionRate: number | null;
  mrrCents: number;
  arrCents: number;
  creditsConsumedToday: number;
  estimatedAiSpendCreditsToday: number;
  estimatedMarginCents: number | null;
  topProviders: Array<{ providerKey: string; calls: number }>;
  recentErrors: Array<{ id: string; providerKey: string; errorMessage: string | null; createdAt: string }>;
  planBreakdown: Array<{ plan: string; organizations: number }>;
}

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/**
 * Único ponto que monta as métricas do Dashboard administrativo
 * (architecture.md §15.8). `sessionDb` cobre as tabelas alcançadas por
 * `is_org_member`/`is_org_admin`/`is_org_editor` (§15.2 — RLS já concede
 * acesso total a qualquer platform_admin); `serviceRoleDb` cobre
 * `provider_call_logs` (achado real, revisão 37 do architecture.md — sem
 * policy de RLS para `authenticated`, nem de leitura).
 *
 * Conversão trial→pago é calculada só a partir do estado atual de
 * `subscriptions` (sem tabela de histórico de status): "converteu" = tem
 * `trial_ends_at` preenchido (já passou por trial) e `status = active`.
 * Margem estimada usa o preço médio por crédito de `credit_packages`
 * ativos (`price_cents / credits`) como taxa de câmbio crédito→centavo —
 * não existe nenhuma taxa fixa no schema, essa é a única fonte real de
 * dado (o preço que o cliente paga por crédito avulso).
 */
export async function getPlatformDashboardMetrics(
  sessionDb: SupabaseClient<Database>,
  serviceRoleDb: SupabaseClient<Database>,
): Promise<PlatformDashboardMetrics> {
  const todayStart = startOfTodayIso();

  const [
    organizationsResult,
    usersResult,
    campaignsResult,
    videosResult,
    imagesResult,
    activeSubscriptionsResult,
    activeTrialsResult,
    everTrialedResult,
    convertedTrialsResult,
    plansResult,
    creditPackagesResult,
    creditsConsumedTodayResult,
    providerCallLogsTodayResult,
    recentErrorsResult,
  ] = await Promise.all([
    sessionDb.from("organizations").select("id", { count: "exact", head: true }).eq("is_platform_account", false).is("deleted_at", null),
    sessionDb.from("user_profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    sessionDb.from("campaigns").select("id", { count: "exact", head: true }),
    sessionDb.from("content_pieces").select("id", { count: "exact", head: true }).eq("format", "video").gte("created_at", todayStart),
    sessionDb.from("content_pieces").select("id", { count: "exact", head: true }).in("format", ["stories", "carousel", "thumbnail"]).gte("created_at", todayStart),
    sessionDb.from("subscriptions").select("plan, organization_id").eq("status", "active"),
    sessionDb.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trialing"),
    sessionDb.from("subscriptions").select("id", { count: "exact", head: true }).not("trial_ends_at", "is", null),
    sessionDb.from("subscriptions").select("id", { count: "exact", head: true }).not("trial_ends_at", "is", null).eq("status", "active"),
    sessionDb.from("plans").select("plan, price_cents"),
    sessionDb.from("credit_packages").select("credits, price_cents").eq("status", "active"),
    sessionDb.from("credit_ledger").select("amount").eq("type", "consumption").gte("created_at", todayStart),
    serviceRoleDb.from("provider_call_logs").select("provider_key, cost_estimate_credits").gte("created_at", todayStart),
    serviceRoleDb
      .from("provider_call_logs")
      .select("id, provider_key, error_message, created_at")
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (usersResult.error) throw usersResult.error;
  if (campaignsResult.error) throw campaignsResult.error;
  if (videosResult.error) throw videosResult.error;
  if (imagesResult.error) throw imagesResult.error;
  if (activeSubscriptionsResult.error) throw activeSubscriptionsResult.error;
  if (activeTrialsResult.error) throw activeTrialsResult.error;
  if (everTrialedResult.error) throw everTrialedResult.error;
  if (convertedTrialsResult.error) throw convertedTrialsResult.error;
  if (plansResult.error) throw plansResult.error;
  if (creditPackagesResult.error) throw creditPackagesResult.error;
  if (creditsConsumedTodayResult.error) throw creditsConsumedTodayResult.error;
  if (providerCallLogsTodayResult.error) throw providerCallLogsTodayResult.error;
  if (recentErrorsResult.error) throw recentErrorsResult.error;

  const priceByPlan = new Map((plansResult.data ?? []).map((row) => [row.plan, row.price_cents]));
  const mrrCents = (activeSubscriptionsResult.data ?? []).reduce(
    (sum, row) => sum + (priceByPlan.get(row.plan) ?? 0),
    0,
  );

  const everTrialedCount = everTrialedResult.count ?? 0;
  const trialToPaidConversionRate = everTrialedCount > 0 ? (convertedTrialsResult.count ?? 0) / everTrialedCount : null;

  const creditsConsumedToday = Math.abs(
    (creditsConsumedTodayResult.data ?? []).reduce((sum, row) => sum + row.amount, 0),
  );

  const estimatedAiSpendCreditsToday = (providerCallLogsTodayResult.data ?? []).reduce(
    (sum, row) => sum + (row.cost_estimate_credits ?? 0),
    0,
  );

  const packages = creditPackagesResult.data ?? [];
  const totalPackageCredits = packages.reduce((sum, row) => sum + row.credits, 0);
  const centsPerCredit = totalPackageCredits > 0
    ? packages.reduce((sum, row) => sum + row.price_cents, 0) / totalPackageCredits
    : null;
  const estimatedMarginCents = centsPerCredit === null
    ? null
    : mrrCents - Math.round(estimatedAiSpendCreditsToday * centsPerCredit * 30);

  const callsByProvider = new Map<string, number>();
  for (const row of providerCallLogsTodayResult.data ?? []) {
    callsByProvider.set(row.provider_key, (callsByProvider.get(row.provider_key) ?? 0) + 1);
  }
  const topProviders = [...callsByProvider.entries()]
    .map(([providerKey, calls]) => ({ providerKey, calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 5);

  const orgsByPlan = new Map<string, number>();
  for (const row of activeSubscriptionsResult.data ?? []) {
    orgsByPlan.set(row.plan, (orgsByPlan.get(row.plan) ?? 0) + 1);
  }
  const planBreakdown = [...orgsByPlan.entries()].map(([plan, organizations]) => ({ plan, organizations }));

  return {
    organizationsCount: organizationsResult.count ?? 0,
    usersCount: usersResult.count ?? 0,
    campaignsCount: campaignsResult.count ?? 0,
    videosCount: videosResult.count ?? 0,
    imagesCount: imagesResult.count ?? 0,
    activeTrialsCount: activeTrialsResult.count ?? 0,
    trialToPaidConversionRate,
    mrrCents,
    arrCents: mrrCents * 12,
    creditsConsumedToday,
    estimatedAiSpendCreditsToday,
    estimatedMarginCents,
    topProviders,
    recentErrors: (recentErrorsResult.data ?? []).map((row) => ({
      id: row.id,
      providerKey: row.provider_key,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    })),
    planBreakdown,
  };
}
