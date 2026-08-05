"use client";

import { useState } from "react";
import { Badge, Button, Dialog, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import type { PlatformAdminRole } from "@ayon/types";

export interface AuditLogOverviewRowView {
  id: string;
  actorUserId: string;
  actorEmail: string | null;
  actorRole: PlatformAdminRole;
  organizationId: string | null;
  organizationName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<PlatformAdminRole, string> = {
  super_admin: "Super Admin",
  support_admin: "Support Admin",
};

export interface AuditLogTableProps {
  rows: AuditLogOverviewRowView[];
}

export function AuditLogTable({ rows }: AuditLogTableProps) {
  const [detailTarget, setDetailTarget] = useState<AuditLogOverviewRowView | null>(null);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Organização</TableHead>
            <TableHead>Quando</TableHead>
            <TableHead>Detalhe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">{row.actorEmail ?? row.actorUserId}</TableCell>
              <TableCell>
                <Badge variant="outline">{ROLE_LABELS[row.actorRole]}</Badge>
              </TableCell>
              <TableCell>{row.action}</TableCell>
              <TableCell>
                {row.entityType}
                {row.entityId ? <span className="text-xs text-muted-foreground"> #{row.entityId.slice(0, 8)}</span> : null}
              </TableCell>
              <TableCell>{row.organizationName ?? "—"}</TableCell>
              <TableCell>{new Date(row.createdAt).toLocaleString("pt-BR")}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => setDetailTarget(row)}>
                  Ver histórico
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={detailTarget !== null} onClose={() => setDetailTarget(null)} title="Detalhe da ação">
        {detailTarget ? (
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-foreground">IP: </span>
              <span className="text-muted-foreground">{detailTarget.ipAddress ?? "—"}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">User-Agent: </span>
              <span className="break-all text-muted-foreground">{detailTarget.userAgent ?? "—"}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Antes:</span>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-muted p-2 text-xs">
                {detailTarget.before ? JSON.stringify(detailTarget.before, null, 2) : "—"}
              </pre>
            </div>
            <div>
              <span className="font-medium text-foreground">Depois:</span>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-muted p-2 text-xs">
                {detailTarget.after ? JSON.stringify(detailTarget.after, null, 2) : "—"}
              </pre>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
