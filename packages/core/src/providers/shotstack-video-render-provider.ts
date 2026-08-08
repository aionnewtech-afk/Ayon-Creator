import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type {
  ImageCompositionRequest,
  ImageCompositionResult,
  VideoBranding,
  VideoRenderProvider,
  VideoRenderRequest,
  VideoRenderResult,
} from "./video-render-provider";
import { logProviderCall } from "./log-provider-call";
import { fetchWithRetry } from "../shared/fetch-with-retry";

/**
 * Adapter concreto do Video Render Provider (architecture.md §5, §3.5.1,
 * §14) para o Shotstack — Missão 9, Etapa 1 (vídeo) + Missão 11 (branding,
 * sem legenda, composição de imagem — arch. §14.4.1). Único arquivo do
 * monorepo que importa a API do Shotstack; trocar de fornecedor nunca exige
 * mudar quem chama `VideoRenderProvider`, só o resultado da resolução em
 * provider-gateway.ts.
 *
 * `host` é a base URL completa, incluindo o estágio (`SHOTSTACK_HOST`, ex.:
 * `https://api.shotstack.io/edit/stage` para sandbox, `.../edit/v1` para
 * produção) — nunca hardcoded aqui, para trocar de ambiente sem mudar código.
 */
export class ShotstackVideoRenderProvider implements VideoRenderProvider {
  private readonly host: string;

  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
    host: string,
    /** ★ Missão 12 (architecture.md §15.7) — mesmo client de service role já usado para resolver este adapter; instrumentação real via `logProviderCall`, nunca bloqueia a chamada real se falhar. */
    private readonly serviceRoleDb?: SupabaseClient<Database>,
  ) {
    // Defensivo: aceita tanto a base documentada (`.../edit/stage`) quanto
    // uma variante com `/render` já incluído — nunca falha silenciosamente
    // duplicando o segmento na URL final.
    this.host = host.replace(/\/+$/, "").replace(/\/render$/, "");
  }

  async composeVideo(request: VideoRenderRequest): Promise<VideoRenderResult> {
    const timeline = buildVideoTimeline(request);

    const videoUrl = await this.submitAndPoll({
      timeline,
      // resolution "sd" + quality "medium" (★ achado real da validação da
      // Missão 11, task 15): um vídeo de 60s com cenas de água/cachoeira
      // ultrapassou o limite de tamanho de objeto do Storage do Supabase
      // (abaixo dos 50MB padrão do plano gratuito — o valor exato não é
      // exposto pela API). "hd" + quality "medium" sozinho não é confiável:
      // como cada tentativa reseleciona cenas (segmentScript busca de novo),
      // o mesmo par de parâmetros produziu ~41MB numa tentativa (sucesso) e
      // estourou o limite em outra (falha) — o tamanho final depende do
      // bitrate nativo dos clipes sorteados, não é determinístico. "sd" corta
      // a contagem de pixels em ~4x, dando folga suficiente para qualquer
      // combinação de cenas, em vez de depender de acertar um limite exato
      // que a API do Supabase não expõe.
      output: { format: "mp4", resolution: "sd", aspectRatio: request.aspectRatio, quality: "medium" },
    });

    return { videoUrl, providerKey: this.providerKey };
  }

  async composeImage(request: ImageCompositionRequest): Promise<ImageCompositionResult> {
    const timeline = buildImageTimeline(request);

    const imageUrl = await this.submitAndPoll({
      timeline,
      output: { format: "jpg", size: { width: request.width, height: request.height } },
    });

    return { imageUrl, providerKey: this.providerKey };
  }

  /**
   * ★ Missão 12 (architecture.md §15.7) — 1 linha de log por ciclo completo
   * submit→poll→done (nunca 1 por poll individual, que rodaria a cada 3s por
   * até ~5min e afogaria a tabela em ruído sem valor de observabilidade —
   * o que importa é quanto tempo o render levou e se terminou bem).
   */
  private async submitAndPoll(body: Record<string, unknown>): Promise<string> {
    const startedAt = new Date();
    const endpoint = `${this.host}/render`;
    let errorMessage: string | undefined;
    let renderId: string | undefined;

    try {
      const submitResponse = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!submitResponse.ok) {
        const errorBody = await submitResponse.text().catch(() => "");
        errorMessage = `Shotstack render (submit) falhou (${submitResponse.status}): ${errorBody}`;
        throw new Error(errorMessage);
      }

      const submitPayload = (await submitResponse.json()) as ShotstackEnvelope<{ id: string }>;
      renderId = submitPayload.response.id;
      return await this.pollUntilDone(renderId);
    } catch (error) {
      errorMessage ??= error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (this.serviceRoleDb) {
        await logProviderCall({
          serviceRoleDb: this.serviceRoleDb,
          providerKey: this.providerKey,
          capability: "video_render",
          endpoint,
          requestId: renderId,
          startedAt,
          finishedAt: new Date(),
          ok: !errorMessage,
          errorMessage,
        });
      }
    }
  }

  private async pollUntilDone(renderId: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const statusResponse = await fetchWithRetry(`${this.host}/render/${renderId}`, {
        headers: { "x-api-key": this.apiKey },
      });

      if (!statusResponse.ok) {
        const errorBody = await statusResponse.text().catch(() => "");
        throw new Error(`Shotstack render (status) falhou (${statusResponse.status}): ${errorBody}`);
      }

      const statusPayload = (await statusResponse.json()) as ShotstackEnvelope<ShotstackRenderStatus>;
      const { status, url, error } = statusPayload.response;

      if (status === "done") {
        if (!url) throw new Error(`Shotstack render ${renderId} terminou "done" sem url.`);
        return url;
      }
      if (status === "failed") {
        throw new Error(`Shotstack render ${renderId} falhou: ${error ?? "motivo não informado"}`);
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`Shotstack render ${renderId} não concluiu dentro do tempo limite de polling (${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms).`);
  }
}

