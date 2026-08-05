"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ayon/ui";
import { stopImpersonationAction } from "@/lib/impersonation-actions";

export interface ImpersonationBannerProps {
  organizationName: string;
}

/**
 * Aviso permanente de impersonação (ux-design.md §4.13, texto exato
 * aprovado) — sem botão de fechar/ocultar, nunca colapsável. Só renderiza
 * quando `session.isImpersonating` é verdadeiro (decisão tomada pelo layout
 * que a usa, não aqui).
 */
export function ImpersonationBanner({ organizationName }: ImpersonationBannerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStop() {
    setError(null);
    startTransition(async () => {
      const result = await stopImpersonationAction();
      if (!result.ok) {
        setError(result.error ?? "Não foi possível sair da impersonação.");
        return;
      }
      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        Você está visualizando como: <strong>{organizationName}</strong>
      </span>
      <div className="flex items-center gap-2">
        {error ? <span className="text-amber-950">{error}</span> : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-amber-950 bg-transparent text-amber-950 hover:bg-amber-600"
          disabled={pending}
          onClick={handleStop}
        >
          {pending ? "Saindo..." : "Sair da impersonação"}
        </Button>
      </div>
    </div>
  );
}
