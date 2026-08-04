import type { CaptionCue, VoiceProvider, VoiceSynthesisRequest, VoiceSynthesisResult } from "./voice-provider";

/**
 * Adapter concreto do Voice Provider (architecture.md §5, §3.5.1) para o
 * ElevenLabs — Missão 9, Etapa 1. Único arquivo do monorepo que importa a
 * API do ElevenLabs; trocar de fornecedor nunca exige mudar quem chama
 * `VoiceProvider`, só o resultado da resolução em provider-gateway.ts.
 *
 * Usa o endpoint `/with-timestamps`, não o endpoint simples de
 * text-to-speech — a marcação de tempo por caractere que ele devolve é o
 * mecanismo de legenda já resolvido em architecture.md §3.5.1 (revisão 26):
 * nenhuma capacidade de transcrição separada é necessária.
 */
export class ElevenLabsVoiceProvider implements VoiceProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
  ) {}

  async synthesizeVoice(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    const voiceId = request.voiceRef ?? DEFAULT_VOICE_ID;

    const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}/with-timestamps`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: request.script,
        model_id: DEFAULT_MODEL_ID,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`ElevenLabs synthesizeVoice falhou (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as ElevenLabsTimestampResponse;
    const { alignment } = payload;

    const lastEndSeconds = alignment.character_end_times_seconds.at(-1) ?? 0;
    const durationMs = Math.round(lastEndSeconds * 1000);

    return {
      audioBase64: payload.audio_base64,
      durationMs,
      captionCues: buildCaptionCues(alignment),
      providerKey: this.providerKey,
    };
  }
}

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
/** Voz pré-fabricada "Rachel" — usada quando a marca ainda não definiu `default_voice_ref`. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
/** Tamanho aproximado (chars) de cada cue de legenda — nunca 1 cue por palavra/caractere. */
const MAX_CUE_CHARACTERS = 40;

interface ElevenLabsTimestampResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

/**
 * Agrupa a marcação de tempo por caractere em cues de legenda legíveis
 * (architecture.md §3.5.1) — quebra um novo cue no primeiro espaço depois de
 * `MAX_CUE_CHARACTERS`, para nunca cortar uma palavra no meio.
 */
function buildCaptionCues(alignment: ElevenLabsTimestampResponse["alignment"]): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let currentText = "";
  let cueStartSeconds: number | null = null;
  let cueEndSeconds = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const startSeconds = alignment.character_start_times_seconds[i];
    const endSeconds = alignment.character_end_times_seconds[i];
    if (char === undefined || startSeconds === undefined || endSeconds === undefined) continue;

    if (cueStartSeconds === null) cueStartSeconds = startSeconds;
    currentText += char;
    cueEndSeconds = endSeconds;

    const isLastCharacter = i === alignment.characters.length - 1;
    const atWordBoundary = char === " " || isLastCharacter;

    if (atWordBoundary && currentText.trim().length >= MAX_CUE_CHARACTERS) {
      cues.push({
        text: currentText.trim(),
        startMs: Math.round(cueStartSeconds * 1000),
        endMs: Math.round(cueEndSeconds * 1000),
      });
      currentText = "";
      cueStartSeconds = null;
    }
  }

  if (currentText.trim().length > 0 && cueStartSeconds !== null) {
    cues.push({
      text: currentText.trim(),
      startMs: Math.round(cueStartSeconds * 1000),
      endMs: Math.round(cueEndSeconds * 1000),
    });
  }

  return cues;
}