const POLL_INTERVAL_MS = 3000;
/** ~5 minutos de polling — suficiente para um vídeo curto (peça de campanha), nunca indefinido. */
const MAX_POLL_ATTEMPTS = 100;

/** Posição/tamanho discretos do clip de logo (arch. §14.1) — canto inferior direito, pequeno, com uma margem da borda. */
const LOGO_CLIP = { position: "bottomRight", offset: { x: -0.04, y: -0.04 }, scale: 0.12 };

interface ShotstackEnvelope<T> {
  success: boolean;
  message: string;
  response: T;
}

interface ShotstackRenderStatus {
  id: string;
  status: "queued" | "fetching" | "rendering" | "saving" | "done" | "failed";
  url: string | null;
  error?: string | null;
}

/** Fonte customizada (arch. §14.1) declarada 1x no nível da timeline — Shotstack não usa @font-face/webfont, só TTF pré-hospedado. */
function toFonts(branding: VideoBranding | undefined) {
  return branding?.fontUrl ? [{ src: branding.fontUrl }] : undefined;
}

/**
 * Clip de logo opcional (arch. §14.8, branding adaptativo) — layout nunca
 * reserva um espaço vazio: o clip simplesmente não existe quando não há
 * logo, em vez de um placeholder.
 */
function buildLogoClip(branding: VideoBranding | undefined, length: number) {
  if (!branding?.logoUrl) return null;
  return {
    asset: { type: "image", src: branding.logoUrl },
    start: 0,
    length,
    ...LOGO_CLIP,
  };
}

/**
 * Monta a timeline do Shotstack a partir do contrato de capacidade
 * (architecture.md §14.6) — 1 track de branding (logo, quando existir) + 1
 * track de vídeo (cenas em sequência, sem áudio próprio) + 1 soundtrack
 * (narração). ★ Missão 11 — sem track de legenda (removida, arch. §14.2).
 */
function buildVideoTimeline(request: VideoRenderRequest) {
  const totalLength = request.videoSources.reduce((sum, source) => sum + source.lengthSeconds, 0);
  const logoClip = buildLogoClip(request.branding, totalLength);

  const tracks = [
    ...(logoClip ? [{ clips: [logoClip] }] : []),
    {
      clips: request.videoSources.map((source) => ({
        asset: { type: "video", src: source.url, volume: 0 },
        start: source.startSeconds,
        length: source.lengthSeconds,
        fit: "cover",
      })),
    },
  ];

  return {
    soundtrack: { src: request.audioUrl, effect: "fadeOut" },
    background: "#000000",
    fonts: toFonts(request.branding),
    tracks,
  };
}

/**
 * Timeline de 1 frame (composição de imagem, arch. §14.4.1) — foto de fundo
 * + título (tipografia/contraste via `title` asset, mesmo mecanismo já
 * usado e validado no vídeo) + logo opcional. Sem asset `html` (descontinuado
 * pelo Shotstack, nunca suportou imagem dentro do HTML).
 */
const TITLE_SINGLE_LINE_MAX_CHARS = 14;

/**
 * Achado real de validação: o asset `title` do Shotstack não quebra linha
 * sozinho (a propriedade `width` do clip não tem efeito sobre ele — só é
 * respeitada por assets `html`) — títulos maiores que uma linha eram
 * cortados nas bordas do frame. Corrigido inserindo a quebra manualmente
 * (`\n`, que o `title` asset respeita), no ponto mais próximo do meio do
 * texto que caia num espaço entre palavras — nunca no meio de uma palavra.
 */
function wrapTitleForShotstack(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= TITLE_SINGLE_LINE_MAX_CHARS) return trimmed;

  const words = trimmed.split(/\s+/);
  if (words.length <= 1) return trimmed;

  let firstLine = words[0]!;
  let index = 1;
  while (index < words.length) {
    const candidate = `${firstLine} ${words[index]}`;
    if (candidate.length > trimmed.length / 2 + 3) break;
    firstLine = candidate;
    index += 1;
  }
  const secondLine = words.slice(index).join(" ");

  return secondLine ? `${firstLine}\n${secondLine}` : firstLine;
}

function buildImageTimeline(request: ImageCompositionRequest) {
  const length = 1;

  const titleClip = request.title
    ? {
        asset: {
          type: "title",
          text: wrapTitleForShotstack(request.title),
          style: "minimal",
          color: request.branding?.primaryColorHex ?? "#ffffff",
          background: request.branding?.secondaryColorHex ?? "#000000",
          size: "small",
          position: "center",
        },
        start: 0,
        length,
      }
    : null;

  const logoClip = buildLogoClip(request.branding, length);

  const tracks = [
    ...(logoClip ? [{ clips: [logoClip] }] : []),
    ...(titleClip ? [{ clips: [titleClip] }] : []),
    {
      clips: [
        {
          asset: { type: "image", src: request.backgroundImageUrl },
          start: 0,
          length,
          fit: "cover",
        },
      ],
    },
  ];

  return {
    background: "#000000",
    fonts: toFonts(request.branding),
    tracks,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
