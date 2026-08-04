/**
 * Contrato de capacidade `voice` (architecture.md §5) — nenhum Core Engine
 * conhece o fornecedor concreto por trás desta interface, apenas a
 * capacidade. Ver elevenlabs-voice-provider.ts para a implementação inicial
 * (Missão 9, Etapa 1).
 *
 * O contrato devolve o áudio em base64 (não uma URL) — persistir no bucket
 * `content-output` e gerar a URL final é responsabilidade de quem monta o
 * pipeline (Asset Engine), nunca do adapter em si.
 */
export interface CaptionCue {
  text: string;
  startMs: number;
  endMs: number;
}

export interface VoiceSynthesisRequest {
  script: string;
  /** `brand_brain_profiles.default_voice_ref`, quando definido pela marca. */
  voiceRef?: string | null;
}

export interface VoiceSynthesisResult {
  audioBase64: string;
  durationMs: number;
  captionCues: CaptionCue[];
  providerKey: string;
}

export interface VoiceProvider {
  synthesizeVoice(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult>;
}
