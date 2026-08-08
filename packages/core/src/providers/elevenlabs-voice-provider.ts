import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { VoiceProvider, VoiceSettings, VoiceSynthesisRequest, VoiceSynthesisResult } from "./voice-provider";
import { logProviderCall } from "./log-provider-call";
import { fetchWithRetry } from "../shared/fetch-with-retry";

/**
 * Adapter concreto do Voice Provider (architecture.md §5, §3.5.1) para o
 * ElevenLabs — Missão 9, Etapa 1, revisado na Missão 11 (arch. §14.2/§14.3).
 * Único arquivo do monorepo que importa a API do ElevenLabs; trocar de
 * fornecedor nunca exige mudar quem chama `VoiceProvider`, só o resultado da
 * resolução em provider-gateway.ts.
 *
 * ★ Missão 11 — continua usando o endpoint `/with-timestamps` (não o
 * text-to-speech simples), mas só pela duração total exata que ele devolve
 * (`character_end_times_seconds.at(-1)`) — a marcação por caractere em si é
 * descartada, porque a legenda que a consumia foi removida (arch. §14.2). É
 * a forma mais simples de continuar tendo uma duração confiável sem somar
 * uma dependência nova de parsing de áudio só para trocar de endpoint.
 */
export class ElevenLabsVoiceProvider implements VoiceProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
    /** ★ Missão 12 (architecture.md §15.7) — mesmo client de service role já usado para resolver este adapter; instrumentação real via `logProviderCall`, nunca bloqueia a chamada real se falhar. */
    private readonly serviceRoleDb?: SupabaseClient<Database>,
  ) {}

  async synthesizeVoice(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    const voiceId = request.voiceRef ?? DEFAULT_VOICE_ID;
    const endpoint = `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}/with-timestamps`;
    const startedAt = new Date();
    let errorMessage: string | undefined;

    try {
      const response = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: request.script,
          model_id: DEFAULT_MODEL_ID,
          voice_settings: toElevenLabsVoiceSettings(request.voiceSettings),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        errorMessage = `ElevenLabs synthesizeVoice falhou (${response.status}): ${errorBody}`;
        throw new Error(errorMessage);
      }

      const payload = (await response.json()) as ElevenLabsTimestampResponse;
      const lastEndSeconds = payload.alignment.character_end_times_seconds.at(-1) ?? 0;

      return {
        audioBase64: payload.audio_base64,
        durationMs: Math.round(lastEndSeconds * 1000),
        providerKey: this.providerKey,
      };
    } catch (error) {
      errorMessage ??= error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await this.logCall({ endpoint, startedAt, ok: !errorMessage, errorMessage });
    }
  }

  private async logCall(params: { endpoint: string; startedAt: Date; ok: boolean; errorMessage?: string }): Promise<void> {
    if (!this.serviceRoleDb) return;
    await logProviderCall({
      serviceRoleDb: this.serviceRoleDb,
      providerKey: this.providerKey,
      capability: "voice",
      model: DEFAULT_MODEL_ID,
      endpoint: params.endpoint,
      startedAt: params.startedAt,
      finishedAt: new Date(),
      ok: params.ok,
      errorMessage: params.errorMessage,
    });
  }
}

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
/** Voz pré-fabricada "Rachel" — usada só se a resolução de voz da marca (arch. §14.3) falhar por algum motivo; nunca o caminho esperado em produção. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/** Defaults do próprio ElevenLabs quando a marca não tem `voiceSettings` explícito — nunca omitir o campo, o fornecedor exige a estrutura completa. */
const DEFAULT_VOICE_SETTINGS: Required<VoiceSettings> = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: 1,
};

function toElevenLabsVoiceSettings(settings: VoiceSettings | undefined) {
  const resolved = { ...DEFAULT_VOICE_SETTINGS, ...settings };
  return {
    stability: resolved.stability,
    similarity_boost: resolved.similarityBoost,
    style: resolved.style,
    use_speaker_boost: resolved.useSpeakerBoost,
    speed: resolved.speed,
  };
}

interface ElevenLabsTimestampResponse {
  audio_base64: string;
  alignment: {
    character_end_times_seconds: number[];
  };
}
