"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@ayon/ui";
import { VOICE_CATALOG, type PhotoVisualOverrides } from "@ayon/core";
import { VoicePicker } from "@/components/voice-picker";
import {
  addSceneTextBalloonAction,
  applySceneCandidateAction,
  approveContentPieceAction,
  approveVideoScenePlanAction,
  deleteReplacementSceneAction,
  editContentPieceAction,
  generateAvatarVideoContentPieceAction,
  generatePhotoContentPieceAction,
  generateReplacementSceneAction,
  generateVideoContentPieceAction,
  getContentPieceAction,
  listAvatarVoicesAction,
  duplicateVideoSceneAction,
  regenerateContentPieceAction,
  rejectContentPieceAction,
  removeSceneTextBalloonAction,
  replaceSceneWithAvatarAction,
  reopenVideoScenePlanAction,
  reorderVideoScenesAction,
  searchAvatarBackgroundImagesAction,
  searchSceneCandidatesAction,
  selectContentPieceVersionAction,
  setSceneAudioCutSecondsAction,
  setSceneAudioPlaybackRateAction,
  setSceneDurationAction,
  setSceneTrimAction,
  suggestSceneAiPromptAction,
  swapVideoVoiceAction,
  updateVisualOverridesAction,
  uploadContentPieceMediaAction,
  uploadReplacementSceneAction,
  type ContentPieceActionResult,
  type ContentPieceView,
  type SceneCandidateView,
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
  scenes_ready_for_review: "Cenas prontas — revise antes de gerar",
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
  // ★ Achado real (pedido direto do usuário — "gerando o vídeo com avatar não
  // sai disso"): geração com avatar roda numa chamada só, minutos de
  // duração — sem essas etapas nomeadas, a tela ficava sem feedback nenhum
  // durante a espera (e sem recuperar o progresso se a página recarregasse).
  generating_look_variant: "Gerando variação de roupa/estilo...",
  generating_avatar_video: "Gerando vídeo com o avatar...",
};

export interface ContentPackageReviewProps {
  brandName: string;
  initialContentPieces: ContentPieceView[];
  /** ★ Sprint de estabilização — título da campanha, quando revisitada via `/campanhas/[id]` (ausente no fluxo de criação, onde o título ainda não importa para o usuário). */
  campaignTitle?: string;
  /** ★ Sprint de estabilização — pacote já montado em uma sessão anterior (`campaigns.status === "package_ready"`), para não exigir reaprovar tudo de novo só para ver o link de download. */
  initialPackageReady?: boolean;
  initialDownloadUrl?: string;
  /** ★ Achado real (pedido direto do usuário — "em que momento ele vai dar a opção de gerar vídeo de avatar?"): quando pronto, a peça `video` ganha um 2º jeito de gerar. */
  avatarReady: boolean;
  avatarName: string | null;
  /** ★ Achado real (pedido direto do usuário — "e eu faço isso pelo heygen?"): looks extras treinados a partir de um 2º vídeo real (ângulo/roupa diferente, mesmo rosto) — só os `"completed"` aparecem como opção na hora de gerar. */
  avatarLooks: { lookId: string; name: string; status: string }[];
}

