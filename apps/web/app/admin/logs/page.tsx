import { getLogsOverview } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { LogsTable } from "./logs-table";

export default async function AdminLogsPage() {
  const sessionDb = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const entries = await getLogsOverview(sessionDb, serviceRoleDb);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Logs</h1>
        <p className="text-sm text-muted-foreground">{entries.length} eventos — pipelines, auditoria, providers e pagamentos.</p>
      </div>

      <LogsTable entries={entries} />
    </div>
  );
}
