"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Dialog, Input, Label, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import type { SubscriptionPlan, SubscriptionStatus } from "@ayon/types";
import { cancelTrialAction, convertTrialToActiveAction, createTrialAction, renewTrialAction } from "./actions";

export interface TrialOverviewRowView {
  organizationId: string;
  organizationName: string;
  subscriptionId: string | null;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
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

const PLANS: SubscriptionPlan[] = ["starter", "pro", "business"];

function statusBadgeVariant(row: TrialOverviewRowView): "success" | "warning" | "destructive" | "outline" {
  if (row.status !== "trialing") return row.status === "active" ? "success" : "outline";
  if (row.daysRemaining === null) return "outline";
  if (row.daysRemaining < 0) return "destructive";
  if (row.daysRemaining <= 3) return "warning";
  return "success";
}

export interface TrialsTableProps {
  rows: TrialOverviewRowView[];
}

export function TrialsTable({ rows }: TrialsTableProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createTarget, setCreateTarget] = useState<TrialOverviewRowView | null>(null);
  const [renewTarget, setRenewTarget] = useState<TrialOverviewRowView | null>(null);

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createTarget) return;
    const formData = new FormData(event.currentTarget);
    const plan = String(formData.get("plan")) as SubscriptionPlan;
    const days = Number(formData.get("days"));
    startTransition(async () => {
      const result = await createTrialAction(createTarget.organizationId, plan, days);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível criar o trial.");
        return;
      }
      setCreateTarget(null);
    });
  }

  function handleRenewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renewTarget) return;
    const formData = new FormData(event.currentTarget);
    const days = Number(formData.get("days"));
    startTransition(async () => {
      const result = await renewTrialAction(renewTarget.organizationId, days);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível renovar o trial.");
        return;
      }
      setRenewTarget(null);
    });
  }

  function handleCancel(row: TrialOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await cancelTrialAction(row.organizationId);
      if (!result.ok) setError(result.error ?? "Não foi possível cancelar o trial.");
    });
  }

  function handleConvert(row: TrialOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await convertTrialToActiveAction(row.organizationId);
      if (!result.ok) setError(result.error ?? "Não foi possível converter em assinatura.");
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
            <TableHead>Expira em</TableHead>
            <TableHead>Dias restantes</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.organizationId}>
              <TableCell className="font-medium text-foreground">{row.organizationName}</TableCell>
              <TableCell>{row.plan ? PLAN_LABELS[row.plan] : "—"}</TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(row)}>{row.status ? STATUS_LABELS[row.status] : "Sem assinatura"}</Badge>
              </TableCell>
              <TableCell>{row.trialEndsAt ? new Date(row.trialEndsAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
              <TableCell>{row.daysRemaining !== null ? row.daysRemaining : "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {!row.subscriptionId ? (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => setCreateTarget(row)}>
                      Criar trial
                    </Button>
                  ) : null}
                  {row.status === "trialing" ? (
                    <>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => setRenewTarget(row)}>
                        Renovar
                      </Button>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => handleConvert(row)}>
                        Converter em assinatura
                      </Button>
                      <Button size="sm" variant="destructive" disabled={pending} onClick={() => handleCancel(row)}>
                        Cancelar
                      </Button>
                    </>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={createTarget !== null} onClose={() => setCreateTarget(null)} title="Criar trial">
        {createTarget ? (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan">Plano</Label>
              <Select id="plan" name="plan" defaultValue="starter">
                {PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {PLAN_LABELS[plan]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="days">Duração (dias)</Label>
              <Input id="days" name="days" type="number" defaultValue={14} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreateTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Criar
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog open={renewTarget !== null} onClose={() => setRenewTarget(null)} title="Renovar trial">
        {renewTarget ? (
          <form onSubmit={handleRenewSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="renew-days">Renovar por (dias)</Label>
              <Input id="renew-days" name="days" type="number" defaultValue={14} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenewTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Renovar
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
