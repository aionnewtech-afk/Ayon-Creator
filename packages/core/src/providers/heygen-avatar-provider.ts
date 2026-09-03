import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { AvatarGroupLook, AvatarProvider, AvatarVoice, CreateAssetUploadSlotResult, CreateDigitalTwinResult } from "./avatar-provider";
import { logProviderCall } from "./log-provider-call";
import { fetchWithRetry } from "../shared/fetch-with-retry";

const HEYGEN_API_BASE = "https://api.heygen.com";

/**
 * Adapter concreto do Avatar Provider (architecture.md §5) para a HeyGen —
 * único arquivo do monorepo que importa a API deles. Endpoints e formatos
 * abaixo validados contra a documentação atual da HeyGen antes de escrever
 * qualquer linha (nunca um endpoint chutado de memória — mesmo critério de
 * todo adapter deste projeto): `POST /v3/assets/direct-uploads` (slot de
 * upload S3 pré-assinado pro vídeo de treinamento — achado real, `POST
 * /v3/avatars` com `file.type = "url"` tem teto de 32MB pra download,
 * inviável pra vídeo de treinamento real), `POST /v3/assets/{id}/complete`
 * (finaliza o upload), `POST /v3/avatars` (criar "digital twin" a partir do
 * asset), `POST /v3/avatars/{group_id}/consent` (link de consentimento),
 * `GET /v3/avatars/{group_id}` (status do consentimento),
 * `GET /v3/avatars/looks/{look_id}` (status do treinamento),
 * `GET /v3/voices`, `POST /v3/videos` (gerar vídeo do avatar),
 * `GET /v3/videos/{video_id}` (status/URL final).
 */
