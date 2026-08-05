import { PlanRepository } from "@ayon/core";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PlansTable } from "./plans-table";

export default async function AdminPlansPage() {
  const serviceRoleDb = createServiceRoleClient();
  const planRepository = new PlanRepository(serviceRoleDb);
  const plans = await planRepository.findAll();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Planos</h1>
        <p className="text-sm text-muted-foreground">Preço, créditos, limites e flags de recurso — sem migrations destrutivas.</p>
      </div>

      <PlansTable plans={plans} />
    </div>
  );
}
