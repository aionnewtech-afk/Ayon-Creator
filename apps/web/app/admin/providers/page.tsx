import { ProviderConfigRepository, getProvidersObservability } from "@ayon/core";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentSession } from "@/lib/session";
import { ProvidersTable } from "./providers-table";

export default async function AdminProvidersPage() {
  const serviceRoleDb = createServiceRoleClient();
  const providerConfigRepository = new ProviderConfigRepository(serviceRoleDb);

  const [configs, observability, session] = await Promise.all([
    providerConfigRepository.findAll(),
    getProvidersObservability(serviceRoleDb),
    getCurrentSession(),
  ]);

  const observabilityByKey = new Map(observability.map((row) => [row.providerKey, row]));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Providers</h1>
        <p className="text-sm text-muted-foreground">Latência, erros, custo estimado e gestão de configuração por fornecedor.</p>
      </div>

      <ProvidersTable
        configs={configs.map((config) => ({
          id: config.id,
          capability: config.capability,
          tier: config.tier,
          providerKey: config.provider_key,
          priority: config.priority,
          status: config.status,
          hasCredentialValue: Boolean(config.credential_value),
          observability: observabilityByKey.get(config.provider_key) ?? null,
        }))}
        role={session?.platformAdminRole ?? "support_admin"}
      />
    </div>
  );
}
