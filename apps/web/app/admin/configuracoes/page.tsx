import { CreditPricingRepository, FeatureFlagRepository, getPlatformAdminsOverview } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ConfiguracoesPanel } from "./configuracoes-panel";

export default async function AdminConfiguracoesPage() {
  const sessionDb = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const creditPricingRepository = new CreditPricingRepository(sessionDb);
  const featureFlagRepository = new FeatureFlagRepository(sessionDb);

  const [creditPricing, featureFlags, platformAdmins] = await Promise.all([
    creditPricingRepository.findAll(),
    featureFlagRepository.findAll(),
    getPlatformAdminsOverview(serviceRoleDb),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preço em créditos por ação, flags de recurso e administradores da plataforma — só Super Admin.</p>
      </div>

      <ConfiguracoesPanel creditPricing={creditPricing} featureFlags={featureFlags} platformAdmins={platformAdmins} />
    </div>
  );
}
