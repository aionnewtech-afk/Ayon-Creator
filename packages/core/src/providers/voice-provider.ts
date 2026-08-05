/**
 * Contrato de capacidade `voice` (architecture.md §5) — nenhum Core Engine
 * conhece o fornecedor concreto por trás desta interface, apenas a
 * capacidade. Ver elevenlabs-voice-provider.ts para a implementação inicial
 * (Missão 9, Etapa 1) e a revisão da Missão 11 (arch. §14.3).
 *
 * O contrato devolve o áudio em base64 (não uma URL) — persistir no bucket
 * `content-output` e gerar a URL final é responsabilidade de quem monta o
 * pipeline (Asset Engine), nunca do adapter em si.
 *
 * ★ Missão 11 (arch. §14.2) — `CaptionCue`/`captionCues` removidos do
 * contrato: o vídeo não leva mais legenda embutida (decisão do dono do
 * produto), então a marcação de tempo por caractere que só existia para
 * montar legenda deixou de ter consumidor.
 */
export interface VoiceSettings {
  /** 0-1, quanto maior mais estável/consistente e menos expressiva. */
  stability?: number;
  /** 0-1, o quanto a síntese se apega à voz original de referência. */
  similarityBoost?: number;
  /** 0-1, exagero de estilo/expressividade — 0 é mais neutro/rápido. */
  style?: number;
  useSpeakerBoost?: boolean;
  /** 0.7-1.2 tipicamente — velocidade da fala, 1 é a padrão do fornecedor. */
  speed?: number;
}

export interface VoiceSynthesisRequest {
  script: string;
  /** `brand_brain_profiles.default_voice_ref`, resolvido automaticamente por marca (arch. §14.3) ou sobrescrito manualmente. */
  voiceRef?: string | null;
  voiceSettings?: VoiceSettings;
}

export interface VoiceSynthesisResult {
  audioBase64: string;
  durationMs: number;
  providerKey: string;
}

export interface VoiceProvider {
  synthesizeVoice(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult>;
}
