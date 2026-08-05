import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { AdminAuditLogRepository } from "../repositories/admin-audit-log.repository";
import { ProviderCallLogRepository } from "../repositories/provider-call-log.repository";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";

export type LogSource = "pipeline" | "audit" | "provider" | "payment";

export interface LogEntry {
  id: string;
  source: LogSource;
  timestamp: string;
  summary: string;
  status: "ok" | "error" | "info";
  detail: string;
}

/**
 * Visão unificada de Logs (architecture.md §15.8) — 4 fontes distintas,
 * cada uma já com seu repository (pipeline_runs via client de sessão,
 * admin_audit_logs/provider_call_logs via service role — achado real,
 * revisão 37 —, credit_ledger via client de sessão). Normalizadas num
 * formato comum e ordenadas por data, sem tabela nova nem coluna
 * agregada — filtrado na leitura.
 */
export async function getLogsOverview(sessionDb: SupabaseClient<Database>, serviceRoleDb: SupabaseClient<Database>): Promise<LogEntry[]> {
  const pipelineRunRepository = new PipelineRunRepository(sessionDb);
  const adminAuditLogRepository = new AdminAuditLogRepository(serviceRoleDb);
  const providerCallLogRepository = new ProviderCallLogRepository(serviceRoleDb);

  const [pipelineRuns, auditLogs, providerCalls, payments] = await Promise.all([
    pipelineRunRepository.findRecent(100),
    adminAuditLogRepository.find({ limit: 100 }),
    providerCallLogRepository.find({ limit: 100 }),
    sessionDb
      .from("credit_ledger")
      .select("*")
      .in("type", ["purchase", "grant_plan"])
      .order("created_at", { ascending: false })
      .limit(100)
      .then((result) => {
        if (result.error) throw result.error;
        return result.data ?? [];
      }),
  ]);

  const entries: LogEntry[] = [
    ...pipelineRuns.map((row): LogEntry => ({
      id: row.id,
      source: "pipeline",
      timestamp: row.started_at,
      summary: `Pipeline ${row.entity_type} — ${row.stage ?? row.status}`,
      status: row.status === "failed" ? "error" : row.status === "completed" ? "ok" : "info",
      detail: row.error ?? `status=${row.status}`,
    })),
    ...auditLogs.map((row): LogEntry => ({
      id: row.id,
      source: "audit",
      timestamp: row.created_at,
      summary: `${row.action} (${row.actor_role})`,
      status: "info",
      detail: `entidade=${row.entity_type}${row.entity_id ? ` #${row.entity_id}` : ""}`,
    })),
    ...providerCalls.map((row): LogEntry => ({
      id: row.id,
      source: "provider",
      timestamp: row.created_at,
      summary: `${row.provider_key} — ${row.capability}`,
      status: row.status === "error" ? "error" : "ok",
      detail: row.error_message ?? `${row.latency_ms ?? "?"}ms`,
    })),
    ...payments.map((row): LogEntry => ({
      id: row.id,
      source: "payment",
      timestamp: row.created_at,
      summary: `${row.type === "purchase" ? "Compra de créditos" : "Concessão do plano"} — ${row.amount} créditos`,
      status: "ok",
      detail: row.description ?? "",
    })),
  ];

  return entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}
