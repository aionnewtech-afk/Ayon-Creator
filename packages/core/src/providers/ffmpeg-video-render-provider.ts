import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type {
  ImageCompositionRequest,
  ImageCompositionResult,
  VideoRenderProvider,
  VideoRenderRequest,
  VideoRenderResult,
} from "./video-render-provider";
import { logProviderCall } from "./log-provider-call";
import { fetchWithRetry } from "../shared/fetch-with-retry";
import { logger } from "../logger";

const CONTENT_OUTPUT_BUCKET = "content-output";

// ★ Achado real (pedido direto do usuário — "a gente tem CapCut Pro mas não
// tem API pra usar no lugar do Shotstack" / "podemos deixar de usar API pra
// essa render e desenvolver algo nosso... já tem as cenas separadas, é só
// criar uma timeline estilo capcut"): motivo real da troca — créditos do
// Shotstack (sandbox) e da Gemini se esgotaram repetidas vezes, cada vez
// travando a geração de vídeo até recarga manual. `VideoRenderSceneSource[]`
// já é uma timeline completa (ordem, duração, trim, texto por cena) —
// bastava um motor de composição que lesse ela sem depender de crédito de
// terceiro. `ffmpeg-static` (binário estático, sem dependência de sistema no
// container) roda essa mesma timeline localmente, de graça, sem limite de
// crédito — só o custo de CPU/tempo do próprio servidor.
const FRAME_WIDTH = 720;
const FRAME_HEIGHT = 1280;
const FPS = 30;
const COVER_TITLE_DISPLAY_SECONDS = 2.2;

/**
 * ★ Achado real (build de produção quebrado — "Module not found: Can't
 * resolve 'node:util'/'node:child_process'..."): mesmo motivo já documentado
 * em shotstack-video-render-provider.ts pro `sharp` — este arquivo é
 * alcançável pelo bundle do CLIENTE através do barrel plano de `@ayon/core`
 * (provider-gateway.ts → index.ts, importado por client components como o
 * sidebar), mesmo nunca sendo de fato CHAMADO por nenhum deles. Import
 * ESTÁTICO de módulo nativo do Node faz o webpack tentar empacotar essas
 * libs pro browser (onde não existem) e o build falha. `import()` dinâmico
 * com `webpackIgnore: true` (mesma técnica do `sharp`) faz o webpack pular a
 * análise por completo — só resolvido em runtime, que nunca acontece no
 * client (estes métodos só rodam server-side, no pipeline de vídeo).
 */
interface NodeDeps {
  execFileAsync: (file: string, args: string[], options: { maxBuffer: number }) => Promise<{ stdout: string; stderr: string }>;
  mkdtemp: (prefix: string) => Promise<string>;
  readFile: (path: string) => Promise<Buffer>;
  rm: (path: string, options: { recursive: boolean; force: boolean }) => Promise<void>;
  writeFile: (path: string, data: Buffer) => Promise<void>;
  path: { join: (...parts: string[]) => string };
  tmpdir: () => string;
}

let cachedNodeDeps: NodeDeps | null = null;

async function loadNodeDeps(): Promise<NodeDeps> {
  if (cachedNodeDeps) return cachedNodeDeps;

  const [childProcess, fsPromises, os, pathModule, util] = await Promise.all([
    import(/* webpackIgnore: true */ "node:child_process"),
    import(/* webpackIgnore: true */ "node:fs/promises"),
    import(/* webpackIgnore: true */ "node:os"),
    import(/* webpackIgnore: true */ "node:path"),
    import(/* webpackIgnore: true */ "node:util"),
  ]);

  const path = (pathModule.default ?? pathModule) as NodeDeps["path"];
  const execFileAsync = util.promisify(childProcess.execFile) as NodeDeps["execFileAsync"];

  cachedNodeDeps = {
    execFileAsync,
    mkdtemp: fsPromises.mkdtemp,
    readFile: fsPromises.readFile,
    rm: fsPromises.rm,
    writeFile: fsPromises.writeFile,
    path,
    tmpdir: os.tmpdir,
  };
  return cachedNodeDeps;
}

