"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Dialog, Input, Label, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import type { Database, PlanStatus, ProviderTier, SubscriptionPlan } from "@ayon/types";
import { PLAN_STATUSES, PROVIDER_TIERS } from "@ayon/types";
import { updatePlanAction } from "./actions";

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const TIER_LABELS: Record<ProviderTier, string> = {
  economico: "Econômico",
  balanceado: "Balanceado",
  premium: "Premium",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FLAG_FIELDS: Array<{ key: keyof PlanRow; label: string }> = [
  { key: "priority_queue", label: "Fila prioritária" },
  { key: "allow_ai_video", label: "Vídeo com IA" },
  { key: "allow_api", label: "Acesso à API" },
  { key: "allow_brand_customization", label: "Personalização de marca" },
  { key: "allow_team", label: "Time (multiusuário)" },
  { key: "allow_white_label", label: "White label" },
];

export interface PlansTableProps {
  plans: PlanRow[];
}

export function PlansTable({ plans }: PlansTableProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanRow | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const formData = new FormData(event.currentTarget);

    const numberOrNull = (key: string): number | null => {
      const raw = formData.get(key);
      if (raw === null || raw === "") return null;
      return Number(raw);
    };

    const patch = {
      price_cents: Number(formData.get("price_cents")),
      monthly_credits: Number(formData.get("monthly_credits")),
      max_brands: Number(formData.get("max_brands")),
      tier_included: String(formData.get("tier_included")) as ProviderTier,
      status: String(formData.get("status")) as PlanStatus,
      max_users: numberOrNull("max_users"),
      max_campaigns: numberOrNull("max_campaigns"),
      max_monthly_videos: numberOrNull("max_monthly_videos"),
      max_monthly_images: numberOrNull("max_monthly_images"),
      storage_gb: numberOrNull("storage_gb"),
      priority_queue: formData.get("priority_queue") === "on",
      allow_ai_video: formData.get("allow_ai_video") === "on",
      allow_api: formData.get("allow_api") === "on",
      allow_brand_customization: formData.get("allow_brand_customization") === "on",
      allow_team: formData.get("allow_team") === "on",
      allow_white_label: formData.get("allow_white_label") === "on",
    };

    startTransition(async () => {
      const result = await updatePlanAction(editing.plan, patch);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar o plano.");
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
            <TableHead>Plano</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Créditos/mês</TableHead>
            <TableHead>Marcas</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.plan}>
              <TableCell className="font-medium text-foreground">{PLAN_LABELS[plan.plan]}</TableCell>
              <TableCell>{formatBRL(plan.price_cents)}</TableCell>
              <TableCell>{plan.monthly_credits.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{plan.max_brands}</TableCell>
              <TableCell>{TIER_LABELS[plan.tier_included]}</TableCell>
              <TableCell>
                <Badge variant={plan.status === "active" ? "success" : "outline"}>
                  {plan.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(plan)}>
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Editar plano — ${PLAN_LABELS[editing.plan]}` : ""}>
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price_cents">Preço (centavos)</Label>
                <Input id="price_cents" name="price_cents" type="number" defaultValue={editing.price_cents} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monthly_credits">Créditos/mês</Label>
                <Input id="monthly_credits" name="monthly_credits" type="number" defaultValue={editing.monthly_credits} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_brands">Marcas inclusas</Label>
                <Input id="max_brands" name="max_brands" type="number" defaultValue={editing.max_brands} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tier_included">Tier incluso</Label>
                <Select id="tier_included" name="tier_included" defaultValue={editing.tier_included}>
                  {PROVIDER_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {TIER_LABELS[tier]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={editing.status}>
                  {PLAN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status === "active" ? "Ativo" : "Inativo"}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="storage_gb">Storage (GB, vazio = sem limite)</Label>
                <Input id="storage_gb" name="storage_gb" type="number" defaultValue={editing.storage_gb ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_users">Usuários (vazio = sem limite)</Label>
                <Input id="max_users" name="max_users" type="number" defaultValue={editing.max_users ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_campaigns">Campanhas/mês (vazio = sem limite)</Label>
                <Input id="max_campaigns" name="max_campaigns" type="number" defaultValue={editing.max_campaigns ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_monthly_videos">Vídeos/mês (vazio = sem limite)</Label>
                <Input id="max_monthly_videos" name="max_monthly_videos" type="number" defaultValue={editing.max_monthly_videos ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_monthly_images">Imagens/mês (vazio = sem limite)</Label>
                <Input id="max_monthly_images" name="max_monthly_images" type="number" defaultValue={editing.max_monthly_images ?? ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Flags de recurso</Label>
              <div className="grid grid-cols-2 gap-2">
                {FLAG_FIELDS.map((flag) => (
                  <label key={String(flag.key)} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" name={String(flag.key)} defaultChecked={Boolean(editing[flag.key])} className="h-4 w-4 rounded border-input" />
                    {flag.label}
                  </label>
                ))}
              </div>
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
