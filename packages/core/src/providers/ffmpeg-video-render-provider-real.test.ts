import { createServer, type Server } from "node:http";
import { readFile as readFileCallback } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@ayon/types";
import { FfmpegVideoRenderProvider } from "./ffmpeg-video-render-provider";
import type { VideoRenderRequest, ImageCompositionRequest } from "./video-render-provider";

const execFileAsync = promisify(execFile);

/**
 * Validação com chamadas reais do motor de composição próprio (ffmpeg,
 * `ffmpeg-video-render-provider.ts`) — mesma exigência de sempre ("valide
 * cada um com chamadas reais"), adaptada: em vez de depender de crédito de
 * Pexels/ElevenLabs para gerar cenas/narração de exemplo, este teste gera
 * localmente (via o próprio ffmpeg, `-f lavfi`) 2 cenas de vídeo sintéticas
 * + 1 áudio sintético, serve elas por um servidor HTTP local (o provider só
 * enxerga URLs, exatamente como enxergaria Pexels/ElevenLabs reais), e
 * exercita o pipeline REAL de ponta a ponta: download por HTTP real, execução
 * real do binário ffmpeg com o filter_complex real usado em produção, upload
 * real para o Supabase Storage.
 *
 * Requer `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (mesmas do
 * resto do projeto). Rodar manualmente:
 * `node --env-file=../../.env.local ./node_modules/.bin/vitest run src/providers/ffmpeg-video-render-provider-real.test.ts`
 * (a partir de packages/core).
 */