/**
 * ★ Mesmo achado do `VIDEO_FRAME_WIDTH_PX` em shotstack-video-render-provider.ts
 * (nunca validado com um render real por falta de crédito) — aqui a
 * resolução é escolhida por nós (não um preset de terceiro), então é
 * garantida, mas o RESULTADO VISUAL (legibilidade dos textos, enquadramento
 * do Ken Burns) ainda não foi conferido a olho nu num vídeo real de ponta a
 * ponta — só validado que o comando ffmpeg roda e produz um .mp4 válido.
 */
export class FfmpegVideoRenderProvider implements VideoRenderProvider {
  constructor(
    private readonly providerKey: string,
    private readonly serviceRoleDb?: SupabaseClient<Database>,
  ) {}

  async composeVideo(request: VideoRenderRequest): Promise<VideoRenderResult> {
    const startedAt = new Date();
    const deps = await loadNodeDeps();
    const workDir = await deps.mkdtemp(deps.path.join(deps.tmpdir(), "ayon-render-"));
    let errorMessage: string | undefined;

    try {
      const outputPath = deps.path.join(workDir, "output.mp4");
      await renderVideoWithFfmpeg(request, workDir, outputPath, deps);
      const videoUrl = await this.publish(outputPath, "mp4", "video/mp4", deps);
      return { videoUrl, providerKey: this.providerKey };
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await logCall(this.serviceRoleDb, this.providerKey, "composeVideo", startedAt, errorMessage);
      await deps.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async composeImage(request: ImageCompositionRequest): Promise<ImageCompositionResult> {
    const startedAt = new Date();
    let errorMessage: string | undefined;

    try {
      const buffer = await renderImageWithSharp(request);
      const imageUrl = await this.publishBuffer(buffer, "jpg", "image/jpeg");
      return { imageUrl, providerKey: this.providerKey };
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await logCall(this.serviceRoleDb, this.providerKey, "composeImage", startedAt, errorMessage);
    }
  }

  private async publish(filePath: string, extension: string, contentType: string, deps: NodeDeps): Promise<string> {
    const buffer = await deps.readFile(filePath);
    return this.publishBuffer(buffer, extension, contentType);
  }

  private async publishBuffer(buffer: Buffer, extension: string, contentType: string): Promise<string> {
    if (!this.serviceRoleDb) {
      throw new Error("FfmpegVideoRenderProvider precisa de serviceRoleDb para publicar o resultado renderizado.");
    }

    const storagePath = `_renders/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error: uploadError } = await this.serviceRoleDb.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { data: signed, error: signError } = await this.serviceRoleDb.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (signError || !signed) throw signError ?? new Error("Falha ao gerar link do arquivo renderizado.");

    return signed.signedUrl;
  }
}

async function logCall(
  serviceRoleDb: SupabaseClient<Database> | undefined,
  providerKey: string,
  endpoint: string,
  startedAt: Date,
  errorMessage: string | undefined,
): Promise<void> {
  if (!serviceRoleDb) return;
  await logProviderCall({
    serviceRoleDb,
    providerKey,
    capability: "video_render",
    endpoint: `ffmpeg:${endpoint}`,
    startedAt,
    finishedAt: new Date(),
    ok: !errorMessage,
    errorMessage,
  });
}

async function downloadToFile(url: string, destPath: string, deps: NodeDeps): Promise<void> {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`Download falhou (${response.status}) para ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  await deps.writeFile(destPath, Buffer.from(arrayBuffer));
}

/**
 * Escapa texto para o parâmetro `text` do filtro `drawtext` do ffmpeg —
 * `:`/`\`/`,`/`%` são delimitadores do filtergraph e precisam de escape, ou
 * um nome/rótulo com um desses caracteres quebraria o comando inteiro (nunca
 * silenciosamente truncado, o ffmpeg recusa o filtro malformado). Aspas
 * simples são substituídas por um apóstrofo tipográfico (’, visualmente
 * idêntico) em vez de escapadas — a regra de escape de aspas do ffmpeg
 * dentro de um valor já delimitado por aspas simples é frágil o bastante
 * pra preferir nunca precisar dela.
 */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/%/g, "\\%")
    .replace(/'/g, "’");
}

interface DrawtextOptions {
  text: string;
  fontPath?: string;
  fontSize: number;
  fontColor: string;
  x: string;
  y: string;
  boxColor?: string;
  boxOpacity?: number;
  enableExpr?: string;
}

function buildDrawtext(options: DrawtextOptions): string {
  const parts = [`text='${escapeDrawtext(options.text)}'`, `fontsize=${options.fontSize}`, `fontcolor=${options.fontColor}`, `x=${options.x}`, `y=${options.y}`];
  if (options.fontPath) parts.push(`fontfile='${options.fontPath.replace(/\\/g, "/").replace(/:/g, "\\:")}'`);
  if (options.boxColor) {
    parts.push("box=1", `boxcolor=${options.boxColor}@${options.boxOpacity ?? 0.5}`, "boxborderw=16");
  }
  if (options.enableExpr) parts.push(`enable='${options.enableExpr}'`);
  return `drawtext=${parts.join(":")}`;
}

async function renderVideoWithFfmpeg(request: VideoRenderRequest, workDir: string, outputPath: string, deps: NodeDeps): Promise<void> {
  const ffmpegPathModule = await import(/* webpackIgnore: true */ "ffmpeg-static");
  const ffmpegPath = (ffmpegPathModule.default ?? ffmpegPathModule) as string;
  if (!ffmpegPath) throw new Error("ffmpeg-static não retornou um caminho de binário válido.");

  const sources = request.videoSources;
  if (sources.length === 0) throw new Error("Nenhuma cena para renderizar.");

  const narrationPath = deps.path.join(workDir, "narration.mp3");
  await downloadToFile(request.audioUrl, narrationPath, deps);

  let fontPath: string | undefined;
  if (request.branding?.fontUrl) {
    fontPath = deps.path.join(workDir, "brand-font.ttf");
    await downloadToFile(request.branding.fontUrl, fontPath, deps).catch((error) => {
      logger.warn("providers.ffmpeg.font_download_failed", { reason: error instanceof Error ? error.message : String(error) });
      fontPath = undefined;
    });
  }

  let logoPath: string | undefined;
  const includeLogo = Boolean(request.branding?.logoUrl) && request.branding?.includeLogo !== false;
  if (includeLogo && request.branding?.logoUrl) {
    logoPath = deps.path.join(workDir, "logo.png");
    await downloadToFile(request.branding.logoUrl, logoPath, deps).catch((error) => {
      logger.warn("providers.ffmpeg.logo_download_failed", { reason: error instanceof Error ? error.message : String(error) });
      logoPath = undefined;
    });
  }

  const scenePaths: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!;
    const extension = source.assetType === "image" ? guessImageExtension(source.url) : guessVideoExtension(source.url);
    const scenePath = deps.path.join(workDir, `scene-${i}.${extension}`);
    await downloadToFile(source.url, scenePath, deps);
    scenePaths.push(scenePath);
  }

  const totalLength = sources.reduce((sum, source) => sum + source.lengthSeconds, 0);

  const inputArgs: string[] = ["-i", narrationPath];
  const sceneInputIndex: number[] = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!;
    if (source.assetType === "image") {
      inputArgs.push("-loop", "1", "-t", source.lengthSeconds.toFixed(3), "-i", scenePaths[i]!);
    } else {
      inputArgs.push("-i", scenePaths[i]!);
    }
    sceneInputIndex.push(1 + i);
  }

