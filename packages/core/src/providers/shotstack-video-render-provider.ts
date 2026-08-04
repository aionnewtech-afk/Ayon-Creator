import type {
  VideoRenderProvider,
  VideoRenderRequest,
  VideoRenderResult,
} from "./video-render-provider";

/**
 * Adapter concreto do Video Render Provider (architecture.md §5, §3.5.1)
 * para o Shotstack — Missão 9, Etapa 1. Único arquivo do monorepo que
 * importa a API do Shotstack; trocar de fornecedor nunca exige mudar quem
 * chama `VideoRenderProvider`, só o resultado da resolução em
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
  ) {
    // Defensivo: aceita tanto a base documentada (`.../edit/stage`) quanto
    // uma variante com `/render` já incluído — nunca falha silenciosamente
    // duplicando o segmento na URL final.
    this.host = host.replace(/\/+$/, "").replace(/\/render$/, "");
  }

  async composeVideo(request: VideoRenderRequest): Promise<VideoRenderResult> {
    const timeline = buildTimeline(request);

    const submitResponse = await fetch(`${this.host}/render`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeline,
        output: { format: "mp4", resolution: "hd", aspectRatio: request.aspectRatio },
      }),
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text().catch(() => "");
      throw new Error(`Shotstack composeVideo (submit) falhou (${submitResponse.status}): ${errorBody}`);
    }

    const submitPayload = (await submitResponse.json()) as ShotstackEnvelope<{ id: string }>;
    const videoUrl = await this.pollUntilDone(submitPayload.response.id);

    return { videoUrl, providerKey: this.providerKey };
  }

  private async pollUntilDone(renderId: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const statusResponse = await fetch(`${this.host}/render/${renderId}`, {
        headers: { "x-api-key": this.apiKey },
      });

      if (!statusResponse.ok) {
        const errorBody = await statusResponse.text().catch(() => "");
        throw new Error(`Shotstack composeVideo (status) falhou (${statusResponse.status}): ${errorBody}`);
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

/**
 * Monta a timeline do Shotstack a partir do contrato de capacidade
 * (architecture.md §3.5.1): 1 track de legenda (um clip `title` por cue) +
 * 1 track de vídeo (cenas em sequência, sem áudio próprio) + 1 soundtrack
 * (narração).
 */
function buildTimeline(request: VideoRenderRequest) {
  return {
    soundtrack: { src: request.audioUrl, effect: "fadeOut" },
    background: "#000000",
    tracks: [
      {
        clips: request.captionCues.map((cue) => ({
          asset: {
            type: "title",
            text: cue.text,
            style: "subtitle",
            color: "#ffffff",
            size: "small",
            background: "#000000",
            position: "bottom",
          },
          start: cue.startSeconds,
          length: cue.lengthSeconds,
        })),
      },
      {
        clips: request.videoSources.map((source) => ({
          asset: { type: "video", src: source.url, volume: 0 },
          start: source.startSeconds,
          length: source.lengthSeconds,
          fit: "cover",
        })),
      },
    ],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
