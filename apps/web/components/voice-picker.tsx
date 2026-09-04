"use client";

import { useRef, useState } from "react";
import { Button } from "@ayon/ui";
import { previewVoiceAction } from "@/app/(platform)/conheca-sua-empresa/perfil/identity-actions";

export interface VoiceCatalogOption {
  voiceId: string;
  label: string;
  description: string;
}

export interface VoicePickerProps {
  options: VoiceCatalogOption[];
  value: string | null;
  onChange: (voiceId: string | null) => void;
  /** Mostra "Automático" como opção — usado no Perfil da Marca (voz opcional, escolhida pela Ayon quando ausente). Pickers que sempre exigem uma voz explícita (ex.: trocar a voz de um vídeo já gerado) omitem isso. */
  allowAutomatic?: boolean;
  disabled?: boolean;
}

/**
 * ★ Achado real (pedido direto do usuário — "adicionar um botão de prévia/
 * ouvir... a pessoa consegue conhecer a voz antes de gerar o vídeo"): antes,
 * a escolha de voz era um `<select>` nativo só com texto — sem jeito de ouvir
 * antes de decidir. Reaproveitado tanto no Perfil da Marca (identity-form.tsx)
 * quanto na troca de voz de um vídeo já gerado (content-package-review.tsx).
 */
export function VoicePicker({ options, value, onChange, allowAutomatic, disabled }: VoicePickerProps) {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function handlePreview(voiceId: string) {
    setPreviewError(null);
    setPreviewingId(voiceId);
    const result = await previewVoiceAction(voiceId);
    if (!result.ok || !result.audioUrl) {
      setPreviewingId(null);
      setPreviewError(result.error ?? "Não consegui tocar essa amostra agora.");
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = result.audioUrl;
      void audioRef.current.play();
    }
  }

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={() => setPreviewingId(null)}
        onPause={() => setPreviewingId(null)}
      />
      {previewError ? <p className="text-xs text-destructive">{previewError}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {allowAutomatic ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              value === null ? "border-primary bg-secondary/60" : "border-input hover:bg-secondary/30"
            }`}
          >
            <span className="block font-medium text-foreground">Automático</span>
            <span className="block text-xs text-muted-foreground">A Ayon escolhe pela marca</span>
          </button>
        ) : null}
        {options.map((option) => (
          <div
            key={option.voiceId}
            className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              value === option.voiceId ? "border-primary bg-secondary/60" : "border-input"
            }`}
          >
            <button type="button" disabled={disabled} onClick={() => onChange(option.voiceId)} className="flex-1 text-left">
              <span className="block font-medium text-foreground">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.description}</span>
            </button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || previewingId === option.voiceId}
              onClick={() => handlePreview(option.voiceId)}
            >
              {previewingId === option.voiceId ? "..." : "▶"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