  let logoInputIndex: number | undefined;
  if (logoPath) {
    logoInputIndex = 1 + sources.length;
    inputArgs.push("-i", logoPath);
  }

  const filterParts: string[] = [];

  sources.forEach((source, i) => {
    const idx = sceneInputIndex[i]!;
    const label = `v${i}`;
    if (source.assetType === "image") {
      const frames = Math.max(1, Math.round(source.lengthSeconds * FPS));
      filterParts.push(
        `[${idx}:v]scale=${FRAME_WIDTH * 2}:${FRAME_HEIGHT * 2},` +
          `zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${FRAME_WIDTH}x${FRAME_HEIGHT}:fps=${FPS},` +
          `format=yuv420p,setsar=1[${label}]`,
      );
    } else {
      const trim = source.trimSeconds ?? 0;
      filterParts.push(
        `[${idx}:v]trim=start=${trim.toFixed(3)}:duration=${source.lengthSeconds.toFixed(3)},setpts=PTS-STARTPTS,` +
          `scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:force_original_aspect_ratio=increase,crop=${FRAME_WIDTH}:${FRAME_HEIGHT},` +
          `fps=${FPS},format=yuv420p,setsar=1[${label}]`,
      );
    }
  });

  const concatInputs = sources.map((_, i) => `[v${i}]`).join("");
  filterParts.push(`${concatInputs}concat=n=${sources.length}:v=1:a=0[vconcat]`);

