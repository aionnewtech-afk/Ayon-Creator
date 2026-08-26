"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarHeart, Newspaper, Share2, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import { TREND_CATEGORIES, TREND_CATEGORY_LABELS, type TrendCategory } from "@ayon/core";
import { Button, buttonVariants, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from "@ayon/ui";
import { runTrendDiscoveryAction, type RankedTrendView } from "./actions";

/** ★ Pedido direto do usuário — blocos separados por tipo de sinal, pra "engajar" mais do que uma lista só. */
const CATEGORY_ICONS: Record<TrendCategory, LucideIcon> = {
  noticias: Newspaper,
  pesquisas: BarChart3,
  redes_sociais: Share2,
  eventos: CalendarHeart,
  geral: Sparkles,
};

export interface TrendResearchView {
  id: string;
  rankings: RankedTrendView[];
  overallRationale: string;
}

export interface TrendListProps {
  brandName: string;
  canTrigger: boolean;
  initialTrendResearch: TrendResearchView | null;
}

type Mode = "idle" | "loading";

export function TrendList({ brandName, canTrigger, initialTrendResearch }: TrendListProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [trendResearch, setTrendResearch] = useState<TrendResearchView | null>(initialTrendResearch);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  async function handleDiscover() {
    setMode("loading");
    setError(null);
    setBlocked(false);
    setSelectedTitle(null);

    const response = await runTrendDiscoveryAction();

    setMode("idle");

    if (!response.ok || !response.rankings || !response.trendResearchId) {
      setError(response.error ?? "Algo deu errado. Tenta de novo?");
      setBlocked(Boolean(response.blockedReason));
      return;
    }

    setTrendResearch({
      id: response.trendResearchId,
      rankings: response.rankings,
      overallRationale: response.overallRationale ?? "",
    });
  }

  const triggerButton = canTrigger ? (
    <Button size="lg" onClick={handleDiscover} disabled={mode === "loading"}>
      {mode === "loading"
        ? "Pesquisando tendências..."
        : trendResearch
          ? "Buscar novidades"
          : "Buscar tendências"}
    </Button>
  ) : null;

  if (!trendResearch && mode === "idle") {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-16">
        <EmptyState
          icon={TrendingUp}
          title={canTrigger ? "Vamos ver o que está em alta?" : "Nenhuma tendência buscada ainda"}
          description={
            canTrigger
              ? `A Ayon vai pesquisar tendências relevantes para o nicho da ${brandName} e a equipe de especialistas vai avaliar quais realmente combinam com a marca.`
              : "Peça para um editor ou administrador da organização buscar tendências para esta marca."
          }
          action={triggerButton}
        />
        {error ? (
          <div className="text-center text-sm text-destructive">
            <p>{error}</p>
            {blocked ? (
              <Link href="/configuracoes" className="underline underline-offset-4">
                Ir para Configurações
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (mode === "loading" && !trendResearch) {
    return (
      <div className="mx-auto max-w-xl space-y-2 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Pesquisando tendências...</h1>
        <p className="text-muted-foreground">
          A Ayon está buscando na web e consultando a equipe de especialistas sobre o que realmente
          combina com a {brandName}. Isso pode levar um minuto.
        </p>
      </div>
    );
  }

  const selected = selectedTitle ? trendResearch?.rankings.find((r) => r.title === selectedTitle) : undefined;

  if (selected && trendResearch) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <button
          type="button"
          onClick={() => setSelectedTitle(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar para a lista
        </button>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {TREND_CATEGORY_LABELS[selected.category]}
          </p>
          <h1 className="text-xl font-semibold text-foreground">{selected.title}</h1>
          <p className="text-muted-foreground">{selected.summary}</p>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="rounded-md bg-secondary/60 px-4 py-3 text-secondary-foreground">
              <p className="text-xs font-medium uppercase tracking-wide">Por que fiz assim?</p>
              <p className="mt-1">{selected.rationale}</p>
            </div>
            {selected.sourceUrl ? (
              <a
                href={selected.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm text-primary underline-offset-4 hover:underline"
              >
                Ver fonte
              </a>
            ) : null}
          </CardContent>
        </Card>

        <Link
          href={`/criar-campanha?tema=${encodeURIComponent(selected.title)}`}
          className={buttonVariants({ size: "lg" })}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Criar campanha a partir dessa tendência
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">O que está em alta para a {brandName}</h1>
          <p className="text-sm text-muted-foreground">
            Cada tendência já passou pela equipe de especialistas antes de chegar aqui.
          </p>
        </div>
        {triggerButton}
      </div>

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

      {trendResearch && trendResearch.rankings.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nada genuinamente relevante desta vez"
          description="A equipe de especialistas não encontrou nenhuma tendência que realmente combine com a marca agora. Tente buscar de novo daqui a alguns dias."
        />
      ) : (
        <div className="space-y-8">
          {TREND_CATEGORIES.map((category) => {
            const items = trendResearch?.rankings.filter((r) => r.category === category) ?? [];
            if (items.length === 0) return null;

            const Icon = CATEGORY_ICONS[category];
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {TREND_CATEGORY_LABELS[category]}
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {items.map((ranking) => (
                    <button key={ranking.title} type="button" onClick={() => setSelectedTitle(ranking.title)} className="text-left">
                      <Card className="h-full transition-colors hover:border-primary">
                        <CardHeader>
                          <CardTitle className="text-base">{ranking.title}</CardTitle>
                          <CardDescription>{ranking.summary}</CardDescription>
                        </CardHeader>
                      </Card>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
