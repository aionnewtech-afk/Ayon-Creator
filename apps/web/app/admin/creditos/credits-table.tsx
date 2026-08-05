"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Dialog, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import type { CreditLedgerEntryType, Database } from "@ayon/types";
import { adjustCreditsAction, getCreditHistoryAction } from "./actions";

export interface CreditsOverviewRowView {
  organizationId: string;
  organizationName: string;
  balance: number;
  totalGranted: number;
  totalPurchased: number;
  totalConsumed: number;
  totalAdjusted: number;
  lastEntryAt: string | null;
}

type LedgerEntry = Database["public"]["Tables"]["credit_ledger"]["Row"];

const TYPE_LABELS: Record<CreditLedgerEntryType, string> = {
  grant_plan: "Concessão do plano",
  purchase: "Compra",
  consumption: "Consumo",
  adjustment: "Ajuste manual",
};

export interface CreditsTableProps {
  rows: CreditsOverviewRowView[];
}

export function CreditsTable({ rows }: CreditsTableProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<CreditsOverviewRowView | null>(null);
  const [historyTarget, setHistoryTarget] = useState<CreditsOverviewRowView | null>(null);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  function handleAdjustSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustTarget) return;
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    const description = String(formData.get("description") ?? "").trim();
    if (!description) {
      setError("Descreva o motivo do ajuste.");
      return;
    }
    startTransition(async () => {
      const result = await adjustCreditsAction(adjustTarget.organizationId, amount, description);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível ajustar os créditos.");
        return;
      }
      setAdjustTarget(null);
    });
  }

  function openHistory(row: CreditsOverviewRowView) {
    setError(null);
    setHistoryTarget(row);
    setHistoryLoading(true);
    setHistory([]);
    startTransition(async () => {
      const result = await getCreditHistoryAction(row.organizationId);
      setHistoryLoading(false);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível carregar o histórico.");
        return;
      }
      setHistory(result.entries ?? []);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organização</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Concedido (plano)</TableHead>
            <TableHead>Comprado</TableHead>
            <TableHead>Consumido</TableHead>
            <TableHead>Ajustes</TableHead>
            <TableHead>Última movimentação</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.organizationId}>
              <TableCell className="font-medium text-foreground">{row.organizationName}</TableCell>
              <TableCell>
                <Badge variant={row.balance >= 0 ? "success" : "destructive"}>{row.balance.toLocaleString("pt-BR")}</Badge>
              </TableCell>
              <TableCell>{row.totalGranted.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{row.totalPurchased.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{row.totalConsumed.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{row.totalAdjusted.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{row.lastEntryAt ? new Date(row.lastEntryAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => openHistory(row)}>
                    Histórico
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setAdjustTarget(row)}>
                    Ajustar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={adjustTarget !== null} onClose={() => setAdjustTarget(null)} title="Ajustar créditos">
        {adjustTarget ? (
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {adjustTarget.organizationName} — saldo atual: {adjustTarget.balance.toLocaleString("pt-BR")} créditos
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Quantidade (negativo remove)</Label>
              <Input id="amount" name="amount" type="number" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Motivo</Label>
              <Input id="description" name="description" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdjustTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Ajustar
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog open={historyTarget !== null} onClose={() => setHistoryTarget(null)} title={historyTarget ? `Histórico — ${historyTarget.organizationName}` : ""}>
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div>
                  <p className="font-medium text-foreground">{TYPE_LABELS[entry.type]}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("pt-BR")}
                    {entry.description ? ` — ${entry.description}` : ""}
                  </p>
                </div>
                <span className={entry.amount >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {entry.amount >= 0 ? "+" : ""}
                  {entry.amount.toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