  let currentLabel = "vconcat";
  const coverTitle = request.coverTitle?.trim();
  if (coverTitle) {
    const nextLabel = "vtitle";
    filterParts.push(
      `[${currentLabel}]${buildDrawtext({
        text: coverTitle,
        fontPath,
        fontSize: 52,
        fontColor: "white",
        x: "(w-text_w)/2",
        y: "(h-text_h)/2",
        boxColor: "black",
        boxOpacity: 0.45,
        enableExpr: `between(t\\,0\\,${Math.min(COVER_TITLE_DISPLAY_SECONDS, totalLength)})`,
      })}[${nextLabel}]`,
    );
    currentLabel = nextLabel;
  }

  const labeled = sources.filter((source) => source.onScreenLabel?.trim());
  labeled.forEach((source, i) => {
    const nextLabel = `vlabel${i}`;
    filterParts.push(
      `[${currentLabel}]${buildDrawtext({
        text: source.onScreenLabel!.trim(),
        fontPath,
        fontSize: 30,
        fontColor: "white",
        x: "(w-text_w)/2",
        y: `h-${Math.round(FRAME_HEIGHT * 0.16) + 60}`,
        boxColor: "black",
        boxOpacity: 0.55,
        enableExpr: `between(t\\,${source.startSeconds.toFixed(3)}\\,${(source.startSeconds + source.lengthSeconds).toFixed(3)})`,
      })}[${nextLabel}]`,
    );
    currentLabel = nextLabel;
  });

  if (logoInputIndex !== undefined) {
    const nextLabel = "vlogo";
    const margin = 24;
    filterParts.push(
      `[${logoInputIndex}:v]scale=${Math.round(FRAME_WIDTH * (request.branding?.logoScale ?? 0.12))}:-1[logoScaled]`,
    );
    filterParts.push(`[${currentLabel}][logoScaled]overlay=W-w-${margin}:H-h-${margin}[${nextLabel}]`);
    currentLabel = nextLabel;
  }

  const watermarkText = request.branding?.watermarkText?.trim();
  if (watermarkText) {
    const nextLabel = "vwatermark";
    filterParts.push(
      `[${currentLabel}]${buildDrawtext({
        text: watermarkText,
        fontPath,
        fontSize: 22,
        fontColor: "white@0.55",
        x: "24",
        y: "h-48",
      })}[${nextLabel}]`,
    );
    currentLabel = nextLabel;
  }

  const fadeStart = Math.max(0, totalLength - 1);
  const canUseSegmentedAudio = sources.every(
    (source) => source.segmentIndex !== undefined && source.audioStartSeconds !== undefined && source.audioEndSeconds !== undefined,
  );

