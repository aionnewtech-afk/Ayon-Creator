import { describe, expect, it } from "vitest";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice-provider";
import { PexelsMediaProvider } from "./pexels-media-provider";
import { ShotstackVideoRenderProvider } from "./shotstack-video-render-provider";

/**
 * Validação com chamadas reais dos 3 adapters da Missão 9, Etapa 1 — pedido
 * explícito do dono do produto: "valide cada um com chamadas reais antes de
 * montar o pipeline completo" (docs/changelog.md).
 *
 * NUNCA roda em CI nem no `pnpm test` de qualquer dev sem as 3 chaves reais
 * configuradas — cada teste usa `it.skipIf` para pular (não falhar) quando a
 * env var correspondente está ausente, mesmo espírito de isolamento já usado
 * para `LLM_PROVIDER_MODE=fake` (CONVENTIONS.md §10), mas invertido: aqui
 * queremos o oposto de um fake, então o teste só roda quando a chave real
 * está presente. Rodar manualmente: `pnpm --filter core exec vitest run
 * src/providers/video-providers-real.test.ts`.
 *
 * O teste do Shotstack usa uma URL de áudio pública de exemplo como
 * substituta da narração real do ElevenLabs — subir o áudio sintetizado para
 * o Storage e gerar a URL final é responsabilidade do pipeline (Fluxo 13),
 * ainda não montado nesta etapa da implementação.
 */
const SAMPLE_PUBLIC_AUDIO_URL = "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/lit.mp3";

const SAMPLE_SCRIPT =
  "Conheça a Ayon Creator, o sistema operacional de marketing orientado por inteligência artificial.";

describe("ElevenLabsVoiceProvider (chamada real)", () => {
  it.skipIf(!process.env.ELEVENLABS_API_KEY)(
    "sintetiza um roteiro curto e devolve áudio + captionCues com timing",
    async () => {
      const provider = new ElevenLabsVoiceProvider("eleven_multilingual_v2", requireEnv("ELEVENLABS_API_KEY"));

      const startedAt = Date.now();
      const result = await provider.synthesizeVoice({ script: SAMPLE_SCRIPT });
      const elapsedMs = Date.now() - startedAt;

      expect(result.audioBase64.length).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.captionCues.length).toBeGreaterThan(0);
      expect(result.captionCues[0]?.text.length).toBeGreaterThan(0);
      expect(result.captionCues.at(-1)?.endMs).toBeLessThanOrEqual(result.durationMs + 500);

      logMetric("ElevenLabs.synthesizeVoice", {
        elapsedMs,
        inputCharacters: SAMPLE_SCRIPT.length,
        outputAudioDurationMs: result.durationMs,
        audioBase64Bytes: Math.round((result.audioBase64.length * 3) / 4),
        captionCueCount: result.captionCues.length,
        note: "Billing do ElevenLabs é por caractere de entrada (inputCharacters), não por tempo de resposta.",
      });
    },
    30_000,
  );
});

describe("PexelsMediaProvider (chamada real)", () => {
  it.skipIf(!process.env.PEXELS_API_KEY)(
    "busca vídeos verticais e recupera um candidato específico por id",
    async () => {
      const provider = new PexelsMediaProvider("pexels", requireEnv("PEXELS_API_KEY"));

      const searchStartedAt = Date.now();
      const searchResult = await provider.searchMedia({ query: "praia pôr do sol", orientation: "portrait", perPage: 3 });
      const searchElapsedMs = Date.now() - searchStartedAt;

      expect(searchResult.candidates.length).toBeGreaterThan(0);
      const first = searchResult.candidates[0];
      expect(first?.downloadUrl).toMatch(/^https:\/\//);

      const fetchStartedAt = Date.now();
      const fetched = await provider.fetchMedia(first!.id);
      const fetchElapsedMs = Date.now() - fetchStartedAt;

      expect(fetched.id).toBe(first!.id);
      expect(fetched.downloadUrl.length).toBeGreaterThan(0);

      logMetric("Pexels.searchMedia+fetchMedia", {
        searchElapsedMs,
        fetchElapsedMs,
        candidateCount: searchResult.candidates.length,
        note: "API gratuita — sem custo monetário direto, sujeita a rate limit por plano.",
      });
    },
    30_000,
  );
});

describe("ShotstackVideoRenderProvider (chamada real)", () => {
  it.skipIf(!process.env.SHOTSTACK_API_KEY || !process.env.PEXELS_API_KEY)(
    "compõe um vídeo curto (cena do Pexels + áudio de exemplo + legenda) e devolve a URL final",
    async () => {
      const mediaProvider = new PexelsMediaProvider("pexels", requireEnv("PEXELS_API_KEY"));
      const searchResult = await mediaProvider.searchMedia({ query: "praia pôr do sol", orientation: "portrait", perPage: 1 });
      const scene = searchResult.candidates[0];
      expect(scene).toBeDefined();

      const renderProvider = new ShotstackVideoRenderProvider(
        "shotstack",
        requireEnv("SHOTSTACK_API_KEY"),
        requireEnv("SHOTSTACK_HOST"),
      );

      const renderedSeconds = 5;
      const startedAt = Date.now();
      const result = await renderProvider.composeVideo({
        audioUrl: SAMPLE_PUBLIC_AUDIO_URL,
        videoSources: [{ url: scene!.downloadUrl, startSeconds: 0, lengthSeconds: renderedSeconds }],
        captionCues: [{ text: "Validação Missão 9 — Etapa 1", startSeconds: 0, lengthSeconds: renderedSeconds }],
        aspectRatio: "9:16",
      });
      const elapsedMs = Date.now() - startedAt;

      expect(result.videoUrl).toMatch(/^https:\/\//);
      expect(result.providerKey).toBe("shotstack");

      logMetric("Shotstack.composeVideo", {
        elapsedMsSubmitToDone: elapsedMs,
        renderedSeconds,
        note: "Sandbox (stage): renders com marca d'água, sem custo. Custo de produção é por segundo renderizado, conforme plano contratado — confirmar valor exato no dashboard do Shotstack.",
      });
    },
    5 * 60_000,
  );
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

/** Log estruturado para captura manual dos dados de custo/latência pedidos pelo dono do produto. */
function logMetric(label: string, data: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`[metric] ${label}`, JSON.stringify(data, null, 2));
}
