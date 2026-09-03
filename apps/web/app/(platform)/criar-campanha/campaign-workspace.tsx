"use client";

import { useState } from "react";
import { Button, Textarea } from "@ayon/ui";
import { redoCampaignStrategyAction, type SpecialistOpinionView } from "./actions";
import { StrategyReviewPanel } from "./strategy-review-panel";
import { ContentPackageReview } from "./content-package-review";
import type { ContentPieceView } from "./asset-actions";

interface StrategyData {
  campaignId: string;
  opinions: SpecialistOpinionView[];
  executiveSummary: string | null;
  consolidatedStrategy: string;
  rationale: string;
  divergences: string | null;
}

export interface CampaignWorkspaceProps {
  brandName: string;
  campaignId: string;
  avatarReady: boolean;
  avatarName: string | null;
  avatarLooks: { lookId: string; name: string; status: string }[];
  initialMode: "strategy" | "content";
  initialStrategy?: Omit<StrategyData, "campaignId">;
  initialContentPieces?: ContentPieceView[];
  campaignTitle?: string;
  initialPackageReady?: boolean;
  initialDownloadUrl?: string;
}

/**
 * ★ Achado real (pedido direto do usuário — "os textos são muito genéricos
 * ... quando aprovo a campanha não consigo mais voltar pra revisar... quero
 * poder redigitar a pesquisa/estratégia"): dono do toggle entre a tela de
 * estratégia (`StrategyReviewPanel`) e a de conteúdo (`ContentPackageReview`)
 * — nenhum dos dois importa o outro (evita import circular), este componente
 * decide qual mostrar e guarda o botão "Redigitar estratégia" (só faz
 * sentido olhando o conteúdo já aprovado). Usado tanto pelo fluxo de criação
 * (`campaign-strategy-flow.tsx`) quanto por `/campanhas/[id]`.
 */
export function CampaignWorkspace({
  brandName,
  campaignId,
  avatarReady,
  avatarName,
  avatarLooks,
  initialMode,
  initialStrategy,
  initialContentPieces,
  campaignTitle,
  initialPackageReady,
  initialDownloadUrl,
}: CampaignWorkspaceProps) {
  const [mode, setMode] = useState(initialMode);
  const [strategy, setStrategy] = useState<StrategyData | null>(
    initialStrategy ? { campaignId, ...initialStrategy } : null,
  );
  const [contentPieces, setContentPieces] = useState<ContentPieceView[] | null>(initialContentPieces ?? null);

  const [redoOpen, setRedoOpen] = useState(false);
  const [redoDraft, setRedoDraft] = useState("");
  const [redoLoading, setRedoLoading] = useState(false);
  const [redoError, setRedoError] = useState<string | null>(null);

  async function handleRedo() {
    const trimmed = redoDraft.trim();
    if (!trimmed || redoLoading) return;
    setRedoLoading(true);
    setRedoError(null);

    const result = await redoCampaignStrategyAction(campaignId, trimmed);
    setRedoLoading(false);

    if (!result.ok || !result.opinions || !result.consolidatedStrategy || !result.rationale) {
      setRedoError(result.error ?? "Não consegui redigitar a estratégia agora. Tenta de novo?");
      return;
    }

    setStrategy({
      campaignId,
      opinions: result.opinions,
      executiveSummary: result.executiveSummary ?? null,
      consolidatedStrategy: result.consolidatedStrategy,
      rationale: result.rationale,
      divergences: result.divergences ?? null,
    });
    setRedoOpen(false);
    setRedoDraft("");
    setMode("strategy");
  }

  if (mode === "strategy" && strategy) {
    return (
      <StrategyReviewPanel
        campaignId={strategy.campaignId}
        opinions={strategy.opinions}
        executiveSummary={strategy.executiveSummary}
        consolidatedStrategy={strategy.consolidatedStrategy}
        rationale={strategy.rationale}
        divergences={strategy.divergences}
        onApproved={(pieces) => {
          setContentPieces(pieces);
          setMode("content");
        }}
      />
    );
  }

  if (mode === "content" && contentPieces) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 pt-6">
        {redoOpen ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">
              Ajuste o objetivo e reprocesse a pesquisa/estratégia — a equipe de especialistas roda de novo (nova
              cobrança em créditos) e os formatos de texto são regenerados com o resultado novo. Vídeo e fotos já
              gerados ficam como estão; regenere cada um manualmente se também quiser refazer.
            </p>
            <Textarea
              value={redoDraft}
              onChange={(event) => setRedoDraft(event.target.value)}
              placeholder="Ex.: pesquisa 5 destinos reais pra desacelerar, com o que esperar em cada um"
              className="min-h-[100px]"
              disabled={redoLoading}
            />
            {redoError ? <p className="text-sm text-destructive">{redoError}</p> : null}
            <div className="flex gap-2">
              <Button size="sm" disabled={redoLoading || !redoDraft.trim()} onClick={handleRedo}>
                {redoLoading ? "Redigitando..." : "Redigitar estratégia"}
              </Button>
              <Button size="sm" variant="ghost" disabled={redoLoading} onClick={() => setRedoOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setRedoOpen(true)}>
            Redigitar estratégia
          </Button>
        )}

        <ContentPackageReview
          brandName={brandName}
          initialContentPieces={contentPieces}
          campaignTitle={campaignTitle}
          initialPackageReady={initialPackageReady}
          initialDownloadUrl={initialDownloadUrl}
          avatarReady={avatarReady}
          avatarName={avatarName}
          avatarLooks={avatarLooks}
        />
      </div>
    );
  }

  return null;
}
