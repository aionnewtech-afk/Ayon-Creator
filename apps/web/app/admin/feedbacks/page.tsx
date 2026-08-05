import { getFeedbacksOverview } from "@ayon/core";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { FeedbacksTable } from "./feedbacks-table";

export default async function AdminFeedbacksPage() {
  const serviceRoleDb = createServiceRoleClient();
  const rows = await getFeedbacksOverview(serviceRoleDb);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Feedbacks</h1>
        <p className="text-sm text-muted-foreground">{rows.length} feedbacks — CRM interno, sem resposta ao usuário.</p>
      </div>

      <FeedbacksTable rows={rows} />
    </div>
  );
}
