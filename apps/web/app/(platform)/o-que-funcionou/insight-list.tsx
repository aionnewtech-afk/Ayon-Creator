"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from "@ayon/ui";
import { acceptInsightAction, dismissInsightAction, runLearningAnalysisAction, type LearningInsightView } from "./actions";

export interface InsightListProps {
  brandName: string;
  initialInsights: LearningInsightView[];
}

type Mode = "idle" | "analyzing";

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Aguardando decisão",
  applied: "Aplicada",
  dismissed: "Descartada",
};

export function InsightList({ brandName, initialInsights }: InsightListProps) {
  const [insights, setInsights] = useState<LearningInsightView[]>(initialInsights);
  const [mode, setMode] = useState<Mode>("idle");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insufficientSignals, setInsufficientSignals] = useState<{ signalCount: number; minimumRequired: number } | null>(null);

  const pending = insights.filter((i) => i.status === "pending_review");
  const history = insights.filter((i) => i.status !== "pending_review");

  async function handleAnalyze() {
    setMode("analyzing");
    setError(null);
    setInsufficientSignals(null);

    const response = await runLearningAnalysisAction();
    setMode("idle");

    if (!response.ok) {
      setError(response.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }

    if (!response.ranAnalysis) {
      setInsufficientSignals({
        signalCount: response.signalCount ?? 0,
        minimumRequired: response.minimumRequired ?? 0,
      });
      return;
    }

    if (response.insights) {
      setInsights((prev) => [...response.insights!, ...prev]);
    }
  }

  async function handleAccept(insightId: string) {
    setLoadingId(insightId);
    setError(null);
    const response = await acceptInsightAction(insightId);
    setLoadingId(null);

    if (!response.ok || !response.insight) {
      setError(response.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }
    setInsights((prev) => prev.map((i) => (i.id === insightId ? response.insight! : i)));
  }

  async function handleDismiss(insightId: string) {
    setLoadingId(insightId);
    setError(null);
    const response = await dismissInsightAction(insightId);
    setLoadingId(null);

    if (!response.ok || !response.insight) {
      setError(response.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }
    setInsights((prev) => prev.map((i) => (i.id === insightId ? response.insight! : i)));
  }

  const triggerButton = (
    <Button size="lg" onClick={handleAnalyze} disabled={mode === "analyzing"}>
      {mode === "analyzing" ? "Analisando..." : insights.length > 0 ? "Buscar novidades" : "Analisar campanhas"}
    </Button>
  );

  if (insights.length === 0 && mode === "idle" && !insufficientSignals) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-16">
        <EmptyState
          icon={Lightbulb}
          title="Ainda não há sugestões"
          description={`Continue aprovando, rejeitando e editando peças de conteúdo da ${brandName} — assim que houver sinal suficiente, a Ayon aponta padrões reais para você decidir.`}
          action={triggerButton}
        />
        {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">O que funcionou para a {brandName}</h1>
          <p className="text-sm text-muted-foreground">
            Nenhuma sugestão é aplicada sem sua decisão explícita.
          </p>
        </div>
        {triggerButton}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {insufficientSignals ? (
        <div className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
          Ainda não há sinal suficiente para uma nova análise — {insufficientSignals.signalCount} de{" "}
          {insufficientSignals.minimumRequired} necessários. Continue aprovando, rejeitando e editando peças de
          conteúdo para acumular mais dados.
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="space-y-4">
          {pending.map((insight) => (
            <Card key={insight.id}>
              <CardHeader>
                <CardDescription>{STATUS_LABELS[insight.status]}</CardDescription>
                <CardTitle className="text-base font-normal leading-snug">{insight.text}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-md bg-secondary/60 px-4 py-3 text-secondary-foreground">
                  <p className="text-xs font-medium uppercase tracking-wide">Por que fiz assim?</p>
                  <p className="mt-1">{insight.rationale}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" disabled={loadingId === insight.id} onClick={() => handleAccept(insight.id)}>
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={loadingId === insight.id}
                    onClick={() => handleDismiss(insight.id)}
                  >
                    Descartar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Histórico</h2>
          <div className="space-y-3">
            {history.map((insight) => (
              <Card key={insight.id} className="opacity-80">
                <CardHeader>
                  <CardDescription>{STATUS_LABELS[insight.status]}</CardDescription>
                  <CardTitle className="text-sm font-normal leading-snug">{insight.text}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
