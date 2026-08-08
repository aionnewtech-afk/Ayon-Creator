import sharp from "sharp";

/** Grande o bastante pra preservar blocos de cor sólida do desenho original; `kernel: "nearest"` (abaixo) evita que o downscale misture cor de fundo com cor de primeiro plano nas bordas (achado real: lanczos3 padrão lavava toda a paleta pra tons pasteis). */
const THUMBNAIL_SIZE = 150;
/** Distância euclidiana em RGB (0–441) acima da qual uma cor cadastrada é considerada "não encontrada" na logo — calibrado com casos reais (cores de família totalmente diferente ficam ~100+, tons próximos da mesma cor ficam <30). */
const COLOR_DISTANCE_THRESHOLD = 100;
/** Pixels de fundo (branco/cinza-claro/transparente) descartados antes de contar cores dominantes — sem isso, a cor de fundo do arquivo sempre "vence" por área. */
const BACKGROUND_LIGHTNESS_MIN = 230;
const BACKGROUND_SATURATION_MAX = 12;
const MIN_ALPHA = 200;
/** Abaixo disso, a amostra é pequena demais pra confiar no resultado (ex.: logo quase monocromática ou decodificação ruim) — nesse caso não afirmamos nada. */
const MIN_FOREGROUND_SAMPLES = 30;

export interface BrandColorMismatchResult {
  /** `false` quando não foi possível analisar a logo (amostra insuficiente) — nunca um "não diverge" falso. */
  analyzed: boolean;
  dominantColorsHex: string[];
  mismatches: { field: "primary" | "secondary"; colorHex: string }[];
}

interface RgbBucket {
  count: number;
  rSum: number;
  gSum: number;
  bSum: number;
}

/**
 * ★ Sprint de estabilização (Missão 12) — só detecta divergência entre as
 * cores cadastradas (`brands.primary_color_hex`/`secondary_color_hex`) e as
 * cores predominantes reais da logo enviada, para alertar o usuário. Nunca
 * extrai/sugere/aplica cores automaticamente (decisão explícita do produto)
 * — o usuário decide o que fazer com o alerta.
 */
export async function detectBrandColorMismatch(
  logoBuffer: Buffer,
  configuredColors: { field: "primary" | "secondary"; colorHex: string | null }[],
): Promise<BrandColorMismatchResult> {
  const toCheck = configuredColors.filter(
    (c): c is { field: "primary" | "secondary"; colorHex: string } => Boolean(c.colorHex),
  );
  if (toCheck.length === 0) return { analyzed: false, dominantColorsHex: [], mismatches: [] };

  const { data, info } = await sharp(logoBuffer)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "inside", kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<string, RgbBucket>();
  const channels = info.channels; // 4 (RGBA) após ensureAlpha()

  for (let i = 0; i + channels <= data.length; i += channels) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;

    if (a < MIN_ALPHA) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const isBackgroundish = max >= BACKGROUND_LIGHTNESS_MIN && max - min <= BACKGROUND_SATURATION_MAX;
    if (isBackgroundish) continue;

    const bucketKey = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
    const bucket = buckets.get(bucketKey);
    if (bucket) {
      bucket.count += 1;
      bucket.rSum += r;
      bucket.gSum += g;
      bucket.bSum += b;
    } else {
      buckets.set(bucketKey, { count: 1, rSum: r, gSum: g, bSum: b });
    }
  }

  const totalForegroundSamples = Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.count, 0);
  if (totalForegroundSamples < MIN_FOREGROUND_SAMPLES) {
    return { analyzed: false, dominantColorsHex: [], mismatches: [] };
  }

  const dominantColors = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((bucket) => ({
      r: bucket.rSum / bucket.count,
      g: bucket.gSum / bucket.count,
      b: bucket.bSum / bucket.count,
    }));

  const mismatches: BrandColorMismatchResult["mismatches"] = [];
  for (const { field, colorHex } of toCheck) {
    const rgb = hexToRgb(colorHex);
    if (!rgb) continue;

    const minDistance = Math.min(...dominantColors.map((c) => rgbDistance(rgb, c)));
    if (minDistance > COLOR_DISTANCE_THRESHOLD) {
      mismatches.push({ field, colorHex });
    }
  }

  return {
    analyzed: true,
    dominantColorsHex: dominantColors.map((c) => rgbToHex(c.r, c.g, c.b)),
    mismatches,
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const value = match[1]!;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}
