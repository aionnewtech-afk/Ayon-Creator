"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ayon/ui";
import type { CreditLedgerEntryType, SubscriptionPlan, SubscriptionStatus } from "@ayon/types";
import { PLAN_LABELS } from "@/config/plans";
import { buyCreditsAction, subscribeToPlanAction } from "./actions";

interface PlanRow {
  plan: SubscriptionPlan;
  max_brands: number;
  tier_included: string;
  monthly_credits: number;
  price_cents: number;
}

interface CreditPackageRow {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
}

interface LedgerEntryView {
  id: string;
  type: CreditLedgerEntryType;
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface BillingDashboardProps {
  currentPlan: SubscriptionPlan | null;
  subscriptionStatus: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  balance: number;
  plans: PlanRow[];
  creditPackages: CreditPackageRow[];
  history: LedgerEntryView[];
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  trialing: "Em teste (trial)",
};

const LEDGER_TYPE_LABELS: Record<CreditLedgerEntryType, string> = {
  grant_plan: "Créditos do plano",
  purchase: "Compra avulsa",
  consumption: "Consumo",
  adjustment: "Ajuste",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BillingDashboard({
  currentPlan,
  subscriptionStatus,
  currentPeriodEnd,
  balance,
  plans,
  creditPackages,
  history,
}: BillingDashboardProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: SubscriptionPlan) {
    setLoadingId(plan);
    setError(null);

    const response = await subscribeToPlanAction(plan);

    if (!response.ok || !response.initPoint) {
      setError(response.error ?? "Algo deu errado. Tenta de novo?");
      setLoadingId(null);
      return;
    }

    window.location.href = response.initPoint;
  }

  async function handleBuyCredits(creditPackageId: string) {
    setLoadingId(creditPackageId);
    setError(null);

    const response = await buyCreditsAction(creditPackageId);

    if (!response.ok || !response.initPoint) {
      setError(response.error ?? "Algo deu errado. Tenta de novo?");
      setLoadingId(null);
      return;
    }

    window.location.href = response.initPoint;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Plano, cobrança, créditos e uso.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Plano e Cobrança</h2>
        {subscriptionStatus ? (
          <p className="text-sm text-muted-foreground">
            Assinatura atual: <span className="font-medium text-foreground">{currentPlan ? PLAN_LABELS[currentPlan].label : "—"}</span> —{" "}
            {STATUS_LABELS[subscriptionStatus]}
            {currentPeriodEnd
              ? ` · renova em ${new Date(currentPeriodEnd).toLocaleDateString("pt-BR")}`
              : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa ainda — escolha um plano para começar.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.plan && subscriptionStatus === "active";
            return (
              <Card key={plan.plan}>
                <CardHeader>
                  <CardTitle className="text-base">{PLAN_LABELS[plan.plan].label}</CardTitle>
                  <CardDescription>{PLAN_LABELS[plan.plan].description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-lg font-semibold text-foreground">{formatBRL(plan.price_cents)}/mês</p>
                  <p className="text-muted-foreground">{plan.monthly_credits} créditos/mês</p>
                  <p className="text-muted-foreground">
                    {plan.max_brands} marca{plan.max_brands > 1 ? "s" : ""} · tier {plan.tier_included}
                  </p>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || loadingId === plan.plan}
                    onClick={() => handleSubscribe(plan.plan)}
                  >
                    {isCurrent ? "Plano atual" : loadingId === plan.plan ? "Redirecionando..." : "Assinar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Créditos e Uso</h2>
        <p className="text-sm text-muted-foreground">
          Saldo atual: <span className="font-medium text-foreground">{balance} créditos</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {creditPackages.map((creditPackage) => (
            <Card key={creditPackage.id}>
              <CardHeader>
                <CardTitle className="text-base">{creditPackage.name}</CardTitle>
                <CardDescription>{creditPackage.credits} créditos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-lg font-semibold text-foreground">{formatBRL(creditPackage.price_cents)}</p>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={loadingId === creditPackage.id}
                  onClick={() => handleBuyCredits(creditPackage.id)}
                >
                  {loadingId === creditPackage.id ? "Redirecionando..." : "Comprar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Descrição</th>
                  <th className="px-4 py-2 text-right font-medium">Créditos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-2 text-foreground">{LEDGER_TYPE_LABELS[entry.type]}</td>
                    <td className="px-4 py-2 text-muted-foreground">{entry.description ?? "—"}</td>
                    <td className={`px-4 py-2 text-right font-medium ${entry.amount >= 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {entry.amount >= 0 ? "+" : ""}
                      {entry.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
