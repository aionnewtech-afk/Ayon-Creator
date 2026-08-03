"use client";

import { useState } from "react";
import type { SynthesisFieldEntry } from "@ayon/core";
import { Button, Card, CardContent, Textarea } from "@ayon/ui";

export interface SynthesisFieldCardProps {
  field: SynthesisFieldEntry;
  onSave: (
    questionKey: SynthesisFieldEntry["questionKey"],
    value: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Um campo do "O que eu entendi até agora" (ONB-3) / Perfil da Marca (ONB-4):
 * a síntese da Ayon + a citação original como lastro (ux-design.md §4.2) —
 * sempre editável, nunca travado (Princípio do Consultor Permanente, §1.1,
 * item 1 — nem depois de confirmado isso vira um formulário rígido).
 */
export function SynthesisFieldCard({ field, onSave }: SynthesisFieldCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await onSave(field.questionKey, draft);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
    } else {
      setError(result.error ?? "Não consegui salvar agora.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{field.label}</h3>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(field.value ?? "");
                  setEditing(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : field.value ? (
          <p className="text-sm text-foreground">{field.value}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Ainda não preenchido — pode editar quando quiser.</p>
        )}

        {field.quote && !editing ? (
          <p className="border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
            &quot;{field.quote}&quot;
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
