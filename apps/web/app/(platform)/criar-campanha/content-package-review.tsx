"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from "@ayon/ui";
import {
  approveContentPieceAction,
  editContentPieceAction,
  regenerateContentPieceAction,
  rejectContentPieceAction,
  uploadContentPieceMediaAction,
  type ContentPieceView,
} from "./asset-actions";

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
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      {piece.status === "draft"
                        ? "Envie o arquivo dessa peça (mídia própria)."
                        : "Arquivo enviado — pronto para revisão."}
                    </p>
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
