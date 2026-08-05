"use client";

import { useMemo, useState } from "react";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsList, TabsTrigger } from "@ayon/ui";

export interface LogEntryView {
  id: string;
  source: "pipeline" | "audit" | "provider" | "payment";
  timestamp: string;
  summary: string;
  status: "ok" | "error" | "info";
  detail: string;
}

const SOURCE_FILTERS: Array<{ value: LogEntryView["source"] | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pipeline", label: "Pipelines" },
  { value: "audit", label: "Auditoria" },
  { value: "provider", label: "Providers" },
  { value: "payment", label: "Pagamentos" },
];

const SOURCE_LABELS: Record<LogEntryView["source"], string> = {
  pipeline: "Pipeline",
  audit: "Auditoria",
  provider: "Provider",
  payment: "Pagamento",
};

function statusVariant(status: LogEntryView["status"]): "success" | "destructive" | "outline" {
  if (status === "error") return "destructive";
  if (status === "ok") return "success";
  return "outline";
}

export interface LogsTableProps {
  entries: LogEntryView[];
}

export function LogsTable({ entries }: LogsTableProps) {
  const [sourceFilter, setSourceFilter] = useState<LogEntryView["source"] | "all">("all");

  const filteredEntries = useMemo(
    () => (sourceFilter === "all" ? entries : entries.filter((entry) => entry.source === sourceFilter)),
    [entries, sourceFilter],
  );

  return (
    <div className="space-y-4">
      <Tabs value={sourceFilter} onValueChange={(value) => setSourceFilter(value as LogEntryView["source"] | "all")}>
        <TabsList>
          {SOURCE_FILTERS.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filteredEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento nesta categoria.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fonte</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Detalhe</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Quando</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.map((entry) => (
              <TableRow key={`${entry.source}-${entry.id}`}>
                <TableCell>
                  <Badge variant="outline">{SOURCE_LABELS[entry.source]}</Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground">{entry.summary}</TableCell>
                <TableCell className="max-w-sm truncate text-muted-foreground" title={entry.detail}>
                  {entry.detail}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                </TableCell>
                <TableCell>{new Date(entry.timestamp).toLocaleString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
