import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OrganizationStatus, SubscriptionPlan, SubscriptionStatus } from "@ayon/types";

export interface OrganizationOverviewRow {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  isPlatformAccount: boolean;
  createdAt: string;
  plan: SubscriptionPlan | null;
  subscriptionStatus: SubscriptionStatus | null;
  trialEndsAt: string | null;
  creditsBalance: number;
  creditsConsumedThisMonth: number;
  campaignsCount: number;
  videosCount: number;
  imagesCount: number;
  lastActivityAt: string | null;
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function laterIso(a: string | null | undefined, b: string): string {
  if (!a) return b;
  return b > a ? b : a;
}

/**
 * Visão operacional de Organizações (architecture.md §15.8) — plano,
 * créditos, consumo do mês, contagens, última atividade. Nenhuma dessas 6
 * tabelas exige service role (todas cobertas por `is_org_member`/
 * `organizations_select_members`, §15.2) — client de sessão sempre.
 * `campaigns`/`content_pieces` não têm `organization_id` direto (só
 * `brand_id`/`campaign_id`), então a agregação é feita em memória a partir
 * de leituras em massa, mesmo princípio já usado por
 * `CreditLedgerRepository.getBalance` (soma em JS, nunca coluna cacheada).
 */
export async function getOrganizationsOverview(db: SupabaseClient<Database>): Promise<OrganizationOverviewRow[]> {
  const monthStart = startOfMonthIso();

  const [organizationsResult, subscriptionsResult, brandsResult, campaignsResult, contentPiecesResult, creditLedgerResult] =
    await Promise.all([
      db.from("organizations").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      db.from("subscriptions").select("organization_id, plan, status, trial_ends_at"),
      db.from("brands").select("id, organization_id"),
      db.from("campaigns").select("id, brand_id, created_at"),
      db.from("content_pieces").select("id, campaign_id, format, created_at"),
      db.from("credit_ledger").select("organization_id, amount, type, created_at"),
    ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  if (brandsResult.error) throw brandsResult.error;
  if (campaignsResult.error) throw campaignsResult.error;
  if (contentPiecesResult.error) throw contentPiecesResult.error;
  if (creditLedgerResult.error) throw creditLedgerResult.error;

  const brandToOrg = new Map((brandsResult.data ?? []).map((row) => [row.id, row.organization_id]));
  const campaignToOrg = new Map<string, string>();
  const campaignsCountByOrg = new Map<string, number>();
  const lastActivityByOrg = new Map<string, string>();

  for (const campaign of campaignsResult.data ?? []) {
    const organizationId = brandToOrg.get(campaign.brand_id);
    if (!organizationId) continue;
    campaignToOrg.set(campaign.id, organizationId);
    campaignsCountByOrg.set(organizationId, (campaignsCountByOrg.get(organizationId) ?? 0) + 1);
    lastActivityByOrg.set(organizationId, laterIso(lastActivityByOrg.get(organizationId), campaign.created_at));
  }

  const videosCountByOrg = new Map<string, number>();
  const imagesCountByOrg = new Map<string, number>();
  const imageFormats = new Set(["stories", "carousel", "thumbnail"]);

  for (const piece of contentPiecesResult.data ?? []) {
    const organizationId = campaignToOrg.get(piece.campaign_id);
    if (!organizationId) continue;
    if (piece.format === "video") {
      videosCountByOrg.set(organizationId, (videosCountByOrg.get(organizationId) ?? 0) + 1);
    } else if (imageFormats.has(piece.format)) {
      imagesCountByOrg.set(organizationId, (imagesCountByOrg.get(organizationId) ?? 0) + 1);
    }
    lastActivityByOrg.set(organizationId, laterIso(lastActivityByOrg.get(organizationId), piece.created_at));
  }

  const balanceByOrg = new Map<string, number>();
  const consumedThisMonthByOrg = new Map<string, number>();

  for (const entry of creditLedgerResult.data ?? []) {
    balanceByOrg.set(entry.organization_id, (balanceByOrg.get(entry.organization_id) ?? 0) + entry.amount);
    if (entry.type === "consumption" && entry.created_at >= monthStart) {
      consumedThisMonthByOrg.set(
        entry.organization_id,
        (consumedThisMonthByOrg.get(entry.organization_id) ?? 0) + Math.abs(entry.amount),
      );
    }
    lastActivityByOrg.set(entry.organization_id, laterIso(lastActivityByOrg.get(entry.organization_id), entry.created_at));
  }

  const subscriptionByOrg = new Map((subscriptionsResult.data ?? []).map((row) => [row.organization_id, row]));

  return (organizationsResult.data ?? []).map((organization) => {
    const subscription = subscriptionByOrg.get(organization.id);
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      isPlatformAccount: organization.is_platform_account,
      createdAt: organization.created_at,
      plan: subscription?.plan ?? null,
      subscriptionStatus: subscription?.status ?? null,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      creditsBalance: balanceByOrg.get(organization.id) ?? 0,
      creditsConsumedThisMonth: consumedThisMonthByOrg.get(organization.id) ?? 0,
      campaignsCount: campaignsCountByOrg.get(organization.id) ?? 0,
      videosCount: videosCountByOrg.get(organization.id) ?? 0,
      imagesCount: imagesCountByOrg.get(organization.id) ?? 0,
      lastActivityAt: lastActivityByOrg.get(organization.id) ?? null,
    };
  });
}
