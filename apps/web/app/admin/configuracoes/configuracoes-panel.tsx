"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Dialog, Input, Label, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import type { CreditPricingStatus, Database, PlatformAdminRole } from "@ayon/types";
import { CREDIT_PRICING_STATUSES, PLATFORM_ADMIN_ROLES } from "@ayon/types";
import { createPlatformAdminAction, revokePlatformAdminAction, toggleFeatureFlagAction, updateCreditPricingAction } from "./actions";

type CreditPricingRow = Database["public"]["Tables"]["credit_pricing"]["Row"];
type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];

export interface PlatformAdminOverviewRowView {
  id: string;
  userId: string;
  email: string | null;
  role: PlatformAdminRole;
  grantedByEmail: string | null;
  grantedAt: string;
}

const TIER_LABELS: Record<string, string> = {
  economico: "Econômico",
  balanceado: "Balanceado",
  premium: "Premium",
};

const ROLE_LABELS: Record<PlatformAdminRole, string> = {
  super_admin: "Super Admin",
  support_admin: "Support Admin",
};

export interface ConfiguracoesPanelProps {
  creditPricing: CreditPricingRow[];
  featureFlags: FeatureFlagRow[];
  platformAdmins: PlatformAdminOverviewRowView[];
}

export function ConfiguracoesPanel({ creditPricing, featureFlags, platformAdmins }: ConfiguracoesPanelProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingPricing, setEditingPricing] = useState<CreditPricingRow | null>(null);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  function handleCreateAdminSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role")) as PlatformAdminRole;
    if (!email) {
      setError("Informe um e-mail.");
      return;
    }
    startTransition(async () => {
      const result = await createPlatformAdminAction(email, role);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível criar o administrador.");
        return;
      }
      setCreatingAdmin(false);
    });
  }

  function handleRevokeAdmin(admin: PlatformAdminOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await revokePlatformAdminAction(admin.id);
      if (!result.ok) setError(result.error ?? "Não foi possível revogar o acesso.");
    });
  }

  function handlePricingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPricing) return;
    const formData = new FormData(event.currentTarget);
    const credits = Number(formData.get("credits"));
    const status = String(formData.get("status")) as CreditPricingStatus;

    startTransition(async () => {
      const result = await updateCreditPricingAction(editingPricing.id, credits, status);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar.");
        return;
      }
      setEditingPricing(null);
    });
  }

  function handleToggleFlag(flag: FeatureFlagRow) {
    setError(null);
    startTransition(async () => {
      const result = await toggleFeatureFlagAction(flag.id, !flag.enabled);
      if (!result.ok) setError(result.error ?? "Não foi possível atualizar a flag.");
    });
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Preço em créditos por ação</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motivo</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creditPricing.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.trigger_reason}</TableCell>
                <TableCell>{TIER_LABELS[row.tier] ?? row.tier}</TableCell>
                <TableCell>{row.credits}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "success" : "outline"}>{row.status === "active" ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditingPricing(row)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Flags de recurso</h2>
        {featureFlags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma flag cadastrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureFlags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-medium text-foreground">{flag.key}</TableCell>
                  <TableCell>{flag.description ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={flag.enabled ? "success" : "outline"}>{flag.enabled ? "Ativa" : "Desativada"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => handleToggleFlag(flag)}>
                      {flag.enabled ? "Desativar" : "Ativar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Administradores da plataforma</h2>
          <Button size="sm" disabled={pending} onClick={() => setCreatingAdmin(true)}>
            Criar admin
          </Button>
        </div>
        {platformAdmins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum administrador cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Concedido por</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platformAdmins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium text-foreground">{admin.email ?? admin.userId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABELS[admin.role]}</Badge>
                  </TableCell>
                  <TableCell>{admin.grantedByEmail ?? "—"}</TableCell>
                  <TableCell>{new Date(admin.grantedAt).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => handleRevokeAdmin(admin)}>
                      Revogar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-dashed border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Outras configurações</h2>
        <p className="text-sm text-muted-foreground">
          Planos (preço/créditos/limites) e Providers (ativar/desativar/credenciais) têm telas administrativas dedicadas — menu ADMIN.
        </p>
      </section>

      <Dialog open={creatingAdmin} onClose={() => setCreatingAdmin(false)} title="Criar administrador">
        <form onSubmit={handleCreateAdminSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">O usuário precisa já ter uma conta na plataforma — isto não cria uma conta nova.</p>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Papel</Label>
            <Select id="role" name="role" defaultValue="support_admin">
              {PLATFORM_ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreatingAdmin(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Criar
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={editingPricing !== null} onClose={() => setEditingPricing(null)} title={editingPricing ? `Editar — ${editingPricing.trigger_reason} (${TIER_LABELS[editingPricing.tier] ?? editingPricing.tier})` : ""}>
        {editingPricing ? (
          <form onSubmit={handlePricingSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="credits">Créditos</Label>
              <Input id="credits" name="credits" type="number" defaultValue={editingPricing.credits} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={editingPricing.status}>
                {CREDIT_PRICING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === "active" ? "Ativo" : "Inativo"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditingPricing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
