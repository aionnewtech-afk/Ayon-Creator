"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge, Button, Dialog, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsList, TabsTrigger, Textarea } from "@ayon/ui";
import type { UserFeedbackCategory, UserFeedbackStatus } from "@ayon/types";
import { archiveFeedbackAction, deleteFeedbackAction, resolveFeedbackAction, respondFeedbackAction } from "./actions";

export interface FeedbackOverviewRowView {
  id: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  category: UserFeedbackCategory;
  description: string;
  pathname: string | null;
  status: UserFeedbackStatus;
  internalResponse: string | null;
  archivedAt: string | null;
  createdAt: string;
}

const CATEGORY_LABELS: Record<UserFeedbackCategory, string> = {
  suggestion: "Sugestão",
  bug: "Bug",
  difficulty: "Dificuldade de uso",
  other: "Outro",
};

const CATEGORY_FILTERS: Array<{ value: UserFeedbackCategory | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "suggestion", label: "Sugestão" },
  { value: "bug", label: "Bug" },
  { value: "difficulty", label: "Dificuldade" },
  { value: "other", label: "Outro" },
];

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: FeedbackOverviewRowView[]) {
  const header = ["id", "organizacao", "categoria", "status", "descricao", "pagina", "resposta_interna", "criado_em"];
  const lines = rows.map((row) =>
    [
      row.id,
      row.organizationName,
      CATEGORY_LABELS[row.category],
      row.status === "resolved" ? "Resolvido" : "Aberto",
      row.description,
      row.pathname ?? "",
      row.internalResponse ?? "",
      row.createdAt,
    ]
      .map((value) => csvEscape(String(value)))
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `feedbacks-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface FeedbacksTableProps {
  rows: FeedbackOverviewRowView[];
}

export function FeedbacksTable({ rows }: FeedbacksTableProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<UserFeedbackCategory | "all">("all");
  const [responseTarget, setResponseTarget] = useState<FeedbackOverviewRowView | null>(null);

  const filteredRows = useMemo(
    () => (categoryFilter === "all" ? rows : rows.filter((row) => row.category === categoryFilter)),
    [rows, categoryFilter],
  );

  function handleArchive(row: FeedbackOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await archiveFeedbackAction(row.id);
      if (!result.ok) setError(result.error ?? "Não foi possível arquivar.");
    });
  }

  function handleResolve(row: FeedbackOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await resolveFeedbackAction(row.id);
      if (!result.ok) setError(result.error ?? "Não foi possível marcar como resolvido.");
    });
  }

  function handleDelete(row: FeedbackOverviewRowView) {
    setError(null);
    startTransition(async () => {
      const result = await deleteFeedbackAction(row.id);
      if (!result.ok) setError(result.error ?? "Não foi possível excluir.");
    });
  }

  function handleRespondSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!responseTarget) return;
    const formData = new FormData(event.currentTarget);
    const response = String(formData.get("response") ?? "").trim();
    if (!response) {
      setError("Escreva uma resposta interna.");
      return;
    }
    startTransition(async () => {
      const result = await respondFeedbackAction(responseTarget.id, response);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar a resposta.");
        return;
      }
      setResponseTarget(null);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as UserFeedbackCategory | "all")}>
          <TabsList>
            {CATEGORY_FILTERS.map((filter) => (
              <TabsTrigger key={filter.value} value={filter.value}>
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button size="sm" variant="outline" onClick={() => downloadCsv(filteredRows)}>
          Exportar CSV
        </Button>
      </div>

      {filteredRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum feedback nesta categoria.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organização</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.organizationName}</TableCell>
                <TableCell>
                  <Badge variant="outline">{CATEGORY_LABELS[row.category]}</Badge>
                </TableCell>
                <TableCell className="max-w-sm">
                  <p className="truncate" title={row.description}>
                    {row.description}
                  </p>
                  {row.internalResponse ? <p className="text-xs text-muted-foreground">Resposta interna: {row.internalResponse}</p> : null}
                  {row.archivedAt ? <Badge variant="outline" className="mt-1">Arquivado</Badge> : null}
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === "resolved" ? "success" : "warning"}>{row.status === "resolved" ? "Resolvido" : "Aberto"}</Badge>
                </TableCell>
                <TableCell>{new Date(row.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => setResponseTarget(row)}>
                      Responder
                    </Button>
                    {row.status !== "resolved" ? (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => handleResolve(row)}>
                        Resolver
                      </Button>
                    ) : null}
                    {!row.archivedAt ? (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => handleArchive(row)}>
                        Arquivar
                      </Button>
                    ) : null}
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => handleDelete(row)}>
                      Excluir
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={responseTarget !== null} onClose={() => setResponseTarget(null)} title="Resposta interna">
        {responseTarget ? (
          <form onSubmit={handleRespondSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Nunca enviada ao usuário — só para triagem interna da equipe.</p>
            <Textarea name="response" rows={4} defaultValue={responseTarget.internalResponse ?? ""} required />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setResponseTarget(null)}>
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
