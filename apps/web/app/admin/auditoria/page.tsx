import { getAuditLogOverview } from "@ayon/core";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { AuditLogTable } from "./audit-log-table";

export default async function AdminAuditPage() {
  const serviceRoleDb = createServiceRoleClient();
  const rows = await getAuditLogOverview(serviceRoleDb);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Auditoria</h1>
        <p className="text-sm text-muted-foreground">{rows.length} ações administrativas — usuário, papel, data, antes/depois, IP e User-Agent.</p>
      </div>

      <AuditLogTable rows={rows} />
    </div>
  );
}
