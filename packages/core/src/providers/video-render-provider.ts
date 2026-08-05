/**
 * Contrato de capacidade `video_render` (architecture.md §5, ★ novo Missão
 * 9, revisado na Missão 11 arch. §14.2/§14.4/§14.6/§14.8) — nunca conhece
 * fornecedor de mídia/avatar/voz, só recebe as fontes já resolvidas pelo
 * Asset Engine (áudio de narração + cenas, ou foto + título) e devolve o
 * arquivo final. Ver shotstack-video-render-provider.ts para a
 * implementação (Missão 9, Etapa 1 + Missão 11).
 *
 * ★ Missão 11 — `VideoRenderCaptionCue`/`captionCues` removidos: o vídeo
 * não leva mais legenda embutida (arch. §14.2).
 */
export interface VideoRenderSceneSource {
  /** URL pública/assinada do clipe (Media Provider) — nunca base64. */
  url: string;
  startSeconds: number;
  lengthSeconds: number;
}

/**
 * Identidade visual da marca (arch. §14.1), repassada pelo Asset Engine —
 * nunca lida diretamente de `brands` por este provider (desacoplamento de
 * sempre, §5.1). Todos os campos opcionais: sem logo cadastrado, o
 * comportamento é adaptativo (arch. §14.8), nunca um espaço vazio.
 */
export interface VideoBranding {
  logoUrl?: string | null;
  primaryColorHex?: string | null;
  secondaryColorHex?: string | null;
  /** URL pública de um arquivo TTF pré-hospedado (Shotstack não usa @font-face/webfont — arch. §14.1). */
  fontUrl?: string | null;
}

export interface VideoRenderRequest {
  /** URL pública/assinada do áudio de narração já persistido em Storage. */
  audioUrl: string;
  videoSources: VideoRenderSceneSource[];
  aspectRatio: "9:16";
  branding?: VideoBranding;
}

export interface VideoRenderResult {
  videoUrl: string;
  providerKey: string;
}

/** ★ novo (Missão 11, arch. §14.4.1) — composição de imagem estática (stories/carousel/thumbnail), mesmo fornecedor do vídeo, timeline em camadas em vez de asset `html`. */
export interface ImageCompositionRequest {
  /** URL do banco de fotos (Pexels) usada como fundo. */
  backgroundImageUrl: string;
  /** Título curto — quando ausente, a peça não leva texto sobreposto. */
  title?: string | null;
  branding?: VideoBranding;
  width: number;
  height: number;
}

export interface ImageCompositionResult {
  imageUrl: string;
  providerKey: string;
}

export interface VideoRenderProvider {
  composeVideo(request: VideoRenderRequest): Promise<VideoRenderResult>;
  composeImage(request: ImageCompositionRequest): Promise<ImageCompositionResult>;
}
