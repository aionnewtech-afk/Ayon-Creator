"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Dialog, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import type { OrganizationMemberRole, UserProfileStatus } from "@ayon/types";
import { removeMemberAction, resetUserPasswordAction, setUserStatusAction, updateMemberRoleAction } from "./actions";

export interface UserOverviewRowView {
  membershipId: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  role: OrganizationMemberRole;
  fullName: string | null;
  email: string | null;
  profileStatus: UserProfileStatus | null;
  lastSignInAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<OrganizationMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLES: OrganizationMemberRole[] = ["owner", "admin", "editor", "viewer"];

export interface UsersTableProps {
  rows: UserOverviewRowView[];
}

export function UsersTable({ rows }: UsersTableProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserOverviewRowView | null>(null);

  function handleRoleChange(row: UserOverviewRowView, role: OrganizationMemberRole) {
    startTransition(async () => {
      const result = await updateMemberRoleAction(row.membershipId, role);
      if (!result.ok) setError(result.error ?? "Não foi possível alterar o papel.");
    });
  }

  function toggleBlocked(row: UserOverviewRowView) {
    const nextStatus: UserProfileStatus = row.profileStatus === "blocked" ? "active" : "blocked";
    startTransition(async () => {
      const result = await setUserStatusAction(row.userId, row.organizationId, nextStatus);
      if (!result.ok) setError(result.error ?? "Não foi possível atualizar o usuário.");
    });
  }

  function handleResetPassword(row: UserOverviewRowView) {
    setError(null);
    setRecoveryLink(null);
    if (!row.email) {
      setError("Usuário sem e-mail conhecido.");
      return;
    }
    startTransition(async () => {
      const result = await resetUserPasswordAction(row.userId, row.organizationId, row.email!);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível gerar o link de redefinição.");
        return;
      }
      setRecoveryLink(result.data?.recoveryLink ?? null);
    });
  }

  function handleRemove() {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await removeMemberAction(removeTarget.membershipId, removeTarget.organizationId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover o usuário.");
        return;
      }
      setRemoveTarget(null);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Organização</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Último acesso</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.membershipId}>
              <TableCell className="font-medium text-foreground">
                {row.fullName ?? row.email ?? row.userId}
                {row.email ? <div className="text-xs text-muted-foreground">{row.email}</div> : null}
              </TableCell>
              <TableCell>{row.organizationName}</TableCell>
              <TableCell>
                <Select
                  className="h-8 w-32"
                  value={row.role}
                  disabled={pending}
                  onChange={(event) => handleRoleChange(row, event.target.value as OrganizationMemberRole)}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant={row.profileStatus === "blocked" ? "destructive" : "success"}>
                  {row.profileStatus === "blocked" ? "Bloqueado" : "Ativo"}
                </Badge>
              </TableCell>
              <TableCell>{row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString("pt-BR") : "Nunca"}</TableCell>
              <TableCell>{new Date(row.createdAt).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => toggleBlocked(row)}>
                    {row.profileStatus === "blocked" ? "Desbloquear" : "Bloquear"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => handleResetPassword(row)}>
                    Redefinir senha
                  </Button>
                  <Button size="sm" variant="destructive" disabled={pending} onClick={() => setRemoveTarget(row)}>
                    Remover
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={recoveryLink !== null} onClose={() => setRecoveryLink(null)} title="Link de redefinição de senha">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie este link ao usuário por um canal seguro — ele não é enviado automaticamente por e-mail.
          </p>
          <p className="break-all rounded-md border border-border bg-muted p-3 text-xs">{recoveryLink}</p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setRecoveryLink(null)}>
              Fechar
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={removeTarget !== null} onClose={() => setRemoveTarget(null)} title="Remover usuário">
        {removeTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Remover <strong>{removeTarget.fullName ?? removeTarget.email}</strong> de <strong>{removeTarget.organizationName}</strong>? A conta continua existindo, só perde acesso a esta organização.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRemoveTarget(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={handleRemove}>
                Remover
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
