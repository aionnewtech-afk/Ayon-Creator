import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditLedgerEntryType, Database } from "@ayon/types";

export interface CreditsOverviewRow {
  organizationId: string;
  organizationName: string;
  balance: number;
  totalGranted: number;
  totalPurchased: number;
  totalConsumed: number;
  totalAdjusted: number;
  lastEntryAt: string | null;
}

/** Visão de Créditos por organização (architecture.md §15.8) — client de sessão (credit_ledger coberta por is_org_member, §15.2). */
export async function getCreditsOverview(db: SupabaseClient<Database>): Promise<CreditsOverviewRow[]> {
  const [organizationsResult, ledgerResult] = await Promise.all([
    db.from("organizations").select("id, name").eq("is_platform_account", false).is("deleted_at", null),
    db.from("credit_ledger").select("organization_id, type, amount, created_at"),
  ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (ledgerResult.error) throw ledgerResult.error;

  const sumsByOrg = new Map<
    string,
    { balance: number; totalGranted: number; totalPurchased: number; totalConsumed: number; totalAdjusted: number; lastEntryAt: string | null }
  >();

  const typeAccumulator: Record<CreditLedgerEntryType, keyof Omit<ReturnType<typeof emptyTotals>, "balance" | "lastEntryAt">> = {
    grant_plan: "totalGranted",
    purchase: "totalPurchased",
    consumption: "totalConsumed",
    adjustment: "totalAdjusted",
  };

  function emptyTotals() {
    return { balance: 0, totalGranted: 0, totalPurchased: 0, totalConsumed: 0, totalAdjusted: 0, lastEntryAt: null as string | null };
  }

  for (const entry of ledgerResult.data ?? []) {
    const totals = sumsByOrg.get(entry.organization_id) ?? emptyTotals();
    totals.balance += entry.amount;
    totals[typeAccumulator[entry.type]] += entry.amount;
    if (!totals.lastEntryAt || entry.created_at > totals.lastEntryAt) totals.lastEntryAt = entry.created_at;
    sumsByOrg.set(entry.organization_id, totals);
  }

  return (organizationsResult.data ?? []).map((organization) => {
    const totals = sumsByOrg.get(organization.id) ?? emptyTotals();
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      ...totals,
    };
  });
}
