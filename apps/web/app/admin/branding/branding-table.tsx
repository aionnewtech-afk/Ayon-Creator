"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import { updateBrandAdminAction } from "./actions";

export interface BrandOverviewRowView {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  logoStoragePath: string | null;
  logoUrl: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  fontFamily: string | null;
  visualStyle: string | null;
}

export interface BrandingTableProps {
  rows: BrandOverviewRowView[];
}

export function BrandingTable({ rows }: BrandingTableProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrandOverviewRowView | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateBrandAdminAction(editing.id, editing.organizationId, formData);
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
            <TableHead>Logo</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Organização</TableHead>
            <TableHead>Cores</TableHead>
            <TableHead>Fonte</TableHead>
            <TableHead>Estilo</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                {row.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.logoUrl} alt={`Logo de ${row.name}`} className="h-8 w-8 rounded object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">Sem logo</span>
                )}
              </TableCell>
              <TableCell className="font-medium text-foreground">{row.name}</TableCell>
              <TableCell>{row.organizationName}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {row.primaryColorHex ? <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: row.primaryColorHex }} title={row.primaryColorHex} /> : null}
                  {row.secondaryColorHex ? <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: row.secondaryColorHex }} title={row.secondaryColorHex} /> : null}
                  {!row.primaryColorHex && !row.secondaryColorHex ? <span className="text-xs text-muted-foreground">—</span> : null}
                </div>
              </TableCell>
              <TableCell>{row.fontFamily ?? "—"}</TableCell>
              <TableCell>{row.visualStyle ?? "—"}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(row)}>
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Editar — ${editing.name}` : ""}>
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="logo">Logo (opcional, até 5MB)</Label>
              <Input id="logo" name="logo" type="file" accept="image/*" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="primaryColorHex">Cor primária</Label>
                <Input id="primaryColorHex" name="primaryColorHex" type="text" placeholder="#RRGGBB" defaultValue={editing.primaryColorHex ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secondaryColorHex">Cor secundária</Label>
                <Input id="secondaryColorHex" name="secondaryColorHex" type="text" placeholder="#RRGGBB" defaultValue={editing.secondaryColorHex ?? ""} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fontFamily">Fonte</Label>
              <Input id="fontFamily" name="fontFamily" defaultValue={editing.fontFamily ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visualStyle">Estilo visual</Label>
              <Input id="visualStyle" name="visualStyle" defaultValue={editing.visualStyle ?? ""} />
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