  if (canUseSegmentedAudio) {
    // ★ Achado real (pedido direto do usuário — "a narração quero a opção de
    // editar que nem no capcut, cortar, remanejar mais pra frente pra
    // estender o vídeo"): antes, a narração inteira era 1 trilha só,
    // implicitamente alinhada à ordem original das cenas — reordenar/excluir
    // cena (recurso já existente) desalinhava a fala do vídeo sem avisar.
    // Cada sequência CONTÍGUA de cenas do mesmo trecho (`segmentIndex`) vira
    // 1 clipe de áudio próprio: recortado da narração original
    // (`audioStartSeconds`/`audioEndSeconds`, fixos, nunca mudam) e
    // posicionado (`adelay`) onde aquele trecho está HOJE no vídeo
    // (`startSeconds`, recomputado após qualquer edição —
    // video-pipeline-scene-edit.ts). Reordenar cenas move o clipe de áudio
    // junto; excluir todas as cenas de um trecho remove o clipe (nunca
    // aparece no `filter_complex`). Nunca estica/acelera a fala: se sobrar
    // tempo de tela (trecho alongado), toca só o áudio real e o resto fica
    // em silêncio; se faltar tempo de tela (trecho encurtado), corta a
    // sobra do fim da fala — nunca distorce velocidade.
    const runs: { videoStart: number; videoDuration: number; audioStart: number; audioAvailable: number }[] = [];
    let cursor = 0;
    while (cursor < sources.length) {
      const segmentIndex = sources[cursor]!.segmentIndex;
      let end = cursor + 1;
      while (end < sources.length && sources[end]!.segmentIndex === segmentIndex) end++;
      const run = sources.slice(cursor, end);
      const videoStart = run[0]!.startSeconds;
      const videoDuration = run.reduce((sum, source) => sum + source.lengthSeconds, 0);
      const audioStart = run[0]!.audioStartSeconds!;
      const audioAvailable = run[0]!.audioEndSeconds! - audioStart;
      runs.push({ videoStart, videoDuration, audioStart, audioAvailable });
      cursor = end;
    }

    const delayedLabels: string[] = [];
    runs.forEach((run, i) => {
      const clipDuration = Math.min(run.videoDuration, run.audioAvailable);
      if (clipDuration <= 0) return;
      const trimmedLabel = `atrim${i}`;
      const delayedLabel = `adelay${i}`;
      filterParts.push(
        `[0:a]atrim=start=${run.audioStart.toFixed(3)}:end=${(run.audioStart + clipDuration).toFixed(3)},asetpts=PTS-STARTPTS[${trimmedLabel}]`,
      );
      const delayMs = Math.max(0, Math.round(run.videoStart * 1000));
      filterParts.push(`[${trimmedLabel}]adelay=${delayMs}|${delayMs}[${delayedLabel}]`);
      delayedLabels.push(delayedLabel);
    });

    if (delayedLabels.length > 0) {
      filterParts.push(
        `${delayedLabels.map((label) => `[${label}]`).join("")}amix=inputs=${delayedLabels.length}:duration=longest:normalize=0,` +
          `afade=t=out:st=${fadeStart.toFixed(3)}:d=1[aout]`,
      );
    } else {
      filterParts.push(`aevalsrc=0:duration=${totalLength.toFixed(3)}[aout]`);
    }
  } else {
    filterParts.push(`[0:a]atrim=0:${totalLength.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=out:st=${fadeStart.toFixed(3)}:d=1[aout]`);
  }

  const filterComplex = filterParts.join(";");

  const args = [
    "-y",
    ...inputArgs,
    "-filter_complex",
    filterComplex,
    "-map",
    `[${currentLabel}]`,
    "-map",
    "[aout]",
    "-r",
    String(FPS),
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "26",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  logger.info("providers.ffmpeg.compose_video_started", { scenes: sources.length, totalLength });
  try {
    await deps.execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 64 });
  } catch (error) {
    const stderr = (error as { stderr?: string })?.stderr;
    throw new Error(`ffmpeg falhou ao compor o vídeo: ${stderr ?? (error instanceof Error ? error.message : String(error))}`);
  }
}

