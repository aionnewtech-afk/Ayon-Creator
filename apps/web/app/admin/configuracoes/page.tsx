import { CreditPricingRepository, FeatureFlagRepository } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracoesPanel } from "./configuracoes-panel";

export default async function AdminConfiguracoesPage() {
  const sessionDb = await createClient();
  const creditPricingRepository = new CreditPricingRepository(sessionDb);
  const featureFlagRepository = new FeatureFlagRepository(sessionDb);

  const [creditPricing, featureFlags] = await Promise.all([creditPricingRepository.findAll(), featureFlagRepository.findAll()]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preço em créditos por ação e flags de recurso — só Super Admin.</p>
      </div>

      <ConfiguracoesPanel creditPricing={creditPricing} featureFlags={featureFlags} />
    </div>
  );
}
