"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from "@ayon/ui";
import {
  approveCampaignStrategyAction,
  createCampaignStrategyAction,
  type SpecialistOpinionView,
} from "./actions";
import { ContentPackageReview } from "./content-package-review";
import type { ContentPieceView } from "./asset-actions";

interface StrategyResult {
  campaignId: string;
  opinions: SpecialistOpinionView[];
  consolidatedStrategy: string;
  rationale: string;
  divergences: string | null;
}

type Mode = "form" | "loading" | "results" | "approved";

export interface CampaignStrategyFlowProps {
  brandName: string;
  /** Pré-preenchido ao vir de uma tendência selecionada (TREND-2 → CAMP-1, Fluxo 2). */
  initialObjective?: string;
}

export function CampaignStrategyFlow({ brandName, initialObjective }: CampaignStrategyFlowProps) {
  const [mode, setMode] = useState<Mode>("form");
  const [objective, setObjective] = useState(initialObjective ?? "");
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [contentPieces, setContentPieces] = useState<ContentPieceView[] | null>(null);

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
      consolidatedStrategy: response.consolidatedStrategy,
      rationale: response.rationale,
      divergences: response.divergences ?? null,
    });
    setMode("results");
  }

  async function handleApprove() {
    if (!result) return;
    setApproving(true);
    const response = await approveCampaignStrategyAction(result.campaignId);
    setApproving(false);
    if (response.ok && response.contentPieces) {
      setContentPieces(response.contentPieces);
      setMode("approved");
    } else {
      setError(response.error ?? "Não consegui aprovar agora. Tenta de novo?");
    }
  }

  if (mode === "approved" && contentPieces) {
    return <ContentPackageReview brandName={brandName} initialContentPieces={contentPieces} />;
  }

  if (mode === "results" && result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">O que a equipe pensou sobre esse objetivo</h1>
          <p className="text-sm text-muted-foreground">
            Cada especialista opinou de forma independente antes de qualquer consolidação.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.opinions.map((opinion) => (
            <Card key={opinion.specialistId}>
              <CardHeader>
                <CardTitle className="text-base">{opinion.specialistName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {opinion.failed ? (
                  <p className="text-muted-foreground">
                    Esse especialista não respondeu a tempo desta vez — a estratégia seguiu com os
                    demais.
                  </p>
                ) : (
                  <>
                    <p className="text-foreground">{opinion.opinion}</p>
                    <p className="text-muted-foreground">{opinion.rationale}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Estratégia consolidada</CardTitle>
            <CardDescription>Como o Coordinator uniu as opiniões acima em um único caminho.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-foreground">{result.consolidatedStrategy}</p>
            <div className="rounded-md bg-secondary/60 px-4 py-3 text-secondary-foreground">
              <p className="text-xs font-medium uppercase tracking-wide">Por que fiz assim?</p>
              <p className="mt-1">{result.rationale}</p>
            </div>
            {result.divergences ? (
              <div className="rounded-md border border-border px-4 py-3 text-muted-foreground">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">Divergências entre especialistas</p>
                <p className="mt-1">{result.divergences}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button size="lg" onClick={handleApprove} disabled={approving}>
          {approving ? "Aprovando..." : "Aprovar estratégia"}
        </Button>
      </div>
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
