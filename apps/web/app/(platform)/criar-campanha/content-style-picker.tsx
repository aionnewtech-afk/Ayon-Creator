"use client";

import type { ContentStyle } from "@ayon/types";

export interface ContentStylePickerProps {
  value: ContentStyle;
  onChange: (value: ContentStyle) => void;
  disabled?: boolean;
}

const OPTIONS: { value: ContentStyle; label: string; description: string }[] = [
  {
    value: "comercial",
    label: "Comercial",
    description: "Foco em vender — CTA claro, convida a falar com a marca/agendar/comprar.",
  },
  {
    value: "institucional",
    label: "Institucional",
    description: "Foco em informar — dicas, curiosidades, conteúdo útil; sem pitch de venda direto.",
  },
];

/**
 * ★ Achado real (pedido direto do usuário — "queria incluir a opção de criar
 * campanha com cunho mais comercial - ou criar conteúdo numa pegada mais
 * institucional, com dicas, informações"): escolha explícita na criação (e
 * na redigitação) da campanha — muda o tom do painel de especialistas e do
 * roteiro final (`campaigns.content_style`, migration 0029).
 */
export function ContentStylePicker({ value, onChange, disabled }: ContentStylePickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tom do conteúdo</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              value === option.value ? "border-primary bg-secondary/60" : "border-input hover:bg-secondary/30"
            }`}
          >
            <span className="block font-medium text-foreground">{option.label}</span>
            <span className="block text-xs text-muted-foreground">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
