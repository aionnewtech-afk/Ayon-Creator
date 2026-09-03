"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Textarea } from "@ayon/ui";
import { createCampaignStrategyAction, type SpecialistOpinionView } from "./actions";
import { CampaignWorkspace } from "./campaign-workspace";

interface StrategyResult {
  campaignId: string;
  opinions: SpecialistOpinionView[];
  executiveSummary: string | null;
  consolidatedStrategy: string;
  rationale: string;
  divergences: string | null;
}

type Mode = "form" | "loading" | "results";

export interface CampaignStrategyFlowProps {
  brandName: string;
  /** Pré-preenchido ao vir de uma tendência selecionada (TREND-2 → CAMP-1, Fluxo 2). */
  initialObjective?: string;
  /** ★ Achado real (pedido direto do usuário — "em que momento ele vai dar a opção de gerar vídeo de avatar?"): quando pronto, a peça de vídeo ganha um 2º jeito de gerar, ao lado do banco de vídeo licenciado. */
  avatarReady: boolean;
  avatarName: string | null;
  avatarLooks: { lookId: string; name: string; status: string }[];
}

export function CampaignStrategyFlow({
  brandName,
  initialObjective,
  avatarReady,
  avatarName,
  avatarLooks,
}: CampaignStrategyFlowProps) {
  const [mode, setMode] = useState<Mode>("form");
  const [objective, setObjective] = useState(initialObjective ?? "");
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = objective.trim();
    if (!trimmed || mode === "loading") return;

    setMode("loading");
    setError(null);
    setBlocked(false);

    const response = await createCampaignStrategyAction(trimmed);

    if (!response.ok || !response.campaignId || !response.opinions || !response.consolidatedStrategy || !response.rationale) {
      setError(response.error ?? "Algo deu errado. Tenta de novo?");
      setBlocked(Boolean(response.blockedReason));
      setMode("form");
      return;
    }

    setResult({
      campaignId: response.campaignId,
      opinions: response.opinions,
      executiveSummary: response.executiveSummary ?? null,
      consolidatedStrategy: response.consolidatedStrategy,
      rationale: response.rationale,
      divergences: response.divergences ?? null,
    });
    setMode("results");
  }

  if (mode === "results" && result) {
    return (
      <CampaignWorkspace
        brandName={brandName}
        campaignId={result.campaignId}
        avatarReady={avatarReady}
        avatarName={avatarName}
        avatarLooks={avatarLooks}
        initialMode="strategy"
        initialStrategy={{
          opinions: result.opinions,
          executiveSummary: result.executiveSummary,
          consolidatedStrategy: result.consolidatedStrategy,
          rationale: result.rationale,
          divergences: result.divergences,
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Qual é o objetivo dessa campanha?</h1>
        <p className="text-muted-foreground">
          Conte o que você quer alcançar para a {brandName} — a equipe de especialistas da Ayon vai
          discutir a melhor estratégia com base em tudo que ela já sabe sobre a marca.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="Ex.: quero atrair mais clientes para o lançamento do produto X em outubro"
          className="min-h-[120px]"
          disabled={mode === "loading"}
        />
        {error ? (
          <div className="text-sm text-destructive">
            <p>{error}</p>
            {blocked ? (
              <Link href="/configuracoes" className="underline underline-offset-4">
                Ir para Configurações
              </Link>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" size="lg" disabled={mode === "loading" || !objective.trim()}>
          {mode === "loading" ? "A equipe está analisando..." : "Reunir a equipe de especialistas"}
        </Button>
      </form>
    </div>
  );
}
