"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Dialog,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ayon/ui";
import type { OrganizationStatus, PlatformAdminRole, SubscriptionPlan } from "@ayon/types";
import { startImpersonationAction } from "@/lib/impersonation-actions";
import {
  adjustOrganizationCreditsAction,
  cancelTrialAction,
  changeOrganizationPlanAction,
  deleteOrganizationAction,
  renewTrialAction,
  updateOrganizationAction,
} from "./actions";

export interface OrganizationOverviewRowView {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  isPlatformAccount: boolean;
  createdAt: string;
  plan: SubscriptionPlan | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  creditsBalance: number;
  creditsConsumedThisMonth: number;
  campaignsCount: number;
  videosCount: number;
  imagesCount: number;
  lastActivityAt: string | null;
}

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const PLANS: SubscriptionPlan[] = ["starter", "pro", "business"];

type DialogState =
  | { type: "edit"; organizationId: string }
  | { type: "plan"; organizationId: string }
  | { type: "credits"; organizationId: string }
  | { type: "trial"; organizationId: string }
  | { type: "delete"; organizationId: string }
  | null;

export interface OrganizationsTableProps {
  rows: OrganizationOverviewRowView[];
  role: PlatformAdminRole;
}

export function OrganizationsTable({ rows, role }: OrganizationsTableProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = role === "super_admin";

  const activeOrganization = dialog ? rows.find((row) => row.id === dialog.organizationId) ?? null : null;

  function closeDialog() {
    setDialog(null);
    setError(null);
  }

  function toggleBlocked(row: OrganizationOverviewRowView) {
    const nextStatus: OrganizationStatus = row.status === "active" ? "blocked" : "active";
    startTransition(async () => {
      const result = await updateOrganizationAction(row.id, { status: nextStatus });
      if (!result.ok) setError(result.error ?? "Não foi possível atualizar a organização.");
    });
  }

  function handleImpersonate(row: OrganizationOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await startImpersonationAction(row.id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível iniciar a impersonação.");
        return;
      }
      router.push("/painel");
      router.refresh();
    });
  }

  function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrganization) return;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      setError("Nome não pode ficar vazio.");
      return;
    }
    startTransition(async () => {
      const result = await updateOrganizationAction(activeOrganization.id, { name });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar.");
        return;
      }
      closeDialog();
    });
  }

  function handlePlanSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrganization) return;
    const formData = new FormData(event.currentTarget);
    const plan = String(formData.get("plan") ?? "") as SubscriptionPlan;
    startTransition(async () => {
      const result = await changeOrganizationPlanAction(activeOrganization.id, plan);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível trocar o plano.");
        return;
      }
      closeDialog();
    });
  }

  function handleCreditsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrganization) return;
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    const description = String(formData.get("description") ?? "").trim();
    if (!description) {
      setError("Descreva o motivo do ajuste.");
      return;
    }
    startTransition(async () => {
      const result = await adjustOrganizationCreditsAction(activeOrganization.id, amount, description);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível ajustar os créditos.");
        return;
      }
      closeDialog();
    });
  }

  function handleRenewTrial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrganization) return;
    const formData = new FormData(event.currentTarget);
    const days = Number(formData.get("days"));
    startTransition(async () => {
      const result = await renewTrialAction(activeOrganization.id, days);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível renovar o trial.");
        return;
      }
      closeDialog();
    });
  }

  function handleCancelTrial() {
    if (!activeOrganization) return;
    startTransition(async () => {
      const result = await cancelTrialAction(activeOrganization.id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível cancelar o trial.");
        return;
      }
      closeDialog();
    });
  }

  function handleDelete() {
    if (!activeOrganization) return;
    startTransition(async () => {
      const result = await deleteOrganizationAction(activeOrganization.id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível excluir a organização.");
        return;
      }
      closeDialog();
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organização</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Créditos</TableHead>
            <TableHead>Consumo do mês</TableHead>
            <TableHead>Campanhas</TableHead>
            <TableHead>Vídeos</TableHead>
            <TableHead>Imagens</TableHead>
            <TableHead>Última atividade</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">
                {row.name}
                {row.isPlatformAccount ? (
                  <Badge variant="outline" className="ml-2">
                    Casa
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge variant={row.status === "active" ? "success" : "destructive"}>
                  {row.status === "active" ? "Ativa" : "Bloqueada"}
                </Badge>
              </TableCell>
              <TableCell>{row.plan ? PLAN_LABELS[row.plan] : "—"}</TableCell>
              <TableCell>{row.creditsBalance.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{row.creditsConsumedThisMonth.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{row.campaignsCount}</TableCell>
              <TableCell>{row.videosCount}</TableCell>
              <TableCell>{row.imagesCount}</TableCell>
              <TableCell>{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
              <TableCell>{new Date(row.createdAt).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setDialog({ type: "edit", organizationId: row.id })}>
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => toggleBlocked(row)}>
                    {row.status === "active" ? "Bloquear" : "Desbloquear"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setDialog({ type: "plan", organizationId: row.id })}>
                    Plano
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setDialog({ type: "credits", organizationId: row.id })}>
                    Créditos
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setDialog({ type: "trial", organizationId: row.id })}>
                    Trial
                  </Button>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => handleImpersonate(row)}>
                    Entrar como organização
                  </Button>
                  {isSuperAdmin ? (
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => setDialog({ type: "delete", organizationId: row.id })}>
                      Excluir
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialog?.type === "edit"} onClose={closeDialog} title="Editar organização">
        {activeOrganization ? (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={activeOrganization.name} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog open={dialog?.type === "plan"} onClose={closeDialog} title="Alterar plano">
        {activeOrganization ? (
          <form onSubmit={handlePlanSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan">Plano</Label>
              <Select id="plan" name="plan" defaultValue={activeOrganization.plan ?? "starter"}>
                {PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {PLAN_LABELS[plan]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog open={dialog?.type === "credits"} onClose={closeDialog} title="Ajustar créditos">
        {activeOrganization ? (
          <form onSubmit={handleCreditsSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Saldo atual: {activeOrganization.creditsBalance.toLocaleString("pt-BR")} créditos</p>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Quantidade (negativo remove)</Label>
              <Input id="amount" name="amount" type="number" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Motivo</Label>
              <Input id="description" name="description" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Ajustar
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog open={dialog?.type === "trial"} onClose={closeDialog} title="Trial">
        {activeOrganization ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Status atual: {activeOrganization.subscriptionStatus ?? "—"}
              {activeOrganization.trialEndsAt ? ` · expira em ${new Date(activeOrganization.trialEndsAt).toLocaleDateString("pt-BR")}` : ""}
            </p>
            <form onSubmit={handleRenewTrial} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="days">Renovar por (dias)</Label>
                <Input id="days" name="days" type="number" defaultValue={14} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={pending} onClick={handleCancelTrial}>
                  Cancelar trial
                </Button>
                <Button type="submit" disabled={pending}>
                  Renovar
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </Dialog>

      <Dialog open={dialog?.type === "delete"} onClose={closeDialog} title="Excluir organização">
        {activeOrganization ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Tem certeza que deseja excluir <strong>{activeOrganization.name}</strong>? Esta ação pode ser desfeita apenas por acesso direto ao banco (soft delete).
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
                Excluir
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
