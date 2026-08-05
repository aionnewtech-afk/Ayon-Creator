import { getOrganizationsOverview } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/lib/session";
import { OrganizationsTable } from "./organizations-table";

export default async function AdminOrganizationsPage() {
  const sessionDb = await createClient();
  const [rows, session] = await Promise.all([getOrganizationsOverview(sessionDb), getCurrentSession()]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Organizações</h1>
        <p className="text-sm text-muted-foreground">{rows.length} organizações — plano, créditos, consumo e atividade.</p>
      </div>

      <OrganizationsTable rows={rows} role={session?.platformAdminRole ?? "support_admin"} />
    </div>
  );
}
