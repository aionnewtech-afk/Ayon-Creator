"use client";

import { useState } from "react";
import { Button, Input, Label } from "@ayon/ui";
import { VOICE_CATALOG } from "@ayon/core";
import { updateBrandIdentityAction } from "./identity-actions";

const FONT_SUGGESTIONS = ["Poppins", "Montserrat", "Playfair Display", "Lato", "Nunito"];
const STYLE_SUGGESTIONS = ["moderno", "elegante", "minimalista", "corporativo", "jovem"];

export interface IdentityFormProps {
  logoUrl: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  fontFamily: string | null;
  visualStyle: string | null;
  voiceId: string | null;
}

/**
 * Identidade visual como ativo permanente da marca (Missão 11, arch. §14.1,
 * ux-design.md §4.12) — configurada uma vez aqui, aplicada automaticamente
 * em todo vídeo/thumbnail/stories/carrossel gerado depois. Tudo opcional:
 * sem logo cadastrada, o layout se adapta sozinho (arch. §14.8), nunca
 * bloqueia.
 */
export function IdentityForm({
  logoUrl,
  primaryColorHex,
  secondaryColorHex,
  fontFamily,
  visualStyle,
  voiceId,
}: IdentityFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const result = await updateBrandIdentityAction(formData);

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Identidade visual</h2>
        <p className="text-sm text-muted-foreground">
          Definida uma vez, aplicada automaticamente em todo vídeo, thumbnail, stories e carrossel gerado depois —
          sem precisar configurar peça por peça.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="identity-logo">Logo</Label>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo atual" className="h-16 w-16 rounded-md border border-border object-contain p-1" />
        ) : (
          <p className="text-xs text-muted-foreground">Sem logo cadastrada — o conteúdo gerado se adapta automaticamente.</p>
        )}
        <Input id="identity-logo" name="logo" type="file" accept="image/*" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="identity-primary-color">Cor primária</Label>
          <Input id="identity-primary-color" name="primaryColorHex" type="color" defaultValue={primaryColorHex ?? "#1e40af"} className="h-10 w-full p-1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="identity-secondary-color">Cor secundária</Label>
          <Input id="identity-secondary-color" name="secondaryColorHex" type="color" defaultValue={secondaryColorHex ?? "#111111"} className="h-10 w-full p-1" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="identity-font">Fonte (opcional)</Label>
        <Input id="identity-font" name="fontFamily" list="font-suggestions" defaultValue={fontFamily ?? ""} placeholder="Ex.: Poppins" />
        <datalist id="font-suggestions">
          {FONT_SUGGESTIONS.map((font) => (
            <option key={font} value={font} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label htmlFor="identity-style">Estilo visual</Label>
        <Input id="identity-style" name="visualStyle" list="style-suggestions" defaultValue={visualStyle ?? ""} placeholder="Ex.: moderno, elegante, jovem..." />
        <datalist id="style-suggestions">
          {STYLE_SUGGESTIONS.map((style) => (
            <option key={style} value={style} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label htmlFor="identity-voice">Voz da marca</Label>
        <select
          id="identity-voice"
          name="voiceId"
          defaultValue={voiceId ?? ""}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Automático (a Ayon escolhe pela marca)</option>
          {VOICE_CATALOG.map((entry) => (
            <option key={entry.voiceId} value={entry.voiceId}>
              {entry.label} — {entry.description}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-foreground">Identidade visual salva.</p> : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Salvando..." : "Salvar identidade visual"}
      </Button>
    </form>
  );
}
