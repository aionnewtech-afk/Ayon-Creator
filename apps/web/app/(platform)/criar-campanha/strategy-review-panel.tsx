"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ayon/ui";
import { approveCampaignStrategyAction, type SpecialistOpinionView } from "./actions";
import type { ContentPieceView } from "./asset-actions";

export interface StrategyReviewPanelProps {
  campaignId: string;
  opinions: SpecialistOpinionView[];
  executiveSummary: string | null;
  consolidatedStrategy: string;
  rationale: string;
  divergences: string | null;
  /** ★ Refatorado pra `CampaignWorkspace` decidir o que acontece depois de aprovar (nunca mais renderiza `ContentPackageReview` sozinho — evita import circular com o "Redigitar estratégia" que fica em `CampaignWorkspace`). */
  onApproved: (contentPieces: ContentPieceView[]) => void;
}

/**
 * ★ Sprint de estabilização — extraído de `campaign-strategy-flow.tsx` (era
 * só um `mode === "results"` inline ali) para ser reaproveitado também por
 * `/campanhas/[id]` (pedido direto do usuário — "quero que as alterações nas
 * campanhas sejam salvas automaticamente, pra quando eu retomar não começar
 * do zero"): a estratégia consolidada já era persistida desde sempre em
 * `campaigns.strategy_summary`; o que faltava era uma tela pra reabrir e
 * aprovar depois de sair no meio do caminho, sem digitar o objetivo de novo.
 */
export function StrategyReviewPanel({
  campaignId,
  opinions,
  executiveSummary,
  consolidatedStrategy,
  rationale,
  divergences,
  onApproved,
}: StrategyReviewPanelProps) {
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setApproving(true);
    const response = await approveCampaignStrategyAction(campaignId);
    setApproving(false);
    if (response.ok && response.contentPieces) {
      onApproved(response.contentPieces);
    } else {
      setError(response.error ?? "Não consegui aprovar agora. Tenta de novo?");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">O que a equipe pensou sobre esse objetivo</h1>
        <p className="text-sm text-muted-foreground">
          Cada especialista opinou de forma independente antes de qualquer consolidação.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opinions.map((opinion) => (
          <Card key={opinion.specialistId}>
            <CardHeader>
              <CardTitle className="text-base">{opinion.specialistName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {opinion.failed ? (
                <p className="text-muted-foreground">
                  Esse especialista não respondeu a tempo desta vez — a estratégia seguiu com os demais.
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
          {executiveSummary ? <p className="text-base font-medium text-foreground">{executiveSummary}</p> : null}
          <p className="text-foreground">{consolidatedStrategy}</p>
          <div className="rounded-md bg-secondary/60 px-4 py-3 text-secondary-foreground">
            <p className="text-xs font-medium uppercase tracking-wide">Por que fiz assim?</p>
            <p className="mt-1">{rationale}</p>
          </div>
          {divergences ? (
            <div className="rounded-md border border-border px-4 py-3 text-muted-foreground">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground">Divergências entre especialistas</p>
              <p className="mt-1">{divergences}</p>
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