describe("FfmpegVideoRenderProvider (execução real do ffmpeg + Supabase Storage)", () => {
  const hasAllEnv = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

  let workDir: string;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    if (!hasAllEnv) return;
    const ffmpegModule = await import(/* webpackIgnore: true */ "ffmpeg-static");
    const ffmpegPath = (ffmpegModule.default ?? ffmpegModule) as string;

    workDir = await mkdtemp(path.join(tmpdir(), "ayon-render-test-"));

    // 2 cenas sintéticas (padrões visuais diferentes, pra provar que o
    // `concat` realmente junta 2 fontes distintas em sequência) + 1 áudio
    // sintético (tom senoidal, 4s — cobre a soma das 2 cenas: 2s + 2s).
    await execFileAsync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:duration=2:rate=25", path.join(workDir, "scene0.mp4"),
    ]);
    await execFileAsync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", "smptebars=size=640x360:duration=2:rate=25", path.join(workDir, "scene1.mp4"),
    ]);
    await execFileAsync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", path.join(workDir, "narration.mp3"),
    ]);
    // ★ Narração de 2 tons distintos (300Hz depois 900Hz, 2s cada) — usada só
    // pelo teste de sincronia (abaixo): permite provar, por frequência real
    // medida no áudio final, que reordenar cenas de verdade move o clipe de
    // narração certo junto (não só que o ffmpeg roda sem erro).
    await execFileAsync(ffmpegPath, [
      "-y",
      "-f", "lavfi", "-i", "sine=frequency=300:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=900:duration=2",
      "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]",
      "-map", "[a]",
      path.join(workDir, "narration-two-tone.mp3"),
    ]);
    await execFileAsync(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", "color=c=blue:s=800x600:d=1", "-frames:v", "1", path.join(workDir, "background.jpg"),
    ]);

    server = createServer((req, res) => {
      const filePath = path.join(workDir, path.basename(req.url ?? ""));
      readFileCallback(filePath, (error, data) => {
        if (error) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200).end(data);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 60_000);

  afterAll(async () => {
    if (!hasAllEnv) return;
    await new Promise((resolve) => server.close(resolve));
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  });

  it.skipIf(!hasAllEnv)(
    "compõe um vídeo real (2 cenas sintéticas + narração + título de capa + rótulo + marca d'água) e publica no Storage",
    async () => {
      const serviceRoleDb = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );

      const provider = new FfmpegVideoRenderProvider("ffmpeg", serviceRoleDb);

      const request: VideoRenderRequest = {
        audioUrl: `${baseUrl}/narration.mp3`,
        aspectRatio: "9:16",
        coverTitle: "Teste real: ffmpeg",
        branding: { watermarkText: "@ayoncreator" },
        videoSources: [
          { url: `${baseUrl}/scene0.mp4`, startSeconds: 0, lengthSeconds: 2, assetType: "video" },
          { url: `${baseUrl}/scene1.mp4`, startSeconds: 2, lengthSeconds: 2, assetType: "video", onScreenLabel: "Cena de teste" },
        ],
      };

      const startedAt = Date.now();
      const result = await provider.composeVideo(request);
      const elapsedMs = Date.now() - startedAt;

      expect(result.providerKey).toBe("ffmpeg");
      expect(result.videoUrl).toMatch(/^https:\/\//);

      const downloaded = await fetch(result.videoUrl);
      expect(downloaded.ok).toBe(true);
      const buffer = Buffer.from(await downloaded.arrayBuffer());
      // Assinatura de um MP4 válido (ftyp box) — prova que o arquivo publicado
      // é um vídeo real, não um artefato vazio/corrompido.
      expect(buffer.length).toBeGreaterThan(10_000);
      expect(buffer.subarray(4, 8).toString("ascii")).toBe("ftyp");

      // eslint-disable-next-line no-console
      console.log("[metric] FfmpegVideoRenderProvider.composeVideo", JSON.stringify({ elapsedMs, outputBytes: buffer.length }));
    },
    120_000,
  );

  it.skipIf(!hasAllEnv)(
    "quando as cenas são reordenadas, a narração de cada trecho acompanha (áudio segmentado, adelay/amix)",
    async () => {
      const serviceRoleDb = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );
      const provider = new FfmpegVideoRenderProvider("ffmpeg", serviceRoleDb);

      // Narração real: trecho 0 = tom de 300Hz (0-2s), trecho 1 = tom de
      // 900Hz (2-4s) — posições FIXAS no arquivo original. As cenas abaixo
      // já vêm na ordem REORDENADA (trecho 1 primeiro na tela, trecho 0
      // depois — como se o usuário tivesse arrastado as cenas do trecho 1
      // pra frente), `startSeconds` já recomputado pra essa nova ordem
      // (mesmo contrato de `video-pipeline-scene-edit.ts`). Se a sincronia
      // funcionar, o vídeo final deve tocar o tom de 900Hz nos primeiros 2s
      // (é o trecho que agora vem primeiro) e o de 300Hz nos últimos 2s.
      const request: VideoRenderRequest = {
        audioUrl: `${baseUrl}/narration-two-tone.mp3`,
        aspectRatio: "9:16",
        videoSources: [
          { url: `${baseUrl}/scene1.mp4`, startSeconds: 0, lengthSeconds: 1, segmentIndex: 1, audioStartSeconds: 2, audioEndSeconds: 4 },
          { url: `${baseUrl}/scene1.mp4`, startSeconds: 1, lengthSeconds: 1, segmentIndex: 1, audioStartSeconds: 2, audioEndSeconds: 4 },
          { url: `${baseUrl}/scene0.mp4`, startSeconds: 2, lengthSeconds: 1, segmentIndex: 0, audioStartSeconds: 0, audioEndSeconds: 2 },
          { url: `${baseUrl}/scene0.mp4`, startSeconds: 3, lengthSeconds: 1, segmentIndex: 0, audioStartSeconds: 0, audioEndSeconds: 2 },
        ],
      };

      const result = await provider.composeVideo(request);
      const downloaded = await fetch(result.videoUrl);
      const buffer = Buffer.from(await downloaded.arrayBuffer());
      const localVideoPath = path.join(workDir, "sync-check.mp4");
      const { writeFile } = await import("node:fs/promises");
      await writeFile(localVideoPath, buffer);

      const ffmpegModule = await import(/* webpackIgnore: true */ "ffmpeg-static");
      const ffmpegPath = (ffmpegModule.default ?? ffmpegModule) as string;

      const dominantFrequency = async (startSeconds: number): Promise<number> => {
        const pcmPath = path.join(workDir, `window-${startSeconds}.pcm`);
        await execFileAsync(ffmpegPath, [
          "-y", "-i", localVideoPath, "-ss", String(startSeconds), "-t", "2",
          "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", pcmPath,
        ]);
        const { readFile } = await import("node:fs/promises");
        const pcm = await readFile(pcmPath);
        const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
        let crossings = 0;
        for (let i = 1; i < samples.length; i++) {
          if ((samples[i - 1]! >= 0) !== (samples[i]! >= 0)) crossings++;
        }
        const durationSeconds = samples.length / 8000;
        return crossings / (2 * durationSeconds);
      };

      const firstWindowFrequency = await dominantFrequency(0);
      const secondWindowFrequency = await dominantFrequency(2);

      // eslint-disable-next-line no-console
      console.log("[metric] audio_sync_frequencies", JSON.stringify({ firstWindowFrequency, secondWindowFrequency }));

      // Tolerância generosa (±60Hz) — zero-crossing rate é uma estimativa,
      // não uma FFT exata, mas 300 vs 900Hz distam o bastante pra não haver
      // ambiguidade nenhuma.
      expect(firstWindowFrequency).toBeGreaterThan(700);
      expect(firstWindowFrequency).toBeLessThan(1100);
      expect(secondWindowFrequency).toBeGreaterThan(200);
      expect(secondWindowFrequency).toBeLessThan(500);
    },
    120_000,
  );

  it.skipIf(!hasAllEnv)(
    "compõe um vídeo com balão de texto, velocidade de narração e animação sonora (estilo CapCut)",
    async () => {
      const serviceRoleDb = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );
      const provider = new FfmpegVideoRenderProvider("ffmpeg", serviceRoleDb);

      const request: VideoRenderRequest = {
        audioUrl: `${baseUrl}/narration.mp3`,
        aspectRatio: "9:16",
        includeSoundAnimation: true,
        videoSources: [
          {
            url: `${baseUrl}/scene0.mp4`,
            startSeconds: 0,
            lengthSeconds: 2,
            segmentIndex: 0,
            audioStartSeconds: 0,
            audioEndSeconds: 2,
            audioPlaybackRate: 1.5,
            textBalloons: [{ text: "Você viajaria por um doce?", xFraction: 0.15, yFraction: 0.1 }],
          },
          { url: `${baseUrl}/scene1.mp4`, startSeconds: 2, lengthSeconds: 2, segmentIndex: 1, audioStartSeconds: 2, audioEndSeconds: 4 },
        ],
      };

      const result = await provider.composeVideo(request);
      const downloaded = await fetch(result.videoUrl);
      expect(downloaded.ok).toBe(true);
      const buffer = Buffer.from(await downloaded.arrayBuffer());
      expect(buffer.length).toBeGreaterThan(10_000);
      expect(buffer.subarray(4, 8).toString("ascii")).toBe("ftyp");

      const localVideoPath = path.join(workDir, "capcut-features.mp4");
      const { writeFile, readFile: readFileForFrame } = await import("node:fs/promises");
      await writeFile(localVideoPath, buffer);

      const ffmpegModule = await import(/* webpackIgnore: true */ "ffmpeg-static");
      const ffmpegPath = (ffmpegModule.default ?? ffmpegModule) as string;

      // Extrai um frame durante a 1ª cena (balão + animação sonora deveriam
      // estar visíveis) pra inspeção visual real — não só "não deu erro".
      // Salvo FORA de `workDir` (que o `afterAll` apaga) pra sobreviver à
      // execução do teste e poder ser aberto manualmente depois.
      const persistentDir = "C:\\Users\\Andrei\\AppData\\Local\\Temp\\ayon-capcut-frames";
      await execFileAsync("cmd", ["/c", "mkdir", persistentDir]).catch(() => {});
      const framePath = path.join(persistentDir, "capcut-features-frame.png");
      await execFileAsync(ffmpegPath, ["-y", "-i", localVideoPath, "-ss", "0.5", "-frames:v", "1", framePath]);
      const frameBuffer = await readFileForFrame(framePath);
      expect(frameBuffer.length).toBeGreaterThan(1000);

      // eslint-disable-next-line no-console
      console.log("[debug] capcut_features_frame_saved_at", framePath);
    },
    120_000,
  );

  it.skipIf(!hasAllEnv)(
    "compõe uma imagem real (headline + subheadline + CTA + painel) via sharp e publica no Storage",
    async () => {
      const serviceRoleDb = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );

      const provider = new FfmpegVideoRenderProvider("ffmpeg", serviceRoleDb);

      const request: ImageCompositionRequest = {
        backgroundImageUrl: `${baseUrl}/background.jpg`,
        title: "Título de teste",
        subheadline: "Subtítulo de apoio pro teste real",
        ctaText: "Fale conosco",
        width: 1080,
        height: 1920,
        branding: { primaryColorHex: "#ffcc00", secondaryColorHex: "#1a1a2e" },
      };

      const result = await provider.composeImage(request);
      expect(result.providerKey).toBe("ffmpeg");
      expect(result.imageUrl).toMatch(/^https:\/\//);

      const downloaded = await fetch(result.imageUrl);
      expect(downloaded.ok).toBe(true);
      const buffer = Buffer.from(await downloaded.arrayBuffer());
      expect(buffer.length).toBeGreaterThan(1_000);
      // Assinatura JPEG (SOI marker).
      expect(buffer[0]).toBe(0xff);
      expect(buffer[1]).toBe(0xd8);
    },
    60_000,
  );
});
