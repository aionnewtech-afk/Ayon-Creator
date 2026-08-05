import { describe, expect, it } from "vitest";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice-provider";
import { PexelsMediaProvider } from "./pexels-media-provider";
import { ShotstackVideoRenderProvider } from "./shotstack-video-render-provider";

/**
 * Validação com chamadas reais dos adapters do Asset Engine — pedido
 * explícito do dono do produto desde a Missão 9: "valide cada um com
 * chamadas reais antes de montar o pipeline completo" (docs/changelog.md).
 * Missão 11 (arch. §14) acrescenta a busca de fotos (Pexels) e a composição
 * de imagem (Shotstack, timeline em camadas — sem asset `html`).
 *
 * NUNCA roda em CI nem no `pnpm test` de qualquer dev sem as chaves reais
 * configuradas — cada teste usa `it.skipIf` para pular (não falhar) quando a
 * env var correspondente está ausente. Rodar manualmente: `pnpm --filter
 * core exec vitest run src/providers/video-providers-real.test.ts`.
 *
 * O teste do Shotstack usa uma URL de áudio pública de exemplo como
 * substituta da narração real do ElevenLabs — subir o áudio sintetizado para
 * o Storage e gerar a URL final é responsabilidade do pipeline (Fluxo 13).
 */
const SAMPLE_PUBLIC_AUDIO_URL = "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/lit.mp3";

const SAMPLE_SCRIPT =
  "Conheça a Ayon Creator, o sistema operacional de marketing orientado por inteligência artificial.";

describe("ElevenLabsVoiceProvider (chamada real)", () => {
  it.skipIf(!process.env.ELEVENLABS_API_KEY)(
    "sintetiza um roteiro curto e devolve áudio + duração, com voice_settings customizado",
    async () => {
      const provider = new ElevenLabsVoiceProvider("eleven_multilingual_v2", requireEnv("ELEVENLABS_API_KEY"));

      const startedAt = Date.now();
      const result = await provider.synthesizeVoice({
        script: SAMPLE_SCRIPT,
        voiceSettings: { stability: 0.45, similarityBoost: 0.8, style: 0.2, speed: 1.05 },
      });
      const elapsedMs = Date.now() - startedAt;

      expect(result.audioBase64.length).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);

      logMetric("ElevenLabs.synthesizeVoice", {
        elapsedMs,
        inputCharacters: SAMPLE_SCRIPT.length,
        outputAudioDurationMs: result.durationMs,
        audioBase64Bytes: Math.round((result.audioBase64.length * 3) / 4),
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

  it.skipIf(!process.env.PEXELS_API_KEY)(
    "★ Missão 11 — busca fotos verticais (searchPhotos)",
    async () => {
      const provider = new PexelsMediaProvider("pexels", requireEnv("PEXELS_API_KEY"));

      const startedAt = Date.now();
      const result = await provider.searchPhotos({ query: "Gramado serra gaúcha", orientation: "portrait", perPage: 3 });
      const elapsedMs = Date.now() - startedAt;

      expect(result.candidates.length).toBeGreaterThan(0);
      const first = result.candidates[0];
      expect(first?.downloadUrl).toMatch(/^https:\/\//);
      expect(first?.durationSeconds).toBeUndefined();

      logMetric("Pexels.searchPhotos", { elapsedMs, candidateCount: result.candidates.length });
    },
    30_000,
  );
});

describe("ShotstackVideoRenderProvider (chamada real)", () => {
  it.skipIf(!process.env.SHOTSTACK_API_KEY || !process.env.PEXELS_API_KEY)(
    "compõe um vídeo curto (cena do Pexels + áudio de exemplo) e devolve a URL final",
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
        aspectRatio: "9:16",
      });
      const elapsedMs = Date.now() - startedAt;

      expect(result.videoUrl).toMatch(/^https:\/\//);
      expect(result.providerKey).toBe("shotstack");

      logMetric("Shotstack.composeVideo", {
        elapsedMsSubmitToDone: elapsedMs,
        renderedSeconds,
        note: "Sandbox (stage): renders com marca d'água, sem custo. Sem legenda embutida (Missão 11) — só cenas + narração.",
      });
    },
    5 * 60_000,
  );

  it.skipIf(!process.env.SHOTSTACK_API_KEY || !process.env.PEXELS_API_KEY)(
    "★ Missão 11 — compõe uma imagem (foto + título) sem branding, valida o mecanismo de timeline em camadas",
    async () => {
      const mediaProvider = new PexelsMediaProvider("pexels", requireEnv("PEXELS_API_KEY"));
      const searchResult = await mediaProvider.searchPhotos({ query: "Gramado serra gaúcha", orientation: "portrait", perPage: 1 });
      const photo = searchResult.candidates[0];
      expect(photo).toBeDefined();

      const renderProvider = new ShotstackVideoRenderProvider(
        "shotstack",
        requireEnv("SHOTSTACK_API_KEY"),
        requireEnv("SHOTSTACK_HOST"),
      );

      const startedAt = Date.now();
      const result = await renderProvider.composeImage({
        backgroundImageUrl: photo!.downloadUrl,
        title: "Validação Missão 11",
        width: 1080,
        height: 1920,
      });
      const elapsedMs = Date.now() - startedAt;

      expect(result.imageUrl).toMatch(/^https:\/\//);
      expect(result.providerKey).toBe("shotstack");

      logMetric("Shotstack.composeImage (sem branding)", { elapsedMs });
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