export class HeyGenAvatarProvider implements AvatarProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
    private readonly serviceRoleDb?: SupabaseClient<Database>,
    private readonly organizationId?: string,
  ) {}

  async createAssetUploadSlot(params: { filename: string; contentType: string; sizeBytes: number }): Promise<CreateAssetUploadSlotResult> {
    const payload = (await this.request("POST", "/v3/assets/direct-uploads", {
      filename: params.filename,
      content_type: params.contentType,
      size_bytes: params.sizeBytes,
    })) as {
      data: { asset_id: string; upload_url: string; upload_headers: Record<string, string> };
    };

    return {
      assetId: payload.data.asset_id,
      uploadUrl: payload.data.upload_url,
      uploadHeaders: payload.data.upload_headers,
    };
  }

  async completeAssetUpload(assetId: string): Promise<void> {
    await this.request("POST", `/v3/assets/${assetId}/complete`, {});
  }

  async createDigitalTwin(params: { name: string; assetId: string; groupId?: string }): Promise<CreateDigitalTwinResult> {
    const payload = (await this.request("POST", "/v3/avatars", {
      type: "digital_twin",
      name: params.name,
      file: { type: "asset_id", asset_id: params.assetId },
      ...(params.groupId ? { avatar_group_id: params.groupId } : {}),
    })) as {
      data: {
        avatar_item: { id: string; status: string; default_voice_id?: string | null };
        avatar_group: { id: string; consent_status: string };
      };
    };

    return {
      lookId: payload.data.avatar_item.id,
      groupId: payload.data.avatar_group.id,
      defaultVoiceId: payload.data.avatar_item.default_voice_id ?? null,
      consentStatus: payload.data.avatar_group.consent_status,
    };
  }

  async requestConsent(groupId: string): Promise<{ consentUrl: string }> {
    const payload = (await this.request("POST", `/v3/avatars/${groupId}/consent`, {})) as { data: { url: string } };
    return { consentUrl: payload.data.url };
  }

  async getConsentStatus(groupId: string): Promise<{ consentStatus: string }> {
    const payload = (await this.request("GET", `/v3/avatars/${groupId}`)) as { data: { consent_status: string } };
    return { consentStatus: payload.data.consent_status };
  }

  async getTrainingStatus(lookId: string): Promise<{ status: string; defaultVoiceId?: string | null }> {
    const payload = (await this.request("GET", `/v3/avatars/looks/${lookId}`)) as {
      data: { status: string; default_voice_id?: string | null };
    };
    return { status: payload.data.status, defaultVoiceId: payload.data.default_voice_id ?? null };
  }

  async listVoices(): Promise<AvatarVoice[]> {
    // ★ Achado real (validação direta na API — a doc pública descreve
    // `data.voices`, a resposta real é `data` como array direto): sempre
    // confirmado contra uma chamada real antes de assumir o formato.
    const payload = (await this.request("GET", "/v3/voices")) as {
      data: { voice_id: string; name: string; gender?: string; language?: string }[];
    };
    return payload.data.map((v) => ({ voiceId: v.voice_id, name: v.name.trim(), gender: v.gender, language: v.language }));
  }

  async generateAvatarVideo(params: {
    avatarId: string;
    script?: string;
    voiceId?: string;
    voiceLocale?: string;
    audioUrl?: string;
    aspectRatio?: string;
    background?: { type: "color"; value: string } | { type: "image"; url: string };
  }): Promise<{ videoId: string }> {
    const payload = (await this.request("POST", "/v3/videos", {
      type: "avatar",
      avatar_id: params.avatarId,
      // ★ Achado real (pedido direto do usuário — "a voz clonada do HeyGen
      // não é parecida... inclua minha voz do ElevenLabs"): `audio_url` é
      // mutuamente exclusivo com `script`/`voice_id`/`voice_settings`
      // (documentado — "Mutually exclusive with script"); só um dos dois
      // ramos entra no corpo, nunca os dois.
      ...(params.audioUrl
        ? { audio_url: params.audioUrl }
        : {
            script: params.script,
            ...(params.voiceId ? { voice_id: params.voiceId } : {}),
            ...(params.voiceLocale ? { voice_settings: { locale: params.voiceLocale } } : {}),
          }),
      ...(params.background ? { background: params.background } : {}),
      // ★ Achado real (visto ao vivo — sem este campo, a HeyGen renderiza no
      // engine "Avatar IV/V" por padrão, confirmado no próprio dashboard do
      // usuário: ~US$3-4/min. Passando `engine.type: "avatar_iii"`
      // explicitamente, confirmado por queda real de saldo na carteira
      // (US$0,93 → US$0,90 num clipe de 1,46s ≈ US$1,23/min): o MESMO
      // avatar "digital_twin" renderiza no engine "Avatar III", ~4x mais
      // barato, sem perda perceptível de qualidade pro caso de uso deste
      // produto. Nunca remover sem confirmar de novo com um teste real.
      engine: { type: "avatar_iii" },
      // ★ Achado real (pedido direto do usuário — "quero sem [legenda]"):
      // `/v3/videos` rejeita `caption: true/false` (confirmado com erro real
      // da API: "Input should be a valid dictionary or instance of
      // CaptionSetting") — precisa ser um objeto. Sem passar `caption`
      // nenhum, a HeyGen queima legenda no vídeo por padrão (confirmado
      // ao vivo); `{}` é o objeto válido mais simples pra optar pelo modo
      // novo (legenda como arquivo à parte, nunca queimada no vídeo).
      caption: {},
      aspect_ratio: params.aspectRatio ?? "9:16",
      resolution: "1080p",
      output_format: "mp4",
    })) as { data: { video_id: string } };

    return { videoId: payload.data.video_id };
  }

  async getVideoStatus(videoId: string): Promise<{ status: string; videoUrl?: string; durationSeconds?: number }> {
    const payload = (await this.request("GET", `/v3/videos/${videoId}`)) as {
      data: { status: string; video_url?: string; duration?: number };
    };
    return { status: payload.data.status, videoUrl: payload.data.video_url, durationSeconds: payload.data.duration };
  }

  async createPromptLook(params: {
    name: string;
    prompt: string;
    avatarId: string;
    groupId: string;
    aspectRatio?: string;
  }): Promise<{ lookId: string; status: string }> {
    const payload = (await this.request("POST", "/v3/avatars", {
      type: "prompt",
      name: params.name,
      prompt: params.prompt,
      avatar_id: params.avatarId,
      avatar_group_id: params.groupId,
      aspect_ratio: params.aspectRatio ?? "9:16",
    })) as { data: { avatar_item: { id: string; status: string } } };

    return { lookId: payload.data.avatar_item.id, status: payload.data.avatar_item.status };
  }

  async listGroupLooks(groupId: string): Promise<AvatarGroupLook[]> {
    // ★ Achado real: só existe na API legada v2 (`GET
    // /v2/avatar_group/{id}/avatars`) — a doc da HeyGen marca pra
    // descontinuar em 2026-10-31 e recomenda `GET /v3/avatars`, mas esse
    // endpoint v3 só lista GRUPOS (identidades), nunca os looks
    // individuais dentro de um grupo — não existe equivalente v3 pra isto
    // ainda. Revisar antes de 2026-10-31.
    const payload = (await this.request("GET", `/v2/avatar_group/${groupId}/avatars`)) as {
      data: {
        avatar_list: {
          avatar_id?: string;
          avatar_name?: string;
          id?: string;
          name?: string;
          preview_image_url?: string;
        }[];
      };
    };

    return payload.data.avatar_list.map((entry) => ({
      lookId: entry.avatar_id ?? entry.id!,
      name: (entry.avatar_name ?? entry.name ?? "Sem nome").trim(),
      trained: Boolean(entry.avatar_id),
      previewImageUrl: entry.preview_image_url,
    }));
  }

  async synthesizeSpeech(params: { voiceId: string; text: string }): Promise<{ audioUrl: string; durationSeconds: number }> {
    // ★ Achado real (testado ao vivo — `input_text` rejeitado com "Field
    // required: text", o nome certo do campo é `text`): confirma a doc
    // pública, que descreve o parâmetro errado pra este endpoint.
    const payload = (await this.request("POST", "/v3/voices/speech", {
      voice_id: params.voiceId,
      text: params.text,
    })) as { data: { audio_url: string; duration: number } };

    return { audioUrl: payload.data.audio_url, durationSeconds: payload.data.duration };
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const startedAt = new Date();
    let errorMessage: string | undefined;
    const endpoint = `${HEYGEN_API_BASE}${path}`;

    try {
      const response = await fetchWithRetry(endpoint, {
        method,
        headers: { "x-api-key": this.apiKey, "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        errorMessage = `HeyGen ${method} ${path} respondeu ${response.status}: ${errorBody}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      errorMessage ??= error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (this.serviceRoleDb) {
        await logProviderCall({
          serviceRoleDb: this.serviceRoleDb,
          providerKey: this.providerKey,
          capability: "avatar",
          endpoint,
          organizationId: this.organizationId,
          startedAt,
          finishedAt: new Date(),
          ok: !errorMessage,
          errorMessage,
        });
      }
    }
  }
}
