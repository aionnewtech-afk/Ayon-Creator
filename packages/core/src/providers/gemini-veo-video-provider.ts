import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { MediaCandidate } from "./media-provider";
import { logProviderCall } from "./log-provider-call";
import { fetchWithRetry } from "../shared/fetch-with-retry";

const GEMINI_NATIVE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const VIDEO_BUCKET = "content-output";
const SIGNED_URL_TTL_SECONDS = 3600;

/** ★ Achado real (validação direta na API): 8/6/4 são os únicos valores aceitos, e precisam ser NÚMERO JSON — string (`"4"`) é rejeitada com 400 ("value type... needs to be a number"), apesar da doc pública mostrar os valores entre aspas. 4 é o mais próximo do corte rápido (MAX_CLIP_SECONDS=3) sem custo/tempo extra do que 6-8s renderizados só pra serem cortados. */
const VEO_DURATION_SECONDS = 4;
/** ★ Achado real: 720p é o padrão, mais barato/rápido que 1080p — b-roll cortado em ~3s não precisa de mais resolução que isso. */
const VEO_WIDTH = 720;
const VEO_HEIGHT = 1280;

/** ★ Achado real (validação direta na API, docs oficiais): "Min: 11 segundos; Max: 6 minutos (horário de pico)" — folga generosa, mesmo espírito do polling do Shotstack (`submitAndPoll`). */
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 45; // ~7.5min

interface VeoOperation {
  name: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: { uri?: string } }[];
    };
  };
}

export interface GeminiVeoVideoContext {
  organizationId: string;
  campaignId: string;
  contentPieceId: string;
}

/**
 * Adapter de GERAÇÃO de vídeo via Gemini (Veo 3.1) — 3ª camada do fallback
 * híbrido de cenas de vídeo (`video-pipeline-scenes.ts`), pedido direto do
 * usuário depois de aprovar um teste real pago: Pexels (busca real) → Veo
 * (gera um clipe real) → imagem gerada + Ken Burns → repete o último clipe.
 * Só a última camada não usa mídia genuinamente nova.
 *
 * ★ Achado real de custo (confirmado com o usuário antes de integrar,
 * diferente da geração de imagem que é quase gratuita): Veo cobra por
 * segundo de vídeo gerado — "Lite" ($0.05-0.08/s) é o tier mais barato,
 * escolhido explicitamente pelo usuário. Nunca ativa sem
 * `VIDEO_GENERATION_PROVIDER=gemini` (env var própria, separada de
 * `IMAGE_GENERATION_PROVIDER` — perfis de custo/latência completamente
 * diferentes, nunca devem ficar acoplados no mesmo toggle).
 *
 * ★ Achado real de latência (docs oficiais + validação direta): geração
 * pode levar até ~6 minutos em horário de pico — `video-pipeline-scenes.ts`
 * limita a NO MÁXIMO 1 geração Veo por vídeo (nunca 1 por trecho exaurido),
 * pra nunca compor várias esperas de minutos em série.
 */
export class GeminiVeoVideoProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
    private readonly serviceRoleDb: SupabaseClient<Database>,
    private readonly context: GeminiVeoVideoContext,
  ) {}

  async generateVideo(prompt: string): Promise<MediaCandidate> {
    const startedAt = new Date();
    let errorMessage: string | undefined;

    try {
      const submitResponse = await fetchWithRetry(`${GEMINI_NATIVE_BASE_URL}/models/${this.providerKey}:predictLongRunning`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { aspectRatio: "9:16", durationSeconds: VEO_DURATION_SECONDS, resolution: "720p" },
        }),
      });

      if (!submitResponse.ok) {
        const errorBody = await submitResponse.text().catch(() => "");
        errorMessage = `Veo (submit) respondeu ${submitResponse.status}: ${errorBody}`;
        throw new Error(errorMessage);
      }

      const operation = (await submitResponse.json()) as VeoOperation;
      const videoUri = await this.pollUntilDone(operation.name);

      const videoResponse = await fetchWithRetry(videoUri, { headers: { "x-goog-api-key": this.apiKey } });
      if (!videoResponse.ok) {
        errorMessage = `Veo (download do vídeo) respondeu ${videoResponse.status}.`;
        throw new Error(errorMessage);
      }
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

      const storagePath =
        `${this.context.organizationId}/${this.context.campaignId}/generated/` +
        `${this.context.contentPieceId}-veo-${startedAt.getTime()}.mp4`;

      const { error: uploadError } = await this.serviceRoleDb.storage
        .from(VIDEO_BUCKET)
        .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });
      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await this.serviceRoleDb.storage
        .from(VIDEO_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed) throw signError ?? new Error("Falha ao criar signed URL para o vídeo gerado.");

      return {
        id: storagePath,
        previewUrl: signed.signedUrl,
        downloadUrl: signed.signedUrl,
        width: VEO_WIDTH,
        height: VEO_HEIGHT,
        durationSeconds: VEO_DURATION_SECONDS,
        providerKey: this.providerKey,
      };
    } catch (error) {
      errorMessage ??= error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await logProviderCall({
        serviceRoleDb: this.serviceRoleDb,
        providerKey: this.providerKey,
        capability: "media",
        model: this.providerKey,
        endpoint: `${GEMINI_NATIVE_BASE_URL}/models/${this.providerKey}:predictLongRunning`,
        organizationId: this.context.organizationId,
        startedAt,
        finishedAt: new Date(),
        ok: !errorMessage,
        errorMessage,
      });
    }
  }

  private async pollUntilDone(operationName: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const response = await fetchWithRetry(`${GEMINI_NATIVE_BASE_URL}/${operationName}`, {
        headers: { "x-goog-api-key": this.apiKey },
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`Veo (poll) respondeu ${response.status}: ${errorBody}`);
      }

      const operation = (await response.json()) as VeoOperation;
      if (operation.done) {
        if (operation.error?.message) {
          throw new Error(`Veo falhou: ${operation.error.message}`);
        }
        const uri = operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!uri) throw new Error("Veo concluiu sem devolver nenhum vídeo.");
        return uri;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(`Veo não concluiu dentro do tempo limite de polling (${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s).`);
  }
}
