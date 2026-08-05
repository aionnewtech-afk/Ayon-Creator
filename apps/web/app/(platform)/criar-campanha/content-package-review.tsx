"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from "@ayon/ui";
import {
  approveContentPieceAction,
  editContentPieceAction,
  generatePhotoContentPieceAction,
  generateVideoContentPieceAction,
  getContentPieceAction,
  regenerateContentPieceAction,
  rejectContentPieceAction,
  selectContentPieceVersionAction,
  uploadContentPieceMediaAction,
  type ContentPieceView,
} from "./asset-actions";

/** Fluxo 13/15 são assíncronos — sem Realtime no MVP (decisão de UX), polling simples enquanto uma peça está `generating`. */
const GENERATION_POLL_INTERVAL_MS = 4000;

const FORMAT_LABELS: Record<string, string> = {
  video: "Vídeo",
  caption: "Legenda",
  stories: "Stories",
  carousel: "Carrossel",
  thumbnail: "Thumbnail",
  blog_post: "Post de blog",
  email: "E-mail",
  script: "Roteiro",
  teleprompter: "Teleprompter",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Aguardando",
  generating: "Gerando...",
  ready_for_review: "Pronta para revisão",
  approved: "Aprovada",
  rejected: "Rejeitada",
  failed: "Falhou",
};

/** ★ Missão 11 (arch. §14.9) — copy amigável por etapa, nunca nome de fornecedor/API. */
const STAGE_LABELS: Record<string, string> = {
  selecting_voice: "Selecionando a voz da marca...",
  narrating: "Gerando narração...",
  selecting_scenes: "Buscando cenas...",
  selecting_photos: "Buscando fotos...",
  rendering: "Renderizando...",
  applying_branding: "Aplicando identidade visual...",
  finalizing: "Finalizando...",
};

export interface ContentPackageReviewProps {
  brandName: string;
  initialContentPieces: ContentPieceView[];
}