export function ContentPackageReview({
  brandName,
  initialContentPieces,
  campaignTitle,
  initialPackageReady,
  initialDownloadUrl,
  avatarReady,
  avatarName,
  avatarLooks,
}: ContentPackageReviewProps) {
  const [pieces, setPieces] = useState<ContentPieceView[]>(initialContentPieces);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftScript, setDraftScript] = useState("");
  /** ★ Sprint de estabilização — nicho opcional por peça ao regenerar imagem (ex.: "praia", "shows"), achado real: busca automática ainda genérica demais para o gosto do usuário em alguns casos. */
  const [photoNicheDrafts, setPhotoNicheDrafts] = useState<Record<string, string>>({});
  // ★ Achado real (pedido direto do usuário — item 7, "editor de Stories...
  // editar o texto, aumentar/diminuir fonte, alterar tamanho e movimentar a
  // marca"): painel próprio por peça, só pro formato Stories — controles
  // numéricos/preset (a composição roda no Shotstack, servidor, não um
  // canvas ao vivo no navegador — não dá pra arrastar direto sobre o
  // preview real).
  const [visualEditorOpenFor, setVisualEditorOpenFor] = useState<string | null>(null);
  const [visualEditorDraft, setVisualEditorDraft] = useState<PhotoVisualOverrides>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [packageReady, setPackageReady] = useState(initialPackageReady ?? false);
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>(initialDownloadUrl);
  // ★ Achado real (pedido direto do usuário — "não gostei do cenário e minha
  // voz ficou estranha... tem como eu mudar o cenário, ângulo?"): painel por
  // geração (nunca um padrão fixo da marca) — cor de fundo, voz e prompt de
  // roupa/estilo, todos opcionais.
  const [avatarPanelOpenFor, setAvatarPanelOpenFor] = useState<string | null>(null);
  // ★ Achado real (pedido direto do usuário — "criar uma opção para trocar
  // somente a voz de um vídeo já gerado, sem precisar refazer todo o
  // processo"): painel próprio (nunca reaproveita `avatarPanelOpenFor`,
  // que é do fluxo de gerar/regerar inteiro) — só pergunta a voz nova.
  const [voiceSwapOpenFor, setVoiceSwapOpenFor] = useState<string | null>(null);
  const [voiceSwapDraft, setVoiceSwapDraft] = useState<string | null>(null);
  const [avatarVoices, setAvatarVoices] = useState<{ voiceId: string; name: string; gender?: string; language?: string }[] | null>(
    null,
  );
  const [avatarVoicesLoading, setAvatarVoicesLoading] = useState(false);
  const [avatarVoiceDraft, setAvatarVoiceDraft] = useState("");
  const [avatarBackgroundDraft, setAvatarBackgroundDraft] = useState("");
  const [avatarOutfitDraft, setAvatarOutfitDraft] = useState("");
  const [avatarLookDraft, setAvatarLookDraft] = useState("");
  // ★ Achado real (pedido direto do usuário — "eu achava que ele seria capaz
  // de criar os vídeos em ambientes tipo aeroporto, escritório, praia"):
  // cenário por foto real (banco licenciado) — mesma UX de busca com várias
  // opções já usada pra trocar cena de vídeo. `avatarBackgroundImageDraft`
  // tem prioridade sobre `avatarBackgroundDraft` (cor) quando preenchido.
  const [avatarScenarioQuery, setAvatarScenarioQuery] = useState("");
  const [avatarScenarioSearching, setAvatarScenarioSearching] = useState(false);
  const [avatarScenarioCandidates, setAvatarScenarioCandidates] = useState<
    { id: string; previewUrl: string; downloadUrl: string }[] | null
  >(null);
  const [avatarBackgroundImageDraft, setAvatarBackgroundImageDraft] = useState("");
  // ★ Achado real (pedido direto do usuário — "eu quero poder escolher a
  // duração do vídeo, a quantidade média de cenas"): mesmo painel de opções
  // já usado pro avatar, agora reaproveitado também pelo caminho automático
  // (banco de vídeo licenciado) — `pendingGenerateMode` decide quais campos
  // aparecem (duração vale pros 2 caminhos; duração média de cena só faz
  // sentido no automático, que tem cenas discretas).
  const [pendingGenerateMode, setPendingGenerateMode] = useState<"auto" | "avatar">("auto");
  const [durationDraft, setDurationDraft] = useState("");
  const [avgSceneSecondsDraft, setAvgSceneSecondsDraft] = useState("");
  // ★ Achado real (pedido direto do usuário — "deixar opcional que o vídeo
  // tenha a logo ou não. e deixar a opção de ter a marca d'água com o insta
  // ou nome da empresa"): só faz sentido no caminho automático (o único que
  // passa por composição/Shotstack — o avatar puro não tem logo/marca
  // d'água hoje). Logo ligada por padrão (comportamento de sempre); marca
  // d'água desligada por padrão (opt-in).
  const [includeLogoDraft, setIncludeLogoDraft] = useState(true);
  const [watermarkEnabledDraft, setWatermarkEnabledDraft] = useState(false);
  const [watermarkTextDraft, setWatermarkTextDraft] = useState("");
  // ★ Achado real (pedido direto do usuário — "incluir título de capa...
  // quero que o vídeo seja bem blogueiro TikTok"): opt-in (desligado por
  // padrão) — muda a estética do vídeo, nunca um padrão novo silencioso.
  const [includeCoverTitleDraft, setIncludeCoverTitleDraft] = useState(false);
  // ★ Achado real (pedido direto do usuário — "não tem a opção de escolher
  // o que colocar no título e nem o formato"): texto vazio cai no título
  // sugerido automaticamente (brief da campanha) — digitar aqui sempre
  // vence. Posição escolhe onde o bloco aparece na tela.
  const [coverTitleTextDraft, setCoverTitleTextDraft] = useState("");
  const [coverTitlePositionDraft, setCoverTitlePositionDraft] = useState<"top" | "center" | "bottom">("center");
  // ★ Achado real (pedido direto do usuário — "não vi... animação sonora"): opt-in, mesmo espírito de includeCoverTitleDraft.
  const [includeSoundAnimationDraft, setIncludeSoundAnimationDraft] = useState(false);

  function updatePiece(updated: ContentPieceView) {
    setPieces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  // Polling simples (Fluxo 13/15 — sem Realtime no MVP) enquanto alguma peça
  // de vídeo/foto está `generating`: verifica a cada poucos segundos até sair
  // desse estado (ready_for_review ou failed), então para sozinho.
  // ★ Achado real (pedido direto do usuário — "gerando o vídeo com avatar
  // não sai disso"): `ai_avatar` nunca entrava aqui — a geração já rodava
  // do mesmo jeito síncrono (1 chamada só, minutos) que
  // `licensed_stock_video`/`licensed_stock_photo`, mas sem esse filtro
  // incluir o modo, um reload no meio da espera nunca reativava o polling
  // (a peça carregava com `status: "generating"` vindo do banco, só que o
  // efeito abaixo a ignorava) — a tela ficava presa em "Aguardando" mesmo
  // com o trabalho de verdade rodando (e terminando) no servidor.
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const generatingIds = pieces
      .filter(
        (p) =>
          (p.productionMode === "licensed_stock_video" ||
            p.productionMode === "licensed_stock_photo" ||
            p.productionMode === "ai_avatar") &&
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

  /** ★ Achado real (pedido direto do usuário — "eu havia aprovado um vídeo e depois queria uma cena e não consegui mais voltar, criou outro"): volta o MESMO corte já aprovado pra edição de cenas, em vez de gerar um plano novo do zero. */
  async function handleReopenScenePlan(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await reopenVideoScenePlanAction(pieceId));
  }

  function openVoiceSwapPanel(pieceId: string) {
    setVoiceSwapOpenFor((current) => (current === pieceId ? null : pieceId));
    setVoiceSwapDraft(null);
  }

  async function handleSwapVoice(pieceId: string) {
    if (!voiceSwapDraft) return;
    setLoadingId(pieceId);
    setVoiceSwapOpenFor(null);
    handleActionResult(await swapVideoVoiceAction(pieceId, voiceSwapDraft));
  }

  async function handleRegenerate(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await regenerateContentPieceAction(pieceId));
  }

  async function handleGenerateVideo(
    pieceId: string,
    options?: {
      targetDurationSeconds?: number;
      avgSceneSeconds?: number;
      includeLogo?: boolean;
      watermarkText?: string;
      includeCoverTitle?: boolean;
      coverTitleText?: string;
      coverTitlePosition?: "top" | "center" | "bottom";
      includeSoundAnimation?: boolean;
    },
  ) {
    setLoadingId(pieceId);
    handleActionResult(await generateVideoContentPieceAction(pieceId, options));
  }

  /** ★ Achado real (pedido direto do usuário — "duração do vídeo, quantidade média de cenas"): mesmo painel serve pros 2 caminhos de gerar vídeo — `mode` decide quais campos aparecem e qual ação o botão de confirmar dispara. */
  async function openGenerateOptionsPanel(pieceId: string, mode: "auto" | "avatar") {
    const opening = avatarPanelOpenFor !== pieceId || pendingGenerateMode !== mode;
    setAvatarPanelOpenFor(opening ? pieceId : null);
    setPendingGenerateMode(mode);
    if (opening) {
      setAvatarVoiceDraft("");
      setAvatarBackgroundDraft("");
      setAvatarOutfitDraft("");
      setAvatarLookDraft("");
      setAvatarScenarioQuery("");
      setAvatarScenarioCandidates(null);
      setAvatarBackgroundImageDraft("");
      setDurationDraft("");
      setAvgSceneSecondsDraft("");
      setIncludeLogoDraft(true);
      setWatermarkEnabledDraft(false);
      setWatermarkTextDraft("");
      setIncludeCoverTitleDraft(false);
      setCoverTitleTextDraft("");
      setCoverTitlePositionDraft("center");
      setIncludeSoundAnimationDraft(false);
      if (mode === "avatar" && !avatarVoices && !avatarVoicesLoading) {
        setAvatarVoicesLoading(true);
        const result = await listAvatarVoicesAction();
        setAvatarVoicesLoading(false);
        if (result.ok) setAvatarVoices(result.voices ?? []);
      }
    }
  }

  async function handleGenerateAvatarVideo(pieceId: string) {
    setLoadingId(pieceId);
    setAvatarPanelOpenFor(null);
    handleActionResult(
      await generateAvatarVideoContentPieceAction(pieceId, {
        voiceId: avatarVoiceDraft || undefined,
        backgroundColorHex: avatarBackgroundDraft || undefined,
        backgroundImageUrl: avatarBackgroundImageDraft || undefined,
        outfitPrompt: avatarOutfitDraft || undefined,
        avatarLookId: avatarLookDraft || undefined,
        targetDurationSeconds: durationDraft ? Number(durationDraft) : undefined,
      }),
    );
  }

  function handleGenerateWithPanelOptions(pieceId: string) {
    if (pendingGenerateMode === "avatar") {
      handleGenerateAvatarVideo(pieceId);
      return;
    }
    setAvatarPanelOpenFor(null);
    handleGenerateVideo(pieceId, {
      targetDurationSeconds: durationDraft ? Number(durationDraft) : undefined,
      avgSceneSeconds: avgSceneSecondsDraft ? Number(avgSceneSecondsDraft) : undefined,
      includeLogo: includeLogoDraft,
      watermarkText: watermarkEnabledDraft ? watermarkTextDraft : undefined,
      includeCoverTitle: includeCoverTitleDraft,
      coverTitleText: includeCoverTitleDraft ? coverTitleTextDraft : undefined,
      coverTitlePosition: includeCoverTitleDraft ? coverTitlePositionDraft : undefined,
      includeSoundAnimation: includeSoundAnimationDraft,
    });
  }

  async function handleSearchAvatarScenario(query: string) {
    if (!query.trim() || avatarScenarioSearching) return;
    setAvatarScenarioSearching(true);
    setAvatarScenarioQuery(query);
    const result = await searchAvatarBackgroundImagesAction(query);
    setAvatarScenarioSearching(false);
    setAvatarScenarioCandidates(result.ok ? result.candidates ?? [] : []);
  }

  async function handleApproveScenePlan(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await approveVideoScenePlanAction(pieceId));
  }

  /** ★ Achado real (pedido direto do usuário — "baixar todas as cenas e ela fazer a edição... ou baixar o vídeo todo de uma vez"): nunca aprova nem muda a peça, só baixa um .zip com as cenas atuais + narração. */
  /**
   * ★ Achado real (pedido direto do usuário — "The object exceeded the
   * maximum allowed size"): a versão anterior gerava uma signed URL do
   * Supabase Storage e navegava até ela (`location.href`) — só que o
   * upload do .zip pro Storage vinha ANTES, e Storage recusa qualquer
   * objeto acima do limite do plano. A rota `app/api/scene-package/
   * [contentPieceId]` monta e transmite o .zip direto na resposta, sem
   * Storage no meio — busca com `fetch` (nunca falha silenciosamente:
   * resposta não-ok mostra a mensagem real do servidor) e baixa via link
   * sintético a partir do blob recebido — mesmo espírito de nunca depender
   * de `window.open` (bloqueado como pop-up após um `await`).
   */
  async function handleDownloadScenePackage(pieceId: string) {
    setLoadingId(pieceId);
    setError(null);
    let response: Response;
    try {
      response = await fetch(`/api/scene-package/${pieceId}`);
    } catch {
      setLoadingId(null);
      setError("Não consegui preparar o pacote de cenas agora. Tenta de novo?");
      return;
    }
    setLoadingId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "cenas.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }

  async function handleGeneratePhoto(pieceId: string) {
    setLoadingId(pieceId);
    handleActionResult(await generatePhotoContentPieceAction(pieceId, photoNicheDrafts[pieceId]));
  }

  function openVisualEditor(piece: ContentPieceView) {
    setVisualEditorOpenFor((current) => (current === piece.id ? null : piece.id));
    setVisualEditorDraft(piece.visualOverrides ?? {});
  }

  async function handleSaveVisualOverrides(pieceId: string) {
    setLoadingId(pieceId);
    setVisualEditorOpenFor(null);
    handleActionResult(await updateVisualOverridesAction(pieceId, visualEditorDraft));
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
        <div>
          <Link href="/campanhas" className="text-sm text-muted-foreground underline underline-offset-4">
            Voltar para Campanhas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="space-y-1">
        {campaignTitle ? (
          <Link href="/campanhas" className="text-sm text-muted-foreground underline underline-offset-4">
            &larr; Voltar para Campanhas
          </Link>
        ) : null}
        <h1 className="text-xl font-semibold text-foreground">
          {campaignTitle ? campaignTitle : "Revisão do pacote de conteúdo"}
        </h1>
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
          // ★ Achado real (pedido direto do usuário — "em que momento ele vai
          // dar a opção de gerar vídeo de avatar?"): `productionMode` deixou
          // de ser fixo pra peça `video` — pode virar `ai_avatar` depois de
          // uma geração por avatar, e o card precisa continuar mostrando o
          // preview/botões de vídeo (nunca cair no branch genérico). Checa o
          // formato (só existe 1 peça `video` por campanha, sempre gerada
          // por `licensed_stock_video` ou `ai_avatar`), nunca mais o modo de
          // produção atual.
          const isVideoAutoGenerated = piece.format === "video";
          const isPhotoAutoGenerated = piece.productionMode === "licensed_stock_photo";
          const isEditing = editingId === piece.id;
          // ★ Achado real (pedido direto do usuário — "roteiro editável mostrado
          // junto da tela de revisão do vídeo"): o roteiro real mora na peça
          // "Roteiro" (`isPrimary`, formato `script`), separada da peça de
          // vídeo — antes só dava pra editar indo até o card dela. Reaproveita
          // 100% o mesmo `editingId`/`draftScript`/`startEditing`/`saveEdit` já
          // usados no card de texto acima, só apontando pro `scriptPiece`
          // (nunca `piece`, que é o vídeo) — sem estado novo.
          const scriptPiece = pieces.find((p) => p.isPrimary);
          const isEditingScript = scriptPiece ? editingId === scriptPiece.id : false;
          // ★ `loadingId`/`isLoading` acima refletem o vídeo (`piece.id`) —
          // salvar o roteiro usa `scriptPiece.id`, precisa do seu próprio
          // flag pros botões do bloco de roteiro não ficarem sempre habilitados
          // enquanto salvam (ou travados por um loading que é de outra peça).
          const isLoadingScript = scriptPiece ? loadingId === scriptPiece.id : false;

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
                        Gere o vídeo automaticamente — a narração usa o roteiro da peça &quot;Roteiro&quot; desta campanha,
                        cenas de banco de vídeo licenciado e identidade visual da marca, montados em um MP4 vertical
                        pronto. Se a peça &quot;Roteiro&quot; ainda não tiver conteúdo, gere/edite ela primeiro.
                      </p>
                    ) : piece.status === "generating" ? (
                      <GenerationProgress piece={piece} />
                    ) : piece.status === "failed" ? (
                      <p className="text-destructive">{failureMessage(piece, "esse vídeo")}</p>
                    ) : piece.status === "rejected" ? (
                      // ★ Achado real (pedido direto do usuário — "quando eu
                      // rejeitar um vídeo eu quero que ele suma pra eu gerar
                      // de novo"): rejeitar só mudava o status, nunca escondia
                      // o vídeo antigo (`piece.mediaUrl` continuava sendo
                      // exibido) nem liberava os botões de gerar de novo (as
                      // condições abaixo checavam `draft`/`failed`, nunca
                      // `rejected`) — a peça ficava "presa" mostrando o vídeo
                      // rejeitado sem nenhuma ação possível.
                      <p className="text-muted-foreground">Vídeo rejeitado — gere um novo abaixo.</p>
                    ) : piece.status === "scenes_ready_for_review" && piece.pendingScenePlan ? (
                      <>
                        {scriptPiece ? (
                          <div className="space-y-2 rounded-md border border-border p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Roteiro</p>
                            {isEditingScript ? (
                              <>
                                <Textarea
                                  value={draftScript}
                                  onChange={(event) => setDraftScript(event.target.value)}
                                  className="min-h-[120px]"
                                />
                                <Button size="sm" disabled={isLoadingScript} onClick={() => saveEdit(scriptPiece.id)}>
                                  {isLoadingScript ? "Salvando..." : "Salvar roteiro"}
                                </Button>
                              </>
                            ) : (
                              <>
                                <p className="whitespace-pre-wrap text-foreground">{scriptPiece.script ?? "Ainda não gerado."}</p>
                                <Button size="sm" variant="outline" disabled={isLoadingScript} onClick={() => startEditing(scriptPiece)}>
                                  Editar roteiro
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                  Editou o roteiro? Clique em &quot;Gerar novo plano&quot; abaixo para a narração e as cenas
                                  acompanharem o texto novo.
                                </p>
                              </>
                            )}
                          </div>
                        ) : null}
                        <VideoScenePlanReview
                          pieceId={piece.id}
                          plan={piece.pendingScenePlan}
                          onUpdated={updatePiece}
                          avatarReady={avatarReady}
                          avatarName={avatarName}
                        />
                      </>
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
                      {piece.status === "draft" || piece.status === "failed" || piece.status === "rejected" ? (
                        <Button size="sm" disabled={isLoading} onClick={() => openGenerateOptionsPanel(piece.id, "auto")}>
                          {isLoading
                            ? "Iniciando..."
                            : piece.status === "failed" || piece.status === "rejected"
                              ? "Tentar novamente"
                              : "Gerar vídeo automaticamente"}
                        </Button>
                      ) : null}
                      {(piece.status === "draft" || piece.status === "failed" || piece.status === "rejected") && avatarReady ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => openGenerateOptionsPanel(piece.id, "avatar")}
                        >
                          {isLoading ? "Gerando..." : `Gerar com avatar (${avatarName})`}
                        </Button>
                      ) : null}
                      {piece.status === "scenes_ready_for_review" ? (
                        <>
                          <Button size="sm" disabled={isLoading} onClick={() => handleApproveScenePlan(piece.id)}>
                            {isLoading ? "Gerando vídeo..." : "Aprovar e gerar vídeo"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => openGenerateOptionsPanel(piece.id, "auto")}
                          >
                            Gerar novo plano
                          </Button>
                          {/* ★ Achado real (pedido direto do usuário — "baixar
                              todas as cenas e ela fazer a edição... ou baixar o
                              vídeo todo de uma vez, já com as transições
                              internas"): alternativa a aprovar — nunca compõe
                              nada, só baixa as cenas atuais + narração pra
                              edição própria em qualquer editor. */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleDownloadScenePackage(piece.id)}
                          >
                            {isLoading ? "Preparando..." : "Baixar todas as cenas (.zip)"}
                          </Button>
                          {/* ★ Achado real (pedido direto do usuário — "quando eu gero
                              um vídeo, eu não consigo mais resetar pra gerar só com
                              avatar"): esse estado (cenas prontas pra revisão) nunca
                              oferecia o caminho de avatar — só dava pra sair dele
                              aprovando o plano ou gerando outro plano automático,
                              nunca pulando direto pro vídeo 100% avatar. */}
                          {avatarReady ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => openGenerateOptionsPanel(piece.id, "avatar")}
                            >
                              Gerar com avatar ({avatarName})
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {piece.status === "ready_for_review" || piece.status === "approved" ? (
                        <>
                          <Button
                            size="sm"
                            disabled={isLoading || piece.status === "approved"}
                            onClick={() => handleApprove(piece.id)}
                          >
                            Aprovar
                          </Button>
                          {/* ★ Achado real (pedido direto do usuário — "eu
                              havia aprovado um vídeo e depois queria uma
                              cena e não consegui mais voltar, criou outro"):
                              volta pro MESMO corte já aprovado em modo de
                              edição de cenas (reabre a tela de
                              trocar/cortar/reordenar/excluir/baixar .zip) —
                              nunca gera um plano novo do zero. */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleReopenScenePlan(piece.id)}
                          >
                            {isLoading ? "Reabrindo..." : "Editar cenas de novo"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => openGenerateOptionsPanel(piece.id, "auto")}
                          >
                            Gerar de novo (do zero)
                          </Button>
                          {avatarReady ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => openGenerateOptionsPanel(piece.id, "avatar")}
                            >
                              Gerar com avatar ({avatarName})
                            </Button>
                          ) : null}
                          {/* ★ Achado real (pedido direto do usuário — "criar
                              uma opção para trocar somente a voz de um vídeo
                              já gerado, sem precisar refazer todo o
                              processo"): só faz sentido pro caminho de banco
                              de vídeo licenciado — vídeo de avatar tem a voz
                              junto do rosto (swapVideoVoiceAction recusa com
                              uma mensagem clara se tentado mesmo assim). */}
                          {piece.productionMode === "licensed_stock_video" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => openVoiceSwapPanel(piece.id)}
                            >
                              Trocar voz
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => handleReject(piece.id)}>
                            Rejeitar
                          </Button>
                        </>
                      ) : null}
                    </div>

                    {voiceSwapOpenFor === piece.id ? (
                      <div className="space-y-3 rounded-md border border-border p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Trocar a voz — mantém roteiro, cenas, ordem, duração e marca/logo
                        </p>
                        <VoicePicker options={VOICE_CATALOG} value={voiceSwapDraft} onChange={setVoiceSwapDraft} />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={isLoading || !voiceSwapDraft} onClick={() => handleSwapVoice(piece.id)}>
                            {isLoading ? "Recompondo..." : "Confirmar troca de voz"}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => setVoiceSwapOpenFor(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {avatarPanelOpenFor === piece.id ? (
                      <div className="space-y-3 rounded-md border border-border p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {pendingGenerateMode === "avatar"
                            ? "Opções do avatar (todas opcionais — deixe em branco pra manter o padrão)"
                            : "Opções de geração (todas opcionais — deixe em branco pra manter o padrão)"}
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label htmlFor={`duration-${piece.id}`} className="text-xs text-muted-foreground">
                              Duração do vídeo
                            </label>
                            <select
                              id={`duration-${piece.id}`}
                              value={durationDraft}
                              onChange={(event) => setDurationDraft(event.target.value)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Padrão (segue o roteiro atual)</option>
                              <option value="15">~15s</option>
                              <option value="30">~30s</option>
                              <option value="45">~45s</option>
                              <option value="60">~60s</option>
                            </select>
                          </div>

                          {pendingGenerateMode === "auto" ? (
                            <div className="space-y-2">
                              <label htmlFor={`scene-length-${piece.id}`} className="text-xs text-muted-foreground">
                                Duração média por cena
                              </label>
                              <select
                                id={`scene-length-${piece.id}`}
                                value={avgSceneSecondsDraft}
                                onChange={(event) => setAvgSceneSecondsDraft(event.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="">Padrão (cortes rápidos, ~3s)</option>
                                <option value="2">Curta (~2s) — mais cenas</option>
                                <option value="4">Média (~4s)</option>
                                <option value="7">Longa (~7s) — menos cenas</option>
                              </select>
                            </div>
                          ) : null}
                        </div>

                        {/* ★ Achado real (pedido direto do usuário — "deixar
                            opcional que o vídeo tenha a logo ou não. e deixar
                            a opção de ter a marca d'água com o insta ou nome
                            da empresa... sutil e em algum dos cantos"): só no
                            caminho automático — o único que passa por
                            composição (Shotstack), o avatar puro não tem
                            logo/marca d'água hoje. */}
                        {pendingGenerateMode === "auto" ? (
                          <div className="space-y-2 rounded-md border border-border/60 p-3">
                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                checked={includeLogoDraft}
                                onChange={(event) => setIncludeLogoDraft(event.target.checked)}
                              />
                              Incluir logo da marca
                            </label>
                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                checked={watermarkEnabledDraft}
                                onChange={(event) => setWatermarkEnabledDraft(event.target.checked)}
                              />
                              Marca d&apos;água (@insta ou nome da empresa, discreta num canto)
                            </label>
                            {watermarkEnabledDraft ? (
                              <Input
                                value={watermarkTextDraft}
                                onChange={(event) => setWatermarkTextDraft(event.target.value)}
                                placeholder="Ex.: @viajartodocanto"
                                className="max-w-xs"
                              />
                            ) : null}
                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                checked={includeCoverTitleDraft}
                                onChange={(event) => setIncludeCoverTitleDraft(event.target.checked)}
                              />
                              Título de capa (sobre os primeiros segundos, estilo TikTok)
                            </label>
                            {/* ★ Achado real (pedido direto do usuário —
                                "não tem a opção de escolher o que colocar
                                no título e nem o formato"): antes o texto
                                era sempre sugerido automaticamente, sem
                                jeito de escrever o próprio ou escolher onde
                                aparece na tela. */}
                            {includeCoverTitleDraft ? (
                              <div className="space-y-2 pl-6">
                                <Input
                                  value={coverTitleTextDraft}
                                  onChange={(event) => setCoverTitleTextDraft(event.target.value)}
                                  placeholder="Deixe em branco para eu sugerir um título"
                                  className="max-w-xs"
                                />
                                <div className="flex items-center gap-2">
                                  <label htmlFor="cover-title-position" className="text-xs text-muted-foreground">
                                    Posição na tela
                                  </label>
                                  <select
                                    id="cover-title-position"
                                    value={coverTitlePositionDraft}
                                    onChange={(event) =>
                                      setCoverTitlePositionDraft(event.target.value as "top" | "center" | "bottom")
                                    }
                                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                  >
                                    <option value="top">Topo</option>
                                    <option value="center">Centro</option>
                                    <option value="bottom">Base</option>
                                  </select>
                                </div>
                              </div>
                            ) : null}
                            {/* ★ Achado real (pedido direto do usuário — "não vi... animação sonora"): opt-in, mesmo espírito do título de capa. */}
                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                checked={includeSoundAnimationDraft}
                                onChange={(event) => setIncludeSoundAnimationDraft(event.target.checked)}
                              />
                              Animação sonora (barra reagindo à narração, estilo CapCut) — só com o motor ffmpeg ativo
                            </label>
                          </div>
                        ) : null}

                        {/* ★ Achado real (pedido direto do usuário — "o rosto não sou eu"):
                            desativado temporariamente — validado que o `type: "prompt"`
                            referenciando `avatar_id` NÃO preserva a identidade real de
                            forma confiável, apesar da documentação da HeyGen afirmar o
                            contrário. Nunca reativar sem validar visualmente de novo. */}

                        {pendingGenerateMode === "avatar" && avatarLooks.filter((look) => look.status === "completed").length > 0 ? (
                          <div className="space-y-2">
                            <label htmlFor={`avatar-look-${piece.id}`} className="text-xs text-muted-foreground">
                              Look (ângulo/roupa)
                            </label>
                            <select
                              id={`avatar-look-${piece.id}`}
                              value={avatarLookDraft}
                              onChange={(event) => setAvatarLookDraft(event.target.value)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">{avatarName ?? "Padrão"} (look principal)</option>
                              {avatarLooks
                                .filter((look) => look.status === "completed")
                                .map((look) => (
                                  <option key={look.lookId} value={look.lookId}>
                                    {look.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : null}

                        {pendingGenerateMode === "avatar" ? (
                        <>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">Cenário (foto real de fundo)</label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: "Aeroporto", query: "aeroporto terminal janela" },
                              { label: "Escritório", query: "escritório moderno janela" },
                              { label: "Praia", query: "praia mar horizonte" },
                            ].map((preset) => (
                              <Button
                                key={preset.label}
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={avatarScenarioSearching}
                                onClick={() => handleSearchAvatarScenario(preset.query)}
                              >
                                {preset.label}
                              </Button>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={avatarScenarioQuery}
                              onChange={(event) => setAvatarScenarioQuery(event.target.value)}
                              placeholder="Outro cenário (ex.: café, academia, loja)"
                              className="max-w-xs"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={avatarScenarioSearching || !avatarScenarioQuery.trim()}
                              onClick={() => handleSearchAvatarScenario(avatarScenarioQuery)}
                            >
                              {avatarScenarioSearching ? "Buscando..." : "Buscar"}
                            </Button>
                            {avatarBackgroundImageDraft ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAvatarBackgroundImageDraft("");
                                  setAvatarScenarioCandidates(null);
                                }}
                              >
                                Remover cenário
                              </Button>
                            ) : null}
                          </div>

                          {avatarScenarioCandidates ? (
                            <div className="space-y-1 rounded-md bg-secondary/40 p-2">
                              {avatarScenarioCandidates.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nenhum resultado — tenta outro termo.</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {avatarScenarioCandidates.map((candidate) => (
                                    <button
                                      key={candidate.id}
                                      type="button"
                                      onClick={() => setAvatarBackgroundImageDraft(candidate.downloadUrl)}
                                      className={`h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 ${
                                        avatarBackgroundImageDraft === candidate.downloadUrl
                                          ? "border-primary"
                                          : "border-transparent"
                                      }`}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={candidate.previewUrl} alt="Opção de cenário" className="h-full w-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <label htmlFor={`avatar-bg-${piece.id}`} className="text-xs text-muted-foreground">
                            Cor de fundo (usada só se nenhum cenário por foto for escolhido acima)
                          </label>
                          <Input
                            id={`avatar-bg-${piece.id}`}
                            type="color"
                            value={avatarBackgroundDraft || "#ffffff"}
                            onChange={(event) => setAvatarBackgroundDraft(event.target.value)}
                            className="h-10 w-20 p-1"
                          />
                        </div>

                        <div className="space-y-2">
                          <label htmlFor={`avatar-voice-${piece.id}`} className="text-xs text-muted-foreground">
                            Voz
                          </label>
                          <select
                            id={`avatar-voice-${piece.id}`}
                            value={avatarVoiceDraft}
                            onChange={(event) => setAvatarVoiceDraft(event.target.value)}
                            disabled={avatarVoicesLoading}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Voz clonada do avatar (padrão)</option>
                            {(avatarVoices ?? []).map((voice) => (
                              <option key={voice.voiceId} value={voice.voiceId}>
                                {voice.name} {voice.gender ? `— ${voice.gender}` : ""} {voice.language ? `(${voice.language})` : ""}
                              </option>
                            ))}
                          </select>
                          {avatarVoicesLoading ? <p className="text-xs text-muted-foreground">Carregando vozes...</p> : null}
                        </div>
                        </>
                        ) : null}

                        <div className="flex gap-2">
                          <Button size="sm" disabled={isLoading} onClick={() => handleGenerateWithPanelOptions(piece.id)}>
                            {isLoading ? "Gerando..." : "Gerar vídeo com essas opções"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAvatarPanelOpenFor(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : isPhotoAutoGenerated ? (
                  <>
                    {piece.status === "generating" ? (
                      <GenerationProgress piece={piece} />
                    ) : piece.status === "failed" ? (
                      <p className="text-destructive">{failureMessage(piece, "essa imagem")}</p>
                    ) : piece.slideMediaUrls && piece.slideMediaUrls.length > 1 ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground">Carrossel — {piece.slideMediaUrls.length} lâminas:</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {piece.slideMediaUrls.map((url, index) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={url}
                              src={url}
                              alt={`Lâmina ${index + 1}`}
                              className="aspect-square w-40 shrink-0 rounded-md object-cover"
                            />
                          ))}
                        </div>
                        <MediaActions mediaUrl={piece.slideMediaUrls[0]!} label="1ª lâmina do carrossel" />
                      </div>
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

                    {/* ★ Achado real (pedido direto do usuário — item 7,
                        "no formato Stories, melhorar o controle de
                        elementos... marca menor por padrão, permitir
                        alterar tamanho e movimentar; editar o texto,
                        aumentar/diminuir a fonte"): só faz sentido pro
                        formato Stories (ela escopou explicitamente a esse
                        formato) — carrossel usa lâminas com texto próprio
                        por lâmina, thumbnail é mais simples/estático. */}
                    {piece.format === "stories" && piece.mediaUrl ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => openVisualEditor(piece)}
                        >
                          Editar texto e marca
                        </Button>

                        {visualEditorOpenFor === piece.id ? (
                          <div className="space-y-3 rounded-md border border-border p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Texto e marca desta peça — salvar gera de novo com esses ajustes
                            </p>

                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Título</label>
                              <Input
                                value={visualEditorDraft.titleText ?? ""}
                                onChange={(event) =>
                                  setVisualEditorDraft((prev) => ({ ...prev, titleText: event.target.value || null }))
                                }
                                placeholder="Deixe em branco pra usar o título gerado automaticamente"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Subtítulo</label>
                              <Input
                                value={visualEditorDraft.subheadlineText ?? ""}
                                onChange={(event) =>
                                  setVisualEditorDraft((prev) => ({ ...prev, subheadlineText: event.target.value || null }))
                                }
                                placeholder="Deixe em branco pra usar o gerado automaticamente"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Chamada para ação (CTA)</label>
                              <Input
                                value={visualEditorDraft.ctaTextOverride ?? ""}
                                onChange={(event) =>
                                  setVisualEditorDraft((prev) => ({ ...prev, ctaTextOverride: event.target.value || null }))
                                }
                                placeholder="Deixe em branco pra usar o gerado automaticamente"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Tamanho da fonte</label>
                                <select
                                  value={visualEditorDraft.fontScale?.toString() ?? ""}
                                  onChange={(event) =>
                                    setVisualEditorDraft((prev) => ({
                                      ...prev,
                                      fontScale: event.target.value ? Number(event.target.value) : null,
                                    }))
                                  }
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                >
                                  <option value="">Padrão</option>
                                  <option value="0.75">Menor</option>
                                  <option value="1.25">Maior</option>
                                  <option value="1.5">Bem maior</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">Tamanho da marca</label>
                                <select
                                  value={visualEditorDraft.logoScale?.toString() ?? ""}
                                  onChange={(event) =>
                                    setVisualEditorDraft((prev) => ({
                                      ...prev,
                                      logoScale: event.target.value ? Number(event.target.value) : null,
                                    }))
                                  }
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                >
                                  <option value="">Padrão (pequena)</option>
                                  <option value="0.05">Bem pequena</option>
                                  <option value="0.12">Média</option>
                                  <option value="0.18">Grande</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Posição da marca</label>
                              <select
                                value={visualEditorDraft.logoPosition ?? ""}
                                onChange={(event) =>
                                  setVisualEditorDraft((prev) => ({ ...prev, logoPosition: event.target.value || null }))
                                }
                                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                              >
                                <option value="">Padrão (canto inferior direito)</option>
                                <option value="topLeft">Canto superior esquerdo</option>
                                <option value="topRight">Canto superior direito</option>
                                <option value="bottomLeft">Canto inferior esquerdo</option>
                                <option value="bottomRight">Canto inferior direito</option>
                                <option value="top">Topo, centralizada</option>
                                <option value="bottom">Base, centralizada</option>
                                <option value="center">Centro</option>
                              </select>
                            </div>

                            <div className="flex gap-2">
                              <Button size="sm" disabled={isLoading} onClick={() => handleSaveVisualOverrides(piece.id)}>
                                {isLoading ? "Gerando..." : "Salvar e gerar de novo"}
                              </Button>
                              <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => setVisualEditorOpenFor(null)}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {piece.brandRationale ? (
                      <div className="rounded-md bg-secondary/60 px-4 py-3 text-secondary-foreground">
                        <p className="text-xs font-medium uppercase tracking-wide">Por que fiz assim?</p>
                        <p className="mt-1">{piece.brandRationale}</p>
                      </div>
                    ) : null}

                    <GenerationPromptDisclosure prompt={piece.generationPrompt} slidePrompts={piece.slideGenerationPrompts} />

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Nicho da imagem (opcional): praia, shows, gastronomia..."
                        value={photoNicheDrafts[piece.id] ?? ""}
                        onChange={(event) => setPhotoNicheDrafts((prev) => ({ ...prev, [piece.id]: event.target.value }))}
                        disabled={isLoading || piece.status === "generating"}
                        className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground"
                      />
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
 * ★ Sprint de estabilização (Missão 12, item "UX") — mensagem de falha
 * aponta em qual etapa o pipeline parou (mesmas copy amigáveis de
 * `STAGE_LABELS`, nunca o erro cru do provedor — arch. §14.9), em vez de só
 * "não conseguimos gerar" sem contexto. Usuário nunca precisa descobrir
 * sozinho qual etapa falhou.
 */
/** ★ Achado real (pedido direto do usuário — "não vi opção de colocar balões de texto... quero basicamente no modelo do capcut"): presets de posição (fração da tela) em vez de um canvas de arrastar livre — mais rápido de usar num celular, e mais simples de implementar bem. */
const BALLOON_POSITION_PRESETS = {
  topLeft: { label: "Canto superior esquerdo", xFraction: 0.06, yFraction: 0.08 },
  topRight: { label: "Canto superior direito", xFraction: 0.55, yFraction: 0.08 },
  center: { label: "Centro", xFraction: 0.15, yFraction: 0.42 },
  bottomLeft: { label: "Canto inferior esquerdo", xFraction: 0.06, yFraction: 0.68 },
  bottomRight: { label: "Canto inferior direito", xFraction: 0.55, yFraction: 0.68 },
} as const;

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;

/** `0:07` — usado pra mostrar em que momento do vídeo cada trecho do roteiro aparece (pedido direto do usuário — "associado cada frase com o momento do vídeo"). */
function formatTimestamp(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function failureMessage(piece: ContentPieceView, mediaLabelWithArticle: string): string {
  const stageLabel = piece.pipelineStage ? STAGE_LABELS[piece.pipelineStage]?.replace(/\.\.\.$/, "") : null;
  if (stageLabel) {
    return `Não conseguimos concluir a etapa "${stageLabel}" ao gerar ${mediaLabelWithArticle}. Tenta de novo?`;
  }
  return `Não conseguimos gerar ${mediaLabelWithArticle} agora. Tenta de novo em instantes?`;
}

/**
 * ★ Achado real (pedido direto do usuário — "será se não era bom a gente
 * aprovar o prompt antes de gerar o vídeo? estamos andando em círculos"):
 * mostra o plano de vídeo pendente ANTES do render caro rodar — o texto de
 * cada trecho do roteiro ao lado de uma tira com a prévia de cada cena
 * escolhida (vídeo real ou imagem gerada), pra usuário aprovar ou pedir um
 * plano novo com um contexto real, não só o resultado final depois de
 * pronto.
 */
/**
 * ★ Achado real (pedido direto do usuário — "opção de excluir/substituir
 * uma cena individual do vídeo por nova busca, geração por IA, ou upload do
 * próprio usuário"): clicar numa cena da tira seleciona ela (destaque de
 * borda); com uma selecionada, aparece o painel com as 3 origens + remover.
 * Cada ação chama sua Server Action e devolve a peça inteira atualizada
 * (`onUpdated`) — a tira reflete a troca imediatamente, sem regenerar
 * narração nem as outras cenas.
 */

const TIMELINE_PIXELS_PER_SECOND = 60;
const TIMELINE_MIN_BLOCK_WIDTH_PX = 28;
const TIMELINE_TRACK_HEIGHT_PX = 96;
const TIMELINE_WAVEFORM_HEIGHT_PX = 48;
/** Abaixo disso (em px) um pointerdown+up conta como clique (seleciona a cena), não como arrasto — mesmo limiar comum de bibliotecas de drag. */
const TIMELINE_DRAG_THRESHOLD_PX = 6;

/**
 * ★ Achado real (pedido direto do usuário — "quero poder cortar o áudio,
 * arrastar pros lados"): decodifica o áudio de narração no PRÓPRIO
 * navegador (Web Audio API) pra desenhar uma forma de onda real — nunca um
 * desenho decorativo. Recalcula só quando a URL muda (a URL é assinada e
 * estável durante toda a revisão do plano).
 */
function useNarrationWaveform(audioUrl: string): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);

    (async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextCtor();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const bucketCount = Math.max(20, Math.round(audioBuffer.duration * (TIMELINE_PIXELS_PER_SECOND / 4)));
        const bucketSize = Math.max(1, Math.floor(channelData.length / bucketCount));
        const computedPeaks: number[] = [];
        for (let i = 0; i < bucketCount; i++) {
          let max = 0;
          const start = i * bucketSize;
          const end = Math.min(start + bucketSize, channelData.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]!);
            if (abs > max) max = abs;
          }
          computedPeaks.push(max);
        }
        await audioContext.close();
        if (!cancelled) setPeaks(computedPeaks);
      } catch {
        // Sem forma de onda (CORS/decodificação falhou) nunca trava a
        // timeline — ela segue funcional (cortar/arrastar), só sem o desenho.
        if (!cancelled) setPeaks([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  return peaks;
}

interface SceneTimelineScene {
  url: string;
  startSeconds: number;
  lengthSeconds: number;
  assetType?: "video" | "image" | "avatar";
  onScreenLabel?: string;
  segmentIndex?: number;
  audioPlaybackRate?: number;
  audioCutSeconds?: number;
}

interface AudioTrackSegment {
  segmentIndex: number;
  firstSceneIndex: number;
  startSeconds: number;
  durationSeconds: number;
  playbackRate: number;
  cutSeconds?: number;
}

/** Agrupa cenas CONTÍGUAS do mesmo trecho — mesmo critério do motor de render (ffmpeg-video-render-provider.ts) pra virar 1 bloco de áudio só. */
function computeAudioTrackSegments(scenes: SceneTimelineScene[]): AudioTrackSegment[] {
  const result: AudioTrackSegment[] = [];
  let cursor = 0;
  while (cursor < scenes.length) {
    const segmentIndex = scenes[cursor]!.segmentIndex;
    let end = cursor + 1;
    while (end < scenes.length && scenes[end]!.segmentIndex === segmentIndex) end++;
    if (segmentIndex !== undefined) {
      const run = scenes.slice(cursor, end);
      const durationSeconds = run.reduce((sum, scene) => sum + scene.lengthSeconds, 0);
      result.push({
        segmentIndex,
        firstSceneIndex: cursor,
        startSeconds: run[0]!.startSeconds,
        durationSeconds,
        playbackRate: run[0]!.audioPlaybackRate ?? 1,
        cutSeconds: run[0]!.audioCutSeconds,
      });
    }
    cursor = end;
  }
  return result;
}

/**
 * ★ Achado real (pedido direto do usuário — "a timeline com o áudio não
 * apareceu, pra cortar, acelerar, mudar de lugar" / "quero poder cortar o
 * áudio, arrastar pros lados"): timeline de verdade, estilo CapCut — cenas
 * posicionadas/dimensionadas proporcionalmente à duração real (não mais
 * miniaturas de largura fixa), forma de onda real da narração alinhada no
 * mesmo eixo de tempo, borda direita de cada cena arrastável pra cortar a
 * duração ao vivo, corpo da cena arrastável pra reordenar. Nunca chama a
 * Server Action a cada pixel — só ao soltar (`onPointerUp`), mesmo espírito
 * de "confirma com uma ação explícita" já usado no resto da tela.
 */
function SceneTimeline({
  scenes,
  audioUrl,
  selectedIndex,
  selectedAudioSegmentIndex,
  busy,
  onSelect,
  onReorder,
  onResizeDuration,
  onSelectAudioSegment,
  onCutAudio,
}: {
  scenes: SceneTimelineScene[];
  audioUrl: string;
  selectedIndex: number | null;
  selectedAudioSegmentIndex: number | null;
  busy: boolean;
  onSelect: (index: number) => void;
  onReorder: (newOrder: number[]) => void;
  onResizeDuration: (index: number, lengthSeconds: number) => void;
  onSelectAudioSegment: (segmentIndex: number) => void;
  onCutAudio: (segmentIndex: number, cutSeconds: number | undefined) => void;
}) {
  const peaks = useNarrationWaveform(audioUrl);
  const audioTrackSegments = computeAudioTrackSegments(scenes);

  const [resize, setResize] = useState<{ index: number; startClientX: number; startLength: number; previewLength: number } | null>(
    null,
  );
  const [drag, setDrag] = useState<{ index: number; startClientX: number; deltaX: number; moved: boolean; overIndex: number } | null>(
    null,
  );
  const [audioCutDrag, setAudioCutDrag] = useState<{
    segmentIndex: number;
    startClientX: number;
    startCutSeconds: number;
    previewCutSeconds: number;
    naturalDurationSeconds: number;
  } | null>(null);

  const totalDurationSeconds = scenes.reduce((sum, scene) => sum + scene.lengthSeconds, 0);
  const totalWidthPx = Math.max(1, totalDurationSeconds) * TIMELINE_PIXELS_PER_SECOND;

  function widthForScene(scene: SceneTimelineScene): number {
    return Math.max(TIMELINE_MIN_BLOCK_WIDTH_PX, scene.lengthSeconds * TIMELINE_PIXELS_PER_SECOND);
  }

  /** Índice de destino durante um arrasto — compara o X (relativo à timeline) ao ponto médio de cada cena, na ordem ATUAL de `scenes`. */
  function indexAtTimelineX(xWithinTimeline: number): number {
    let cumulative = 0;
    for (let i = 0; i < scenes.length; i++) {
      const width = widthForScene(scenes[i]!);
      if (xWithinTimeline < cumulative + width / 2) return i;
      cumulative += width;
    }
    return scenes.length - 1;
  }

  function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>, index: number) {
    if (busy) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResize({ index, startClientX: event.clientX, startLength: scenes[index]!.lengthSeconds, previewLength: scenes[index]!.lengthSeconds });
  }

  function handleResizePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!resize) return;
    const deltaSeconds = (event.clientX - resize.startClientX) / TIMELINE_PIXELS_PER_SECOND;
    setResize({ ...resize, previewLength: Math.max(0.3, resize.startLength + deltaSeconds) });
  }

  function handleResizePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!resize) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const { index, previewLength, startLength } = resize;
    setResize(null);
    if (Math.abs(previewLength - startLength) > 0.05) onResizeDuration(index, Math.round(previewLength * 10) / 10);
  }

  function handleBlockPointerDown(event: React.PointerEvent<HTMLDivElement>, index: number) {
    if (busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ index, startClientX: event.clientX, deltaX: 0, moved: false, overIndex: index });
  }

  function handleBlockPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const deltaX = event.clientX - drag.startClientX;
    const moved = drag.moved || Math.abs(deltaX) > TIMELINE_DRAG_THRESHOLD_PX;
    const draggedScene = scenes[drag.index]!;
    const draggedCenterX = draggedScene.startSeconds * TIMELINE_PIXELS_PER_SECOND + widthForScene(draggedScene) / 2 + deltaX;
    const overIndex = moved ? indexAtTimelineX(draggedCenterX) : drag.index;
    setDrag({ ...drag, deltaX, moved, overIndex });
  }

  function handleBlockPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const { index, moved, overIndex } = drag;
    setDrag(null);
    if (!moved || overIndex === index) {
      onSelect(index);
      return;
    }
    const order = scenes.map((_, i) => i);
    const [movedIndex] = order.splice(index, 1);
    order.splice(overIndex, 0, movedIndex!);
    onReorder(order);
  }

  /** ★ Achado real (pedido direto do usuário — "a locução ainda não deixa cortar... arrastar pros lados"): arrasta a borda do bloco de áudio do trecho — encurta a fala que toca, nunca estica além do natural. */
  function handleAudioCutPointerDown(event: React.PointerEvent<HTMLDivElement>, segment: AudioTrackSegment) {
    if (busy) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startCutSeconds = segment.cutSeconds ?? segment.durationSeconds;
    setAudioCutDrag({
      segmentIndex: segment.segmentIndex,
      startClientX: event.clientX,
      startCutSeconds,
      previewCutSeconds: startCutSeconds,
      naturalDurationSeconds: segment.durationSeconds,
    });
  }

  function handleAudioCutPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!audioCutDrag) return;
    const deltaSeconds = (event.clientX - audioCutDrag.startClientX) / TIMELINE_PIXELS_PER_SECOND;
    const preview = Math.min(audioCutDrag.naturalDurationSeconds, Math.max(0.3, audioCutDrag.startCutSeconds + deltaSeconds));
    setAudioCutDrag({ ...audioCutDrag, previewCutSeconds: preview });
  }

  function handleAudioCutPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!audioCutDrag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const { segmentIndex, previewCutSeconds, naturalDurationSeconds } = audioCutDrag;
    setAudioCutDrag(null);
    // Voltou pro fim natural (ou além) — remove o corte manual, em vez de gravar um valor que não corta nada.
    const cutSeconds = previewCutSeconds >= naturalDurationSeconds - 0.05 ? undefined : Math.round(previewCutSeconds * 10) / 10;
    onCutAudio(segmentIndex, cutSeconds);
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        Cenas: arraste o corpo pra reordenar, a borda direita pra cortar a duração. Narração: clique num trecho pra
        ajustar velocidade, arraste a borda dele pra cortar a fala.
      </p>
      <div className="overflow-x-auto rounded-md border border-border bg-secondary/20 pb-1">
        <div style={{ width: totalWidthPx }} className="relative">
          {/* Forma de onda real da narração — mesmo eixo de tempo das cenas abaixo. */}
          <div
            className="relative border-b border-border/60 bg-background/40"
            style={{ height: TIMELINE_WAVEFORM_HEIGHT_PX, width: totalWidthPx }}
          >
            {peaks && peaks.length > 0 ? (
              <svg width={totalWidthPx} height={TIMELINE_WAVEFORM_HEIGHT_PX} className="absolute inset-0">
                {peaks.map((peak, i) => {
                  const barWidth = totalWidthPx / peaks.length;
                  const barHeight = Math.max(2, peak * TIMELINE_WAVEFORM_HEIGHT_PX);
                  return (
                    <rect
                      key={i}
                      x={i * barWidth}
                      y={(TIMELINE_WAVEFORM_HEIGHT_PX - barHeight) / 2}
                      width={Math.max(1, barWidth - 1)}
                      height={barHeight}
                      className="fill-primary/50"
                    />
                  );
                })}
              </svg>
            ) : peaks === null ? (
              <p className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                Carregando forma de onda...
              </p>
            ) : null}
          </div>

          {/* ★ Achado real (pedido direto do usuário — "a locução ainda não
              deixa cortar, nem mudar a velocidade selecionando ela"): trilha
              própria do áudio — 1 bloco por trecho de roteiro (não por cena
              individual, já que o áudio é do trecho inteiro). Clicar
              seleciona (mostra velocidade no painel abaixo); arrastar a
              borda corta a fala desse trecho — a parte "muda" do bloco (sem
              fala) fica visivelmente mais escura. */}
          <div className="relative border-b border-border/60" style={{ height: 28, width: totalWidthPx }}>
            {audioTrackSegments.map((segment) => {
              const isDraggingThis = audioCutDrag?.segmentIndex === segment.segmentIndex;
              const cutSeconds = isDraggingThis ? audioCutDrag.previewCutSeconds : (segment.cutSeconds ?? segment.durationSeconds);
              const fullWidth = segment.durationSeconds * TIMELINE_PIXELS_PER_SECOND;
              const activeWidth = Math.min(cutSeconds, segment.durationSeconds) * TIMELINE_PIXELS_PER_SECOND;
              const left = segment.startSeconds * TIMELINE_PIXELS_PER_SECOND;
              const isSelected = selectedAudioSegmentIndex === segment.segmentIndex;

              return (
                <div
                  key={segment.segmentIndex}
                  className={`absolute top-0.5 h-6 overflow-hidden rounded ${isSelected ? "ring-2 ring-primary" : ""}`}
                  style={{ left, width: fullWidth }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectAudioSegment(segment.segmentIndex)}
                    className="absolute inset-0 flex items-center justify-center bg-amber-500/40 text-[9px] font-medium text-amber-950 hover:bg-amber-500/55"
                    style={{ width: activeWidth }}
                  >
                    {segment.playbackRate !== 1 ? `${segment.playbackRate}x` : ""}
                  </button>
                  {activeWidth < fullWidth ? (
                    <div
                      className="absolute top-0 h-full bg-foreground/10"
                      style={{ left: activeWidth, width: fullWidth - activeWidth }}
                    />
                  ) : null}
                  {/* ★ Achado real (validado com arrasto de verdade na
                      revisão desta funcionalidade): uma alça de poucos
                      pixels é difícil de acertar até com mouse, pior ainda
                      no toque — a faixa CLICÁVEL é bem mais larga (12px) que
                      a barra visível (2px, centralizada), pra facilitar
                      pegar o ponto certo sem exigir precisão de pixel. */}
                  <div
                    onPointerDown={(event) => handleAudioCutPointerDown(event, segment)}
                    onPointerMove={handleAudioCutPointerMove}
                    onPointerUp={handleAudioCutPointerUp}
                    className="group absolute top-0 flex h-full w-3 cursor-col-resize items-stretch justify-center"
                    style={{ left: Math.max(0, activeWidth - 6) }}
                  >
                    <div className="h-full w-0.5 bg-amber-700/80 group-hover:w-1 group-hover:bg-amber-500" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cenas — largura proporcional à duração real. */}
          <div className="relative" style={{ height: TIMELINE_TRACK_HEIGHT_PX, width: totalWidthPx }}>
            {scenes.map((scene, index) => {
              const isDraggingThis = drag?.index === index && drag.moved;
              const isResizingThis = resize?.index === index;
              const width = isResizingThis ? resize.previewLength * TIMELINE_PIXELS_PER_SECOND : widthForScene(scene);
              const left = scene.startSeconds * TIMELINE_PIXELS_PER_SECOND + (isDraggingThis ? drag.deltaX : 0);
              const showInsertionBefore = drag && drag.moved && drag.overIndex === index && drag.overIndex < drag.index;
              const showInsertionAfter = drag && drag.moved && drag.overIndex === index && drag.overIndex > drag.index;

              return (
                <div
                  key={index}
                  className={`absolute top-0 h-full ${isDraggingThis ? "z-10 opacity-80 shadow-lg" : "z-0"}`}
                  style={{ left, width }}
                >
                  {showInsertionBefore ? <div className="absolute -left-1 top-0 h-full w-0.5 bg-primary" /> : null}
                  <div
                    onPointerDown={(event) => handleBlockPointerDown(event, index)}
                    onPointerMove={handleBlockPointerMove}
                    onPointerUp={handleBlockPointerUp}
                    className={`relative h-full w-full cursor-grab overflow-hidden rounded-md active:cursor-grabbing ${
                      selectedIndex === index ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                  >
                    {scene.assetType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={scene.url} alt={`Cena ${index + 1}`} className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={scene.url} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                    )}
                    {scene.assetType === "avatar" ? (
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Avatar
                      </span>
                    ) : null}
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {(isResizingThis ? resize.previewLength : scene.lengthSeconds).toFixed(1)}s
                    </span>
                    {scene.onScreenLabel ? (
                      <span className="absolute top-1 left-1 right-1 truncate rounded bg-black/70 px-1.5 py-0.5 text-center text-[9px] font-medium text-white">
                        {scene.onScreenLabel}
                      </span>
                    ) : null}
                  </div>
                  {/* ★ Borda direita arrastável — corta/estica a duração desta cena ao vivo (setSceneDurationAction só no pointerup). */}
                  <div
                    onPointerDown={(event) => handleResizePointerDown(event, index)}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-foreground/20 hover:bg-primary/60"
                  />
                  {showInsertionAfter ? <div className="absolute -right-1 top-0 h-full w-0.5 bg-primary" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoScenePlanReview({
  pieceId,
  plan,
  onUpdated,
  avatarReady,
  avatarName,
}: {
  pieceId: string;
  plan: NonNullable<ContentPieceView["pendingScenePlan"]>;
  onUpdated: (piece: ContentPieceView) => void;
  /** ★ Achado real (pedido direto do usuário — "incluir uma opção de alternar com avatar" entre as cenas do Pexels): "Usar avatar" só aparece por cena quando o avatar da marca já está pronto. */
  avatarReady: boolean;
  avatarName: string | null;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  /** ★ Achado real (pedido direto do usuário — "a locução ainda não deixa cortar, nem mudar a velocidade selecionando ela"): seleção PRÓPRIA pra trecho de áudio na timeline — independente de qual cena está selecionada, já que 1 trecho pode ter várias cenas. */
  const [selectedAudioSegmentIndex, setSelectedAudioSegmentIndex] = useState<number | null>(null);
  const [queryDraft, setQueryDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  // ★ Achado real (pedido direto do usuário — "busca de novas cenas só dá
  // uma opção, caso eu não goste queria que quando gerasse pra substituir
  // viessem outras"): busca agora é 2 passos — `searchCandidates` guarda as
  // opções encontradas pra escolher, nada é aplicado sozinho.
  const [searchCandidates, setSearchCandidates] = useState<SceneCandidateView[] | null>(null);
  const [searchQueryUsed, setSearchQueryUsed] = useState("");
  // ★ Achado real (pedido direto do usuário — "a geração da cena por IA tá
  // muito genérica, precisa ter um espaço de prompt sugerido e pra gente
  // editar"): mesmo espírito da busca acima — nunca gera nada sozinho, só
  // sugere um prompt (`suggestSceneAiPromptAction`) pra revisar/editar
  // antes de confirmar.
  const [aiPromptOpenFor, setAiPromptOpenFor] = useState<number | null>(null);
  const [aiPromptDraft, setAiPromptDraft] = useState("");
  const [aiPromptLoading, setAiPromptLoading] = useState(false);

  // ★ Achado real (pedido direto do usuário — "permitir escolher a duração
  // de cada cena individualmente"): rascunho local (string, pra aceitar
  // digitação livre tipo "3." antes de virar número) só da cena selecionada
  // — confirma com um botão explícito, nunca salva a cada tecla.
  const [durationDraft, setDurationDraft] = useState("");

  // ★ Achado real (pedido direto do usuário — "não vi opção de colocar
  // balões de texto... quero basicamente no modelo do capcut"): posição por
  // preset (não um canvas de arrastar livre — mais simples de usar e de
  // implementar) mapeado pra xFraction/yFraction no server action.
  const [balloonTextDraft, setBalloonTextDraft] = useState("");
  const [balloonPositionDraft, setBalloonPositionDraft] = useState<keyof typeof BALLOON_POSITION_PRESETS>("topLeft");

  // ★ Achado real (pedido direto do usuário — "timeline com o áudio... pra
  // cortar, acelerar, mudar de lugar"): velocidade é por TRECHO (roteiro),
  // não por corte — todas as cenas do mesmo trecho mostram/aplicam o mesmo
  // valor (ver setSceneAudioPlaybackRate).

  // ★ Achado real (pedido direto do usuário — "incluir a oportunidade de
  // incluir um vídeo e recortar a cena que quero"): antes, um vídeo enviado
  // sempre virava a cena a partir do segundo 0 do arquivo — sem jeito de
  // escolher o trecho. Vídeo (nunca imagem) abre esse picker antes de
  // enviar: o usuário assiste o arquivo local (object URL, nada sobe ainda),
  // escolhe o ponto de início arrastando o próprio player, e só then o
  // upload + `trimSeconds` seguem pro server action.
  const [trimPicker, setTrimPicker] = useState<{
    index: number;
    file: File;
    objectUrl: string;
    trimStart: number;
    sceneLengthSeconds: number;
  } | null>(null);
  const trimPickerVideoRef = useRef<HTMLVideoElement | null>(null);

  // ★ Achado real (pedido direto do usuário — "quero poder editar uma cena,
  // cortar e tal, não só quando for incluir, mas depois de inclusa"): o
  // picker acima só existe pra um arquivo local recém-escolhido (antes de
  // subir) — este é o mesmo player, mas assistindo a URL que JÁ está na
  // cena (banco de vídeo, IA, avatar ou upload anterior), sem trocar o
  // arquivo, só reajustando `trimSeconds`.
  const [recutIndex, setRecutIndex] = useState<number | null>(null);
  const [recutTrimStart, setRecutTrimStart] = useState(0);
  const recutVideoRef = useRef<HTMLVideoElement | null>(null);

  // ★ Achado real (pedido direto do usuário — "tem como a gente assistir as
  // cenas com a narração antes de editar e de baixar, porque só nas
  // figurinhas pequenas não dá pra ter muita noção"): prévia client-side —
  // toca a narração (áudio real) e troca qual cena aparece grande conforme
  // o tempo avança (`startSeconds`/`lengthSeconds` de cada cena), sem
  // precisar renderizar nada no Shotstack só pra "dar uma olhada".
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewSceneIndex, setPreviewSceneIndex] = useState(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  function handlePreviewTimeUpdate() {
    const currentTime = previewAudioRef.current?.currentTime ?? 0;
    const index = plan.scenes.findIndex(
      (scene) => currentTime >= scene.startSeconds && currentTime < scene.startSeconds + scene.lengthSeconds,
    );
    if (index !== -1) setPreviewSceneIndex(index);
  }

  function handlePlayPreview() {
    setPreviewSceneIndex(0);
    setPreviewPlaying(true);
    if (previewAudioRef.current) {
      previewAudioRef.current.currentTime = 0;
      void previewAudioRef.current.play();
    }
  }

  function handleStopPreview() {
    setPreviewPlaying(false);
    previewAudioRef.current?.pause();
  }

  function handleResult(result: ContentPieceActionResult) {
    setBusy(false);
    if (!result.ok) {
      setSceneError(result.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }
    setSceneError(null);
    if (result.contentPiece) onUpdated(result.contentPiece);
  }

  function selectScene(index: number) {
    setSelectedIndex((current) => (current === index ? null : index));
    setSelectedAudioSegmentIndex(null);
    setSceneError(null);
    setQueryDraft("");
    setSearchCandidates(null);
    setAiPromptOpenFor(null);
    setDurationDraft(plan.scenes[index]?.lengthSeconds.toFixed(1) ?? "");
    setBalloonTextDraft("");
    handleCancelTrim();
    handleCancelRecut();
  }

  async function handleSetDuration(index: number) {
    const lengthSeconds = Number(durationDraft.replace(",", "."));
    if (!Number.isFinite(lengthSeconds) || lengthSeconds < 0.5 || busy) return;
    setBusy(true);
    handleResult(await setSceneDurationAction(pieceId, index, lengthSeconds));
  }

  /** Qualquer cena do trecho serve — `setSceneAudioPlaybackRateAction`/`setSceneAudioCutSecondsAction` aplicam no trecho inteiro (ver os cores functions). */
  function firstSceneIndexForSegment(segmentIndex: number): number {
    return plan.scenes.findIndex((scene) => scene.segmentIndex === segmentIndex);
  }

  function handleSelectAudioSegment(segmentIndex: number) {
    setSelectedAudioSegmentIndex((current) => (current === segmentIndex ? null : segmentIndex));
    setSelectedIndex(null);
  }

  async function handleSetSegmentSpeed(segmentIndex: number, rate: number) {
    const sceneIndex = firstSceneIndexForSegment(segmentIndex);
    if (sceneIndex === -1 || busy) return;
    setBusy(true);
    handleResult(await setSceneAudioPlaybackRateAction(pieceId, sceneIndex, rate));
  }

  /** ★ Achado real (pedido direto do usuário — "a locução ainda não deixa cortar... arrastar pros lados"). */
  async function handleCutAudio(segmentIndex: number, cutSeconds: number | undefined) {
    const sceneIndex = firstSceneIndexForSegment(segmentIndex);
    if (sceneIndex === -1 || busy) return;
    setBusy(true);
    handleResult(await setSceneAudioCutSecondsAction(pieceId, sceneIndex, cutSeconds));
  }

  /** ★ Achado real (pedido direto do usuário — "não vi opção de colocar balões de texto... quero basicamente no modelo do capcut"). */
  async function handleAddBalloon(index: number) {
    if (busy || !balloonTextDraft.trim()) return;
    const preset = BALLOON_POSITION_PRESETS[balloonPositionDraft];
    setBusy(true);
    setBalloonTextDraft("");
    handleResult(await addSceneTextBalloonAction(pieceId, index, balloonTextDraft.trim(), preset.xFraction, preset.yFraction));
  }

  async function handleRemoveBalloon(index: number, balloonIndex: number) {
    if (busy) return;
    setBusy(true);
    handleResult(await removeSceneTextBalloonAction(pieceId, index, balloonIndex));
  }

  /** ★ Achado real (pedido direto do usuário — "quero poder cortar o áudio, arrastar pros lados"): a timeline (SceneTimeline abaixo) já calcula a nova ordem a partir da posição onde a cena foi solta — esta função só valida/envia, igual ao antigo handleDrop. */
  async function handleReorder(newOrder: number[]) {
    if (busy) return;
    setBusy(true);
    handleResult(await reorderVideoScenesAction(pieceId, newOrder));
    setSelectedIndex(null);
  }

  /** ★ Mesmo achado — arrastar a borda direita de uma cena na timeline ajusta a duração dela ao vivo, sem precisar digitar num campo. */
  async function handleResizeDuration(index: number, lengthSeconds: number) {
    if (busy) return;
    setBusy(true);
    handleResult(await setSceneDurationAction(pieceId, index, lengthSeconds));
  }

  async function handleSearch(index: number) {
    if (!queryDraft.trim() || busy) return;
    setBusy(true);
    setSceneError(null);
    const query = queryDraft.trim();
    const result = await searchSceneCandidatesAction(pieceId, index, query);
    setBusy(false);
    if (!result.ok) {
      setSceneError(result.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }
    setSearchQueryUsed(query);
    setSearchCandidates(result.candidates ?? []);
  }

  async function handlePickCandidate(index: number, candidate: SceneCandidateView) {
    if (busy) return;
    setBusy(true);
    handleResult(await applySceneCandidateAction(pieceId, index, candidate.downloadUrl, candidate.durationSeconds, searchQueryUsed));
    setSearchCandidates(null);
  }

  // ★ Achado real (pedido direto do usuário — "a geração da cena por IA tá
  // muito genérica, precisa ter um espaço de prompt sugerido e pra gente
  // editar"): antes gerava direto (`generateReplacementSceneAction` sem
  // prompt nenhum visível) — agora busca uma sugestão primeiro
  // (`suggestSceneAiPromptAction`, nunca gera nada sozinho) e deixa editar
  // antes de confirmar.
  async function handleOpenAiPrompt(index: number) {
    setAiPromptOpenFor(index);
    setAiPromptDraft("");
    setAiPromptLoading(true);
    const result = await suggestSceneAiPromptAction(pieceId, index);
    setAiPromptLoading(false);
    if (result.ok) setAiPromptDraft(result.prompt ?? "");
    else setSceneError(result.error ?? "Não consegui sugerir um prompt agora.");
  }

  async function handleConfirmAiGenerate(index: number) {
    if (busy) return;
    setBusy(true);
    setAiPromptOpenFor(null);
    handleResult(await generateReplacementSceneAction(pieceId, index, aiPromptDraft));
  }

  async function handleUseAvatar(index: number) {
    if (busy) return;
    setBusy(true);
    handleResult(await replaceSceneWithAvatarAction(pieceId, index));
  }

  async function handleUpload(index: number, file: File, trimSeconds?: number) {
    setBusy(true);
    const formData = new FormData();
    formData.set("file", file);
    if (trimSeconds !== undefined) formData.set("trimSeconds", String(trimSeconds));
    handleResult(await uploadReplacementSceneAction(pieceId, index, formData));
  }

  /** Vídeo abre o picker de recorte antes de enviar; imagem sobe direto (não há o que recortar). */
  function handleFileSelected(index: number, file: File) {
    if (!file.type.startsWith("video/")) {
      void handleUpload(index, file);
      return;
    }
    const sceneLengthSeconds = plan.scenes[index]?.lengthSeconds ?? 3;
    setTrimPicker({ index, file, objectUrl: URL.createObjectURL(file), trimStart: 0, sceneLengthSeconds });
  }

  function handleCancelTrim() {
    if (trimPicker) URL.revokeObjectURL(trimPicker.objectUrl);
    setTrimPicker(null);
  }

  function handleUseCurrentTimeAsTrimStart() {
    if (!trimPicker || !trimPickerVideoRef.current) return;
    setTrimPicker({ ...trimPicker, trimStart: trimPickerVideoRef.current.currentTime });
  }

  function handleConfirmTrim() {
    if (!trimPicker) return;
    const { index, file, trimStart, objectUrl } = trimPicker;
    URL.revokeObjectURL(objectUrl);
    setTrimPicker(null);
    void handleUpload(index, file, trimStart);
  }

  function handleOpenRecut(index: number) {
    setRecutIndex(index);
    setRecutTrimStart(plan.scenes[index]?.trimSeconds ?? 0);
  }

  function handleCancelRecut() {
    setRecutIndex(null);
  }

  function handleUseCurrentTimeAsRecutStart() {
    if (!recutVideoRef.current) return;
    setRecutTrimStart(recutVideoRef.current.currentTime);
  }

  async function handleConfirmRecut(index: number) {
    if (busy) return;
    setBusy(true);
    setRecutIndex(null);
    handleResult(await setSceneTrimAction(pieceId, index, recutTrimStart));
  }

  async function handleDelete(index: number) {
    if (busy) return;
    setBusy(true);
    handleResult(await deleteReplacementSceneAction(pieceId, index));
    setSelectedIndex(null);
  }

  /** ★ Achado real (pedido direto do usuário — "adicionar novas cenas"): a cópia entra logo depois da original — troca o visual dela pelos mesmos botões (buscar/IA/avatar/upload) de qualquer outra cena. */
  async function handleDuplicate(index: number) {
    if (busy) return;
    setBusy(true);
    handleResult(await duplicateVideoSceneAction(pieceId, index));
    setSelectedIndex(index + 1);
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        Roteiro e cenas escolhidas — confira se combinam antes de gerar o vídeo final. Clique numa cena para trocar ou
        remover ela.
      </p>

      {/* ★ Achado real (pedido direto do usuário — "tem como a gente assistir
          as cenas com a narração antes de editar e de baixar, porque só nas
          figurinhas pequenas não dá pra ter muita noção"): prévia grande,
          troca de cena sincronizada pelo tempo real do áudio de narração
          (`onTimeUpdate`) — nunca renderiza nada no Shotstack só pra isso. */}
      <div className="space-y-2">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-md bg-black">
          {plan.scenes[previewSceneIndex] ? (
            plan.scenes[previewSceneIndex]!.assetType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={plan.scenes[previewSceneIndex]!.url}
                alt={`Cena ${previewSceneIndex + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                key={plan.scenes[previewSceneIndex]!.url}
                src={plan.scenes[previewSceneIndex]!.url}
                muted
                loop
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            )
          ) : null}
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Cena {previewSceneIndex + 1}/{plan.scenes.length}
          </span>
        </div>

        <Button size="sm" variant="outline" onClick={previewPlaying ? handleStopPreview : handlePlayPreview}>
          {previewPlaying ? "Parar prévia" : "▶ Assistir prévia com narração"}
        </Button>

        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={previewAudioRef}
          src={plan.audioUrl}
          controls
          className="w-full"
          onTimeUpdate={handlePreviewTimeUpdate}
          onPlay={() => setPreviewPlaying(true)}
          onPause={() => setPreviewPlaying(false)}
          onEnded={handleStopPreview}
        />
      </div>

      <div className="space-y-2">
        {plan.segments.map((segment, index) => {
          // ★ Achado real (pedido direto do usuário — "deixar associado cada
          // frase com o momento do vídeo, pra ficar mais fácil de editar e
          // trocar"): um trecho pode virar várias cenas (cortes rápidos,
          // `MAX_CLIP_SECONDS`) — mostra a faixa de tempo coberta e clicar no
          // texto seleciona a 1ª cena correspondente na tira abaixo, mesmo
          // destaque/painel de quem clica direto na miniatura.
          const matchingScenes = plan.scenes
            .map((scene, sceneIndex) => ({ scene, sceneIndex }))
            .filter(({ scene }) => scene.segmentIndex === index);
          const firstSceneIndex = matchingScenes[0]?.sceneIndex;
          const rangeStart = matchingScenes[0]?.scene.startSeconds;
          const lastMatch = matchingScenes[matchingScenes.length - 1];
          const rangeEnd = lastMatch ? lastMatch.scene.startSeconds + lastMatch.scene.lengthSeconds : undefined;
          const isSelected = firstSceneIndex !== undefined && matchingScenes.some((m) => m.sceneIndex === selectedIndex);

          return (
            <button
              key={index}
              type="button"
              disabled={firstSceneIndex === undefined}
              onClick={() => firstSceneIndex !== undefined && selectScene(firstSceneIndex)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm text-foreground ${
                isSelected ? "bg-secondary ring-2 ring-primary ring-offset-2" : "bg-secondary/40 hover:bg-secondary/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p>{segment.text}</p>
                {/* ★ Achado real (pedido direto do usuário — roteiro cena-a-cena
                    com cada cena marcada REAL/IA/TODOCANTO, exemplo trazido
                    pronto): rótulo curto por trecho, decidido junto do
                    planejamento (`segmentScript`) — nunca inferido depois. */}
                {segment.sceneType === "ai" ? (
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    IA
                  </span>
                ) : segment.sceneType === "brand" ? (
                  <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">
                    Marca própria
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {rangeStart !== undefined && rangeEnd !== undefined ? (
                  <span>
                    {formatTimestamp(rangeStart)}–{formatTimestamp(rangeEnd)}
                    {matchingScenes.length > 1 ? ` (${matchingScenes.length} cenas)` : ""}
                  </span>
                ) : null}
                {segment.realSourceHint ? <span>Onde procurar: {segment.realSourceHint}</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      <SceneTimeline
        scenes={plan.scenes}
        audioUrl={plan.audioUrl}
        selectedIndex={selectedIndex}
        selectedAudioSegmentIndex={selectedAudioSegmentIndex}
        busy={busy}
        onSelect={selectScene}
        onReorder={handleReorder}
        onResizeDuration={handleResizeDuration}
        onSelectAudioSegment={handleSelectAudioSegment}
        onCutAudio={handleCutAudio}
      />

      {/* ★ Achado real (pedido direto do usuário — "a locução ainda não
          deixa cortar, nem mudar a velocidade selecionando ela"): painel
          PRÓPRIO pra narração, separado do painel de cena — clicar num
          trecho de áudio na timeline mostra isso, nunca precisa selecionar
          uma cena primeiro. */}
      {selectedAudioSegmentIndex !== null ? (
        <div className="space-y-2 rounded-md border border-amber-600/40 bg-amber-500/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Narração — trecho {selectedAudioSegmentIndex + 1}
          </p>
          {sceneError ? <p className="text-xs text-destructive">{sceneError}</p> : null}
          <p className="text-sm text-foreground">{plan.segments[selectedAudioSegmentIndex]?.text}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="segment-speed" className="text-xs text-muted-foreground">
              Velocidade:
            </label>
            <select
              id="segment-speed"
              value={
                plan.scenes.find((scene) => scene.segmentIndex === selectedAudioSegmentIndex)?.audioPlaybackRate ?? 1
              }
              disabled={busy}
              onChange={(event) => handleSetSegmentSpeed(selectedAudioSegmentIndex, Number(event.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {SPEED_OPTIONS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x{rate === 1 ? " (normal)" : ""}
                </option>
              ))}
            </select>
            {plan.scenes.find((scene) => scene.segmentIndex === selectedAudioSegmentIndex)?.audioCutSeconds ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleCutAudio(selectedAudioSegmentIndex, undefined)}>
                Remover corte da fala
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Arraste a borda amarela do trecho na timeline acima pra cortar a fala mais cedo — o resto da(s) cena(s)
            continua na tela, só sem narração.
          </p>
          {/* ★ Achado real (pedido direto do usuário — "a narração não mudou
              nada"): velocidade/corte só têm efeito no vídeo final quando o
              motor de render é o ffmpeg (VIDEO_RENDER_PROVIDER=ffmpeg no
              Railway) — o Shotstack (padrão) não tem esses campos e ignora
              silenciosamente, sem erro nenhum. Aviso direto aqui pra nunca
              parecer que o ajuste "não funcionou" sem explicação. */}
          <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700">
            Velocidade e corte de narração só aparecem no vídeo final quando o motor de render é o ffmpeg
            (<code className="font-mono">VIDEO_RENDER_PROVIDER=ffmpeg</code>) — com o Shotstack (padrão), esse ajuste fica
            salvo mas não muda o vídeo gerado.
          </p>
        </div>
      ) : null}

      {selectedIndex !== null ? (
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cena {selectedIndex + 1}</p>
          {sceneError ? <p className="text-xs text-destructive">{sceneError}</p> : null}
          <GenerationPromptDisclosure prompt={plan.scenes[selectedIndex]?.generationPrompt} />

          {/* ★ Achado real (pedido direto do usuário — "coloque uma
              observação do tipo: cena tal não consigo baixar por isso e
              isso, mas você pode pegar em tal lugar e inserir manualmente"):
              explica o PORQUÊ (direitos de uso de material de terceiros,
              nunca baixado/usado sozinho) junto da sugestão de onde
              procurar, bem ao lado do botão "Enviar arquivo" — a ação que
              resolve isso. */}
          {(() => {
            const segmentIndex = plan.scenes[selectedIndex]?.segmentIndex;
            const hint = segmentIndex !== undefined ? plan.segments[segmentIndex]?.realSourceHint : undefined;
            if (!hint) return null;
            return (
              <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                Essa cena eu não consigo baixar automaticamente — é material oficial de terceiros, precisa de
                autorização de uso que eu não tenho como confirmar sozinho. Mas você pode conseguir em: {hint}. Baixa o
                arquivo e usa o &quot;Enviar arquivo&quot; abaixo pra colocar manualmente.
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Buscar outro clipe (ex: casal andando na praia ao pôr do sol)"
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" disabled={busy || !queryDraft.trim()} onClick={() => handleSearch(selectedIndex)}>
              Buscar
            </Button>
          </div>

          {searchCandidates ? (
            <div className="space-y-2 rounded-md bg-secondary/40 p-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {searchCandidates.length > 0
                    ? `Escolha uma opção para "${searchQueryUsed}":`
                    : `Nenhum resultado para "${searchQueryUsed}".`}
                </p>
                <Button size="sm" variant="ghost" onClick={() => setSearchCandidates(null)}>
                  Cancelar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handlePickCandidate(selectedIndex, candidate)}
                    className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-transparent hover:border-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={candidate.previewUrl} alt="Opção de cena" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* ★ Achado real (pedido direto do usuário — "a geração da cena por
              IA tá muito genérica, precisa ter um espaço de prompt sugerido
              e pra gente editar"): nunca gera direto — sugere um prompt
              primeiro (ou usa o mesmo já escrito no planejamento cena-a-
              cena, `segment.aiPrompt`) e deixa editar livremente antes de
              confirmar. */}
          {aiPromptOpenFor === selectedIndex ? (
            <div className="space-y-2 rounded-md bg-secondary/40 p-2">
              <label htmlFor={`ai-prompt-${selectedIndex}`} className="text-xs text-muted-foreground">
                {aiPromptLoading ? "Sugerindo um prompt..." : "Prompt sugerido — edite à vontade antes de gerar:"}
              </label>
              <Textarea
                id={`ai-prompt-${selectedIndex}`}
                value={aiPromptDraft}
                onChange={(event) => setAiPromptDraft(event.target.value)}
                disabled={aiPromptLoading}
                className="min-h-[100px] text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || aiPromptLoading || !aiPromptDraft.trim()}
                  onClick={() => handleConfirmAiGenerate(selectedIndex)}
                >
                  Gerar com esse prompt
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAiPromptOpenFor(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {/* ★ Achado real (pedido direto do usuário — "deixa o layout mais
              intuitivo"): título curto separando "trocar a cena" (busca/IA/
              avatar/upload/duplicar/remover) do resto do painel — antes era
              tudo 1 bloco só, sem indicar onde cada grupo de botão começa. */}
          <p className="pt-1 text-xs font-medium text-muted-foreground">Trocar esta cena por:</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || aiPromptOpenFor === selectedIndex}
              onClick={() => handleOpenAiPrompt(selectedIndex)}
            >
              Gerar por IA
            </Button>

            {avatarReady ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => handleUseAvatar(selectedIndex)}>
                Usar avatar ({avatarName})
              </Button>
            ) : null}

            <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary">
              Enviar arquivo
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFileSelected(selectedIndex, file);
                  event.target.value = "";
                }}
              />
            </label>

            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleDuplicate(selectedIndex)}>
              Duplicar / adicionar cena
            </Button>

            {/* ★ Achado real (pedido direto do usuário — "quero poder editar
                uma cena, cortar e tal, não só quando for incluir, mas depois
                de inclusa"): banco de vídeo, IA e avatar não passam pelo
                picker de recorte do upload (só um arquivo local recém-
                escolhido tem isso) — este botão reabre o mesmo tipo de
                player, mas assistindo o que já está na cena. */}
            {plan.scenes[selectedIndex]?.assetType !== "image" ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => handleOpenRecut(selectedIndex)}>
                Cortar cena
              </Button>
            ) : null}

            <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleDelete(selectedIndex)}>
              Remover cena
            </Button>
          </div>

          {recutIndex === selectedIndex ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Assista e escolha de onde o recorte dessa cena começa — ela continua durando{" "}
                {plan.scenes[selectedIndex]?.lengthSeconds.toFixed(1)}s a partir desse ponto.
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={recutVideoRef}
                src={plan.scenes[selectedIndex]?.url}
                controls
                className="w-full rounded-md bg-black"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleUseCurrentTimeAsRecutStart}>
                  Usar o ponto atual como início
                </Button>
                <span className="text-xs text-muted-foreground">Início escolhido: {recutTrimStart.toFixed(1)}s</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => handleConfirmRecut(selectedIndex)}>
                  Usar esse recorte
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={handleCancelRecut}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          <p className="pt-1 text-xs font-medium text-muted-foreground">Ajustes desta cena:</p>
          <div className="flex items-center gap-2">
            <label htmlFor="scene-duration" className="text-xs text-muted-foreground">
              Duração desta cena (segundos):
            </label>
            <input
              id="scene-duration"
              type="text"
              inputMode="decimal"
              value={durationDraft}
              onChange={(event) => setDurationDraft(event.target.value)}
              disabled={busy}
              className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleSetDuration(selectedIndex)}>
              Aplicar
            </Button>
          </div>

          {/* ★ Achado real (pedido direto do usuário — "a locução ainda não
              deixa cortar, nem mudar a velocidade selecionando ela"):
              velocidade/corte da narração saíram de dentro do painel de
              cena — agora só aparecem clicando o trecho de ÁUDIO na
              timeline (painel próprio, acima), nunca misturados com os
              controles da cena (mais intuitivo: cada trilha tem seu
              painel). */}

          {/* ★ Achado real (pedido direto do usuário — "não vi opção de
              colocar balões de texto... quero basicamente no modelo do
              capcut"): balão de fala sobreposto só durante esta cena —
              posição por preset (canto/centro), texto curto. */}
          <div className="space-y-2 rounded-md border border-border/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Balões de texto <span className="normal-case text-muted-foreground/70">(só com o motor ffmpeg ativo)</span>
            </p>
            {(plan.scenes[selectedIndex]?.textBalloons ?? []).map((balloon, balloonIndex) => (
              <div key={balloonIndex} className="flex items-center justify-between gap-2 rounded-md bg-secondary/50 px-2 py-1 text-sm">
                <span className="truncate">{balloon.text}</span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleRemoveBalloon(selectedIndex, balloonIndex)}>
                  Remover
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={balloonTextDraft}
                onChange={(event) => setBalloonTextDraft(event.target.value)}
                placeholder="Texto do balão (curto)"
                className="max-w-[220px]"
              />
              <select
                value={balloonPositionDraft}
                disabled={busy}
                onChange={(event) => setBalloonPositionDraft(event.target.value as keyof typeof BALLOON_POSITION_PRESETS)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {Object.entries(BALLOON_POSITION_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" disabled={busy || !balloonTextDraft.trim()} onClick={() => handleAddBalloon(selectedIndex)}>
                Adicionar balão
              </Button>
            </div>
          </div>

          {trimPicker && trimPicker.index === selectedIndex ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Assista e escolha de onde o recorte começa — a cena vai durar{" "}
                {trimPicker.sceneLengthSeconds.toFixed(1)}s a partir desse ponto.
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={trimPickerVideoRef} src={trimPicker.objectUrl} controls className="w-full rounded-md bg-black" />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleUseCurrentTimeAsTrimStart}>
                  Usar o ponto atual como início
                </Button>
                <span className="text-xs text-muted-foreground">
                  Início escolhido: {trimPicker.trimStart.toFixed(1)}s
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={handleConfirmTrim}>
                  Usar esse recorte
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={handleCancelTrim}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {busy ? <p className="text-xs text-muted-foreground">Processando...</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * ★ Achado real (pedido direto do usuário — "mostrar o prompt exato usado
 * em cada peça gerada"): `<details>` nativo (sem estado novo) — fechado por
 * padrão pra não poluir a revisão normal, mas 1 clique mostra o texto
 * exato mandado ao provider (Gemini) ou o termo de busca usado (Pexels).
 * Ausente por completo quando não há nenhum prompt (upload manual, texto).
 */
function GenerationPromptDisclosure({ prompt, slidePrompts }: { prompt?: string; slidePrompts?: string[] }) {
  const hasSlidePrompts = slidePrompts?.some((p) => p.trim());
  if (!prompt && !hasSlidePrompts) return null;

  return (
    <details className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium uppercase tracking-wide">Ver prompt usado</summary>
      {hasSlidePrompts ? (
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          {slidePrompts!.map((p, index) => (
            <li key={index} className="whitespace-pre-wrap">
              {p || "(sem prompt registrado)"}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 whitespace-pre-wrap">{prompt}</p>
      )}
    </details>
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
