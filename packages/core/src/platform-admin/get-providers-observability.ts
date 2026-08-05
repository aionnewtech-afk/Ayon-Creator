import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

export interface ProviderObservabilityRow {
  providerKey: string;
  capability: string;
  callsCount: number;
  errorCount: number;
  availabilityPercent: number;
  avgLatencyMs: number | null;
  totalCostEstimateCredits: number;
}

/**
 * Observabilidade de Providers (architecture.md §15.7/§15.8) — agregação
 * sobre `provider_call_logs`, calculada na leitura (nenhuma coluna de
 * agregado cacheado). Sempre service role: a tabela não tem policy de RLS
 * para `authenticated` (achado real, revisão 37).
 */
export async function getProvidersObservability(serviceRoleDb: SupabaseClient<Database>): Promise<ProviderObservabilityRow[]> {
  const { data, error } = await serviceRoleDb
    .from("provider_call_logs")
    .select("provider_key, capability, status, latency_ms, cost_estimate_credits");

  if (error) throw error;

  const byKey = new Map<
    string,
    { capability: string; calls: number; errors: number; latencySum: number; latencyCount: number; cost: number }
  >();

  for (const row of data ?? []) {
    const bucket = byKey.get(row.provider_key) ?? { capability: row.capability, calls: 0, errors: 0, latencySum: 0, latencyCount: 0, cost: 0 };
    bucket.calls += 1;
    if (row.status === "error") bucket.errors += 1;
    if (row.latency_ms !== null) {
      bucket.latencySum += row.latency_ms;
      bucket.latencyCount += 1;
    }
    bucket.cost += row.cost_estimate_credits ?? 0;
    byKey.set(row.provider_key, bucket);
  }

  return [...byKey.entries()]
    .map(([providerKey, bucket]) => ({
      providerKey,
      capability: bucket.capability,
      callsCount: bucket.calls,
      errorCount: bucket.errors,
      availabilityPercent: bucket.calls > 0 ? ((bucket.calls - bucket.errors) / bucket.calls) * 100 : 100,
      avgLatencyMs: bucket.latencyCount > 0 ? Math.round(bucket.latencySum / bucket.latencyCount) : null,
      totalCostEstimateCredits: bucket.cost,
    }))
    .sort((a, b) => b.callsCount - a.callsCount);
}