export function ContentPackageReview({ brandName, initialContentPieces }: ContentPackageReviewProps) {
  const [pieces, setPieces] = useState<ContentPieceView[]>(initialContentPieces);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftScript, setDraftScript] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [packageReady, setPackageReady] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>(undefined);

  function updatePiece(updated: ContentPieceView) {
    setPieces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  // Polling simples (Fluxo 13/15 — sem Realtime no MVP) enquanto alguma peça
  // de vídeo/foto está `generating`: verifica a cada poucos segundos até sair
  // desse estado (ready_for_review ou failed), então para sozinho.
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const generatingIds = pieces
      .filter(
        (p) =>
          (p.productionMode === "licensed_stock_video" || p.productionMode === "licensed_stock_photo") &&
          p.status === "generating",
      )
      .map((p) => p.id);

    if (generatingIds.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      for (const id of generatingIds) {
        const result = await getContentPieceAction(id);
        if (result.ok && result.contentPiece) updatePiece(result.contentPiece);
      }
    }, GENERATION_POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces]);

  function handleActionResult(result: {
    ok: boolean;
    error?: string;
    blockedReason?: "inactive_subscription" | "insufficient_credits";
    contentPiece?: ContentPieceView;
    packageReady?: boolean;
    downloadUrl?: string;
  }) {
    setLoadingId(null);
    setError(null);
    setBlocked(false);

    if (!result.ok) {
      setError(result.error ?? "Algo deu errado. Tenta de novo?");
      setBlocked(Boolean(result.blockedReason));
      return;
    }

    if (result.contentPiece) updatePiece(result.contentPiece);
    if (result.packageReady) {
      setPackageReady(true);
      setDownloadUrl(result.downloadUrl);
    }
  }

  async function handleApprove(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await approveContentPieceAction(pieceId));
  }

  async function handleReject(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await rejectContentPieceAction(pieceId));
  }

  async function handleRegenerate(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await regenerateContentPieceAction(pieceId));
  }

  async function handleGenerateVideo(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await generateVideoContentPieceAction(pieceId));
  }

  async function handleGeneratePhoto(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await generatePhotoContentPieceAction(pieceId));
  }

  async function handleSelectVersion(pieceId: string, versionId: string) {
    setLoadingId(pieceId);
    handleActionResult(await selectContentPieceVersionAction(pieceId, versionId));
  }

  function startEditing(piece: ContentPieceView) {
    setEditingId(piece.id);
    setDraftScript(piece.script ?? "");
  }

  async function saveEdit(pieceId: string) {
    setLoadingId(pieceId);
    const result = await editContentPieceAction(pieceId, draftScript);
    setEditingId(null);
    handleActionResult(result);
  }

  async function handleUpload(pieceId: string, file: File) {
    setLoadingId(pieceId);
    const formData = new FormData();
    formData.set("file", file);
    handleActionResult(await uploadContentPieceMediaAction(pieceId, formData));
  }

  if (packageReady) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Pacote pronto</h1>
        <p className="text-muted-foreground">
          Todas as peças da campanha da {brandName} foram aprovadas e o pacote de conteúdo está pronto para download.
        </p>
        {downloadUrl ? (
          <a href={downloadUrl} className="inline-block rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">
            Baixar pacote (.zip)
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Revisão do pacote de conteúdo</h1>
        <p className="text-sm text-muted-foreground">
          Aprove cada peça para liberar o pacote final. Formatos de texto foram gerados pela Ayon; formatos visuais
          precisam do seu arquivo.
        </p>
      </div>

      {error ? (
        <div className="text-sm text-destructive">
          <p>{error}</p>
          {blocked ? (
            <a href="/configuracoes" className="underline underline-offset-4">
              Ir para Configurações
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {pieces.map((piece) => {
          const isLoading = loadingId === piece.id;
          const isTextFormat = piece.productionMode === "text_only";
          const isVideoAutoGenerated = piece.productionMode === "licensed_stock_video";
          const isPhotoAutoGenerated = piece.productionMode === "licensed_stock_photo";
          const isEditing = editingId === piece.id;

          return (
            <Card key={piece.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {FORMAT_LABELS[piece.format] ?? piece.format}
                  {piece.isPrimary ? " (peça principal)" : ""}
                </CardTitle>
                <CardDescription>{STATUS_LABELS[piece.status] ?? piece.status}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {isTextFormat ? (
                  <>
                    {isEditing ? (
                      <Textarea value={draftScript} onChange={(event) => setDraftScript(event.target.value)} className="min-h-[140px]" />
                    ) : (
                      <p className="whitespace-pre-wrap text-foreground">{piece.script ?? "Ainda não gerado."}</p>
                    )}
                    {piece.brandRationale && !isEditing ? (
                      <div className="rounded-md bg-secondary/60 px-4 py-3 text-secondary-foreground">
                        <p className="text-xs font-medium uppercase tracking-wide">Por que fiz assim?</p>
                        <p className="mt-1">{piece.brandRationale}</p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {isEditing ? (
                        <Button size="sm" disabled={isLoading} onClick={() => saveEdit(piece.id)}>
                          {isLoading ? "Salvando..." : "Salvar edição"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={isLoading || piece.status === "approved" || piece.status === "generating"}
                            onClick={() => handleApprove(piece.id)}
                          >
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading || piece.status === "generating"}
                            onClick={() => startEditing(piece)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading || piece.status === "generating"}
                            onClick={() => handleRegenerate(piece.id)}
                          >
                            {isLoading ? "Gerando..." : "Regenerar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isLoading || piece.status === "rejected"}
                            onClick={() => handleReject(piece.id)}
                          >
                            Rejeitar
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                ) : isVideoAutoGenerated ? (
                  <>
                    {piece.status === "draft" ? (
                      <p className="text-muted-foreground">
                        Gere o vídeo automaticamente — narração por IA, cenas de banco de vídeo licenciado e
                        identidade visual da marca, montados em um MP4 vertical pronto.
                      </p>
                    ) : piece.status === "generating" ? (
                      <GenerationProgress piece={piece} />
                    ) : piece.status === "failed" ? (
                      <p className="text-destructive">Não conseguimos gerar esse vídeo agora.</p>
                    ) : piece.mediaUrl ? (
                      <>
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video controls src={piece.mediaUrl} className="w-full rounded-md" />
                        <MediaActions mediaUrl={piece.mediaUrl} label="vídeo" />
                      </>
                    ) : (
                      <p className="text-muted-foreground">Vídeo pronto — carregando preview...</p>
                    )}

                    {piece.brandRationale ? (
                      <div className="rounded-md bg-secondary/60 px-4 py-3 text-secondary-foreground">
                        <p className="text-xs font-medium uppercase tracking-wide">Por que fiz assim?</p>
                        <p className="mt-1">{piece.brandRationale}</p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {piece.status === "draft" || piece.status === "failed" ? (
                        <Button size="sm" disabled={isLoading} onClick={() => handleGenerateVideo(piece.id)}>
                          {isLoading
                            ? "Iniciando..."
                            : piece.status === "failed"
                              ? "Tentar novamente"
                              : "Gerar vídeo automaticamente"}
                        </Button>
                      ) : null}
                      {piece.status === "ready_for_review" ? (
                        <>
                          <Button size="sm" disabled={isLoading} onClick={() => handleApprove(piece.id)}>
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => startEditing(piece)}
                          >
                            Editar roteiro
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleGenerateVideo(piece.id)}
                          >
                            Gerar de novo
                          </Button>
                          <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => handleReject(piece.id)}>
                            Rejeitar
                          </Button>
                        </>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-2">
                        <Textarea value={draftScript} onChange={(event) => setDraftScript(event.target.value)} className="min-h-[100px]" />
                        <Button size="sm" disabled={isLoading} onClick={() => saveEdit(piece.id)}>
                          {isLoading ? "Salvando..." : "Salvar roteiro"}
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : isPhotoAutoGenerated ? (
                  <>
                    {piece.status === "generating" ? (
                      <GenerationProgress piece={piece} />
                    ) : piece.status === "failed" ? (
                      <p className="text-destructive">Não conseguimos gerar essa imagem agora.</p>
                    ) : piece.mediaOptions && piece.mediaOptions.length > 1 ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground">Escolha uma das opções geradas:</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {piece.mediaOptions.map((option) => (
                            <button
                              key={option.versionId}
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleSelectVersion(piece.id, option.versionId)}
                              className={`overflow-hidden rounded-md border-2 ${
                                piece.selectedVersionId === option.versionId ? "border-primary" : "border-transparent"
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={option.mediaUrl} alt="Opção gerada" className="aspect-square w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : piece.mediaUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={piece.mediaUrl} alt="" className="w-full rounded-md" />
                        <MediaActions mediaUrl={piece.mediaUrl} label="imagem" />
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        Gere automaticamente — foto de banco licenciado com identidade visual da marca aplicada — ou
                        envie seu próprio arquivo.
                      </p>
                    )}

                    {piece.brandRationale ? (
                      <div className="rounded-md bg-secondary/60 px-4 py-3 text-secondary-foreground">
                        <p className="text-xs font-medium uppercase tracking-wide">Por que fiz assim?</p>
                        <p className="mt-1">{piece.brandRationale}</p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant={piece.status === "ready_for_review" ? "outline" : "default"}
                        disabled={isLoading || piece.status === "generating"}
                        onClick={() => handleGeneratePhoto(piece.id)}
                      >
                        {isLoading
                          ? "Iniciando..."
                          : piece.status === "failed"
                            ? "Tentar novamente"
                            : piece.status === "ready_for_review"
                              ? "Gerar de novo"
                              : "Gerar automaticamente"}
                      </Button>
                      {piece.status === "ready_for_review" ? (
                        <>
                          <Button size="sm" disabled={isLoading} onClick={() => handleApprove(piece.id)}>
                            Aprovar
                          </Button>
                          <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => handleReject(piece.id)}>
                            Rejeitar
                          </Button>
                        </>
                      ) : null}
                    </div>

                    {/* Upload manual continua disponível como alternativa, mesmo depois de uma geração automática (decisão do dono do produto, arch. §14.4). */}
                    <div className="border-t border-border pt-3">
                      <p className="pb-1 text-xs text-muted-foreground">Ou envie seu próprio arquivo:</p>
                      <input
                        type="file"
                        disabled={isLoading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleUpload(piece.id, file);
                        }}
                        className="text-sm text-muted-foreground"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      {piece.status === "draft"
                        ? "Envie o arquivo dessa peça (mídia própria)."
                        : "Arquivo enviado — pronto para revisão."}
                    </p>
                    {piece.mediaUrl ? (
                      piece.format === "video" || piece.format === "stories" ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video controls src={piece.mediaUrl} className="w-full rounded-md" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={piece.mediaUrl} alt="" className="w-full rounded-md" />
                      )
                    ) : null}
                    <input
                      type="file"
                      disabled={isLoading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUpload(piece.id, file);
                      }}
                      className="text-sm text-muted-foreground"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={isLoading || piece.status === "draft" || piece.status === "approved"}
                        onClick={() => handleApprove(piece.id)}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isLoading || piece.status === "rejected"}
                        onClick={() => handleReject(piece.id)}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Progresso granular (Missão 11, arch. §14.9) — etapa atual + barra
 * aproximada + tempo estimado restante quando disponível. Sem barra
 * determinística por segundo — só a etapa e um percentual aproximado.
 */
function GenerationProgress({ piece }: { piece: ContentPieceView }) {
  const stageLabel = piece.pipelineStage ? STAGE_LABELS[piece.pipelineStage] ?? "Gerando..." : "Gerando...";
  const percent = piece.pipelineProgressPercent ?? undefined;
  const etaSeconds = piece.pipelineEstimatedRemainingSeconds ?? undefined;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground">
        {stageLabel}
        {etaSeconds ? ` (cerca de ${etaSeconds}s restantes)` : ""}
      </p>
      {percent !== undefined ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Player melhor (Missão 11, arch. §14.10) — baixar, copiar link, compartilhar (Web Share API quando disponível). */
function MediaActions({ mediaUrl, label }: { mediaUrl: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ url: mediaUrl, title: `${label} — Ayon Creator` });
        return;
      } catch {
        // Usuário cancelou o compartilhamento nativo — cai no fallback de copiar link.
      }
    }
    await handleCopyLink();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(mediaUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard — sem crash, só não mostra a confirmação.
    }
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <a
        href={mediaUrl}
        download
        className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
      >
        Baixar
      </a>
      <Button type="button" size="sm" variant="outline" onClick={handleCopyLink}>
        {copied ? "Link copiado!" : "Copiar link"}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={handleShare}>
        Compartilhar
      </Button>
    </div>
  );
}
