import { getTrialsOverview } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { TrialsTable } from "./trials-table";

export default async function AdminTrialsPage() {
  const sessionDb = await createClient();
  const rows = await getTrialsOverview(sessionDb);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Trials</h1>
        <p className="text-sm text-muted-foreground">{rows.length} organizações — dias restantes, expiração e status.</p>
      </div>

      <TrialsTable rows={rows} />
    </div>
  );
}
