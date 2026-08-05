"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import type { PlatformAdminRole, SubscriptionPlan, SubscriptionStatus } from "@ayon/types";
import { cancelMercadoPagoSubscriptionAction, syncMercadoPagoSubscriptionAction } from "./actions";

export interface MercadoPagoOverviewRowView {
  organizationId: string;
  organizationName: string;
  subscriptionId: string | null;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  billingProviderRef: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  purchasesCount: number;
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Em trial",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

function statusVariant(status: SubscriptionStatus | null): "success" | "warning" | "destructive" | "outline" {
  if (status === "active") return "success";
  if (status === "past_due") return "warning";
  if (status === "canceled") return "destructive";
  return "outline";
}

export interface MercadoPagoTableProps {
  rows: MercadoPagoOverviewRowView[];
  role: PlatformAdminRole;
}

export function MercadoPagoTable({ rows, role }: MercadoPagoTableProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = role === "super_admin";

  function handleSync(row: MercadoPagoOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await syncMercadoPagoSubscriptionAction(row.organizationId);
      if (!result.ok) setError(result.error ?? "Não foi possível sincronizar.");
    });
  }

  function handleCancel(row: MercadoPagoOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await cancelMercadoPagoSubscriptionAction(row.organizationId);
      if (!result.ok) setError(result.error ?? "Não foi possível cancelar a assinatura.");
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organização</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vínculo MP</TableHead>
            <TableHead>Período atual</TableHead>
            <TableHead>Compras avulsas</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.organizationId}>
              <TableCell className="font-medium text-foreground">{row.organizationName}</TableCell>
              <TableCell>{row.plan ? PLAN_LABELS[row.plan] : "—"}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(row.status)}>{row.status ? STATUS_LABELS[row.status] : "Sem assinatura"}</Badge>
              </TableCell>
              <TableCell>
                {row.billingProviderRef ? (
                  <span className="font-mono text-xs">{row.billingProviderRef}</span>
                ) : (
                  <span className="text-muted-foreground">Sem vínculo</span>
                )}
              </TableCell>
              <TableCell>
                {row.currentPeriodStart && row.currentPeriodEnd
                  ? `${new Date(row.currentPeriodStart).toLocaleDateString("pt-BR")} – ${new Date(row.currentPeriodEnd).toLocaleDateString("pt-BR")}`
                  : "—"}
              </TableCell>
              <TableCell>{row.purchasesCount}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={pending || !row.billingProviderRef} onClick={() => handleSync(row)}>
                    Sincronizar / reenviar webhook
                  </Button>
                  {isSuperAdmin && row.status && row.status !== "canceled" ? (
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => handleCancel(row)}>
                      Cancelar assinatura
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
