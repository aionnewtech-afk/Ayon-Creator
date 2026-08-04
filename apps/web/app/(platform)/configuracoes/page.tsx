import { redirect } from "next/navigation";
import { CreditLedgerRepository, CreditPackageRepository, PlanRepository, SubscriptionRepository, hasMinimumRole } from "@ayon/core";
import { EmptyState } from "@ayon/ui";
import { Settings } from "lucide-react";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { BillingDashboard } from "./billing-dashboard";

/**
 * CFG-2 (Plano e Cobrança) + CFG-4 (Créditos e Uso) — Missão 6. CFG-1/3/5/6
 * ficam fora do escopo desta missão (perfil, tier, marcas, time).
 */
export default async function ConfiguracoesPage() {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership) {
    redirect("/painel");
  }

  const canManageBilling = hasMinimumRole(session.membership.role, "admin");

  if (!canManageBilling) {
    return (
      <EmptyState
        icon={Settings}
        title="Só quem administra a conta acessa Configurações"
        description="Peça para um administrador ou dono da organização gerenciar plano e créditos."
      />
    );
  }

  const db = await createClient();
  const subscriptionRepository = new SubscriptionRepository(db);
  const creditLedgerRepository = new CreditLedgerRepository(db);
  const planRepository = new PlanRepository(db);
  const creditPackageRepository = new CreditPackageRepository(db);

  const [subscription, balance, plans, creditPackages, history] = await Promise.all([
    subscriptionRepository.findByOrganizationId(session.organization.id),
    creditLedgerRepository.getBalance(session.organization.id),
    planRepository.findAllActive(),
    creditPackageRepository.findAllActive(),
    creditLedgerRepository.findByOrganizationId(session.organization.id, 30),
  ]);

  return (
    <BillingDashboard
      currentPlan={subscription?.plan ?? null}
      subscriptionStatus={subscription?.status ?? null}
      currentPeriodEnd={subscription?.current_period_end ?? null}
      balance={balance}
      plans={plans}
      creditPackages={creditPackages}
      history={history.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        createdAt: entry.created_at,
      }))}
    />
  );
}
