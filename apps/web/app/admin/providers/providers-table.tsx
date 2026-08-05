"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Dialog, Input, Label, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import type { PlatformAdminRole, ProviderConfigStatus } from "@ayon/types";
import { PROVIDER_CONFIG_STATUSES } from "@ayon/types";
import { updateProviderConfigAction } from "./actions";

export interface ProviderConfigRowView {
  id: string;
  capability: string;
  tier: string;
  providerKey: string;
  priority: number;
  status: ProviderConfigStatus;
  hasCredentialValue: boolean;
  observability: {
    callsCount: number;
    errorCount: number;
    availabilityPercent: number;
    avgLatencyMs: number | null;
    totalCostEstimateCredits: number;
  } | null;
}

const STATUS_LABELS: Record<ProviderConfigStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  error: "Erro",
  maintenance: "Manutenção",
};

function statusVariant(status: ProviderConfigStatus): "success" | "warning" | "destructive" | "outline" {
  if (status === "active") return "success";
  if (status === "maintenance") return "warning";
  if (status === "error") return "destructive";
  return "outline";
}

export interface ProvidersTableProps {
  configs: ProviderConfigRowView[];
  role: PlatformAdminRole;
}

export function ProvidersTable({ configs, role }: ProvidersTableProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProviderConfigRowView | null>(null);
  const isSuperAdmin = role === "super_admin";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const formData = new FormData(event.currentTarget);
    const status = String(formData.get("status")) as ProviderConfigStatus;
    const priority = Number(formData.get("priority"));
    const credentialValue = String(formData.get("credential_value") ?? "").trim();

    startTransition(async () => {
      const result = await updateProviderConfigAction(editing.id, {
        status,
        priority,
        ...(credentialValue ? { credentialValue } : {}),
      });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar.");
        return;
      }
      setEditing(null);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Capability</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Chamadas</TableHead>
            <TableHead>Disponibilidade</TableHead>
            <TableHead>Latência média</TableHead>
            <TableHead>Custo estimado</TableHead>
            {isSuperAdmin ? <TableHead>Ações</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs.map((config) => (
            <TableRow key={config.id}>
              <TableCell className="font-medium text-foreground">{config.capability}</TableCell>
              <TableCell>{config.tier}</TableCell>
              <TableCell>{config.providerKey}</TableCell>
              <TableCell>{config.priority}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(config.status)}>{STATUS_LABELS[config.status]}</Badge>
              </TableCell>
              <TableCell>{config.observability?.callsCount ?? 0}</TableCell>
              <TableCell>{config.observability ? `${config.observability.availabilityPercent.toFixed(1)}%` : "—"}</TableCell>
              <TableCell>{config.observability?.avgLatencyMs !== null && config.observability?.avgLatencyMs !== undefined ? `${config.observability.avgLatencyMs} ms` : "—"}</TableCell>
              <TableCell>{config.observability?.totalCostEstimateCredits.toLocaleString("pt-BR") ?? 0}</TableCell>
              {isSuperAdmin ? (
                <TableCell>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(config)}>
                    Editar
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Editar — ${editing.providerKey}` : ""}>
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={editing.status}>
                {PROVIDER_CONFIG_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Prioridade (maior = preferido para esta capability+tier)</Label>
              <Input id="priority" name="priority" type="number" defaultValue={editing.priority} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="credential_value">
                Credencial {editing.hasCredentialValue ? "(já configurada — deixe vazio para manter)" : "(nunca configurada — usa .env por enquanto)"}
              </Label>
              <Input id="credential_value" name="credential_value" type="password" placeholder="Nova API key (opcional)" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
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
