import { getCreditsOverview } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { CreditsTable } from "./credits-table";

export default async function AdminCreditsPage() {
  const sessionDb = await createClient();
  const rows = await getCreditsOverview(sessionDb);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Créditos</h1>
        <p className="text-sm text-muted-foreground">{rows.length} organizações — saldo, histórico e ajustes.</p>
      </div>

      <CreditsTable rows={rows} />
    </div>
  );
}
