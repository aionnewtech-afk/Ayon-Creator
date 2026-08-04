/**
 * Contrato de capacidade `video_render` (architecture.md §5, ★ novo Missão
 * 9) — nunca conhece fornecedor de mídia/avatar/voz, só recebe as fontes já
 * resolvidas pelo Asset Engine (áudio de narração + cenas + cues de legenda)
 * e devolve o MP4 final. Ver shotstack-video-render-provider.ts para a
 * implementação inicial (Missão 9, Etapa 1).
 */
export interface VideoRenderSceneSource {
  /** URL pública/assinada do clipe (Media Provider) — nunca base64. */
  url: string;
  startSeconds: number;
  lengthSeconds: number;
}

export interface VideoRenderCaptionCue {
  text: string;
  startSeconds: number;
  lengthSeconds: number;
}

export interface VideoRenderRequest {
  /** URL pública/assinada do áudio de narração já persistido em Storage. */
  audioUrl: string;
  videoSources: VideoRenderSceneSource[];
  captionCues: VideoRenderCaptionCue[];
  aspectRatio: "9:16";
}

export interface VideoRenderResult {
  videoUrl: string;
  providerKey: string;
}

export interface VideoRenderProvider {
  composeVideo(request: VideoRenderRequest): Promise<VideoRenderResult>;
}