function guessVideoExtension(url: string): string {
  const match = /\.(mp4|mov|webm)(\?|$)/i.exec(url);
  return match?.[1]?.toLowerCase() ?? "mp4";
}

function guessImageExtension(url: string): string {
  const match = /\.(jpg|jpeg|png|webp)(\?|$)/i.exec(url);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

const IMAGE_PANEL_HEIGHT_RATIO = 0.42;
const IMAGE_PANEL_HORIZONTAL_PADDING = 60;
const IMAGE_CTA_BLOCK_HEIGHT = 100;
const IMAGE_CTA_BOTTOM_PADDING = 60;
const IMAGE_SUBHEADLINE_GAP_ABOVE_CTA = 28;
const IMAGE_HEADLINE_GAP_ABOVE_SUBHEADLINE = 14;

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = Number.parseInt(normalized, 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastTextColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? "#111111" : "#ffffff";
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * ★ Mesmo espírito de `renderPanel`/`renderScrim` (shotstack-video-render-provider.ts,
 * já usa `sharp` pra gerar PNGs de painel/scrim) — aqui a composição INTEIRA
 * (fundo + painel + headline + subheadline + CTA + logo) é feita em `sharp`,
 * um SVG por bloco de texto sobreposto via `composite`, em vez de submeter
 * um timeline JSON pro Shotstack. Layout (offsets, alturas de bloco) é o
 * mesmo já validado em `buildImageTimeline` — só o motor de composição muda.
 */
async function renderImageWithSharp(request: ImageCompositionRequest): Promise<Buffer> {
  const sharpModule = await import(/* webpackIgnore: true */ "sharp");
  const sharp = sharpModule.default;

  const branding = request.branding;
  const primaryColor = branding?.primaryColorHex ?? "#ffffff";
  const secondaryColor = branding?.secondaryColorHex ?? "#000000";
  const panelTextColor = contrastTextColor(secondaryColor);
  const pillColor =
    contrastRatio(primaryColor, secondaryColor) >= 1.8 ? primaryColor : panelTextColor === "#ffffff" ? "#111111" : "#ffffff";
  const pillTextColor = contrastTextColor(pillColor);
  const fontScale = request.fontScale && request.fontScale > 0 ? request.fontScale : 1;

  const response = await fetchWithRetry(request.backgroundImageUrl);
  if (!response.ok) throw new Error(`Download da imagem de fundo falhou (${response.status}).`);
  const backgroundBuffer = Buffer.from(await response.arrayBuffer());

  const background = sharp(backgroundBuffer).resize(request.width, request.height, { fit: "cover" });

  const composites: Array<{ input: Buffer; top: number; left: number }> = [];
  const panelHeight = Math.round(request.height * IMAGE_PANEL_HEIGHT_RATIO);

  if (!request.backgroundIncludesDesignedPanel) {
    const radius = 32;
    const fadeHeight = Math.min(140, Math.round(panelHeight * 0.18));
    const fadeStopPercent = (fadeHeight / panelHeight) * 100;
    const panelSvg =
      `<svg width="${request.width}" height="${panelHeight}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="panelFade" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${secondaryColor}" stop-opacity="0"/>` +
      `<stop offset="${fadeStopPercent}%" stop-color="${secondaryColor}" stop-opacity="1"/>` +
      `<stop offset="100%" stop-color="${secondaryColor}" stop-opacity="1"/>` +
      `</linearGradient></defs>` +
      `<path d="M0,${radius} Q0,0 ${radius},0 L${request.width - radius},0 Q${request.width},0 ${request.width},${radius} ` +
      `L${request.width},${panelHeight} L0,${panelHeight} Z" fill="url(#panelFade)"/>` +
      `</svg>`;
    composites.push({ input: Buffer.from(panelSvg), top: request.height - panelHeight, left: 0 });
  }

  const hasVisiblePanel = !request.backgroundIncludesDesignedPanel || Boolean(request.backgroundIncludesDesignedPanel);
  const textBlockWidth = request.width - IMAGE_PANEL_HORIZONTAL_PADDING * 2;

  const ctaText = request.ctaText?.trim();
  const ctaBottom = IMAGE_CTA_BOTTOM_PADDING;
  if (ctaText) {
    const ctaWidth = Math.min(760, textBlockWidth);
    const ctaSvg =
      `<svg width="${ctaWidth}" height="${IMAGE_CTA_BLOCK_HEIGHT}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect x="0" y="0" width="${ctaWidth}" height="${IMAGE_CTA_BLOCK_HEIGHT}" rx="28" ry="28" fill="${pillColor}"/>` +
      `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="${pillTextColor}" ` +
      `font-size="${Math.round(26 * fontScale)}" font-weight="700" font-family="sans-serif">${escapeXml(ctaText)}</text>` +
      `</svg>`;
    composites.push({
      input: Buffer.from(ctaSvg),
      left: Math.round((request.width - ctaWidth) / 2),
      top: request.height - ctaBottom - IMAGE_CTA_BLOCK_HEIGHT,
    });
  }

  const subheadlineText = request.subheadline?.trim();
  const subheadlineHeight = 130;
  const subheadlineBottom = ctaBottom + (ctaText ? IMAGE_CTA_BLOCK_HEIGHT : 0) + IMAGE_SUBHEADLINE_GAP_ABOVE_CTA;
  if (subheadlineText) {
    const subheadlineSvg =
      `<svg width="${textBlockWidth}" height="${subheadlineHeight}" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="50%" y="0" text-anchor="middle" dominant-baseline="hanging" fill="${panelTextColor}" ` +
      `font-size="${Math.round(28 * fontScale)}" font-weight="400" font-family="sans-serif">${escapeXml(subheadlineText)}</text>` +
      `</svg>`;
    composites.push({
      input: Buffer.from(subheadlineSvg),
      left: IMAGE_PANEL_HORIZONTAL_PADDING,
      top: request.height - subheadlineBottom - subheadlineHeight,
    });
  }

  const headlineText = request.title?.trim();
  const headlineHeight = 190;
  const headlineBottom = subheadlineBottom + (subheadlineText ? subheadlineHeight : 0) + IMAGE_HEADLINE_GAP_ABOVE_SUBHEADLINE;
  if (headlineText) {
    const headlineSvg =
      `<svg width="${textBlockWidth}" height="${headlineHeight}" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="${panelTextColor}" ` +
      `font-size="${Math.round(48 * fontScale)}" font-weight="800" font-family="sans-serif">${escapeXml(headlineText)}</text>` +
      `</svg>`;
    composites.push({
      input: Buffer.from(headlineSvg),
      left: IMAGE_PANEL_HORIZONTAL_PADDING,
      top: request.height - headlineBottom - headlineHeight,
    });
  }

  if (branding?.logoUrl && branding.includeLogo !== false) {
    try {
      const logoResponse = await fetchWithRetry(branding.logoUrl);
      if (logoResponse.ok) {
        const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
        const logoWidth = Math.round(request.width * (branding.logoScale ?? 0.12));
        const resizedLogo = await sharp(logoBuffer).resize(logoWidth, logoWidth, { fit: "inside" }).toBuffer();
        const margin = Math.round(request.width * 0.04);
        composites.push({ input: resizedLogo, left: request.width - logoWidth - margin, top: margin });
      }
    } catch (error) {
      logger.warn("providers.ffmpeg.logo_composite_failed", { reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return background.composite(composites).jpeg({ quality: 90 }).toBuffer();
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA) + 0.05;
  const lB = relativeLuminance(hexB) + 0.05;
  return lA > lB ? lA / lB : lB / lA;
}
