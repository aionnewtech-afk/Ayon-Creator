import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { MediaCandidate, MediaProvider, MediaSearchRequest, MediaSearchResult } from "./media-provider";
import { logProviderCall } from "./log-provider-call";
import { fetchWithRetry } from "../shared/fetch-with-retry";

const GEMINI_NATIVE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Mesmo bucket privado usado por `photo-pipeline-compose.ts` para o resultado final — evita criar bucket/migration novos só para o estágio intermediário. */
const GENERATED_MEDIA_BUCKET = "content-output";

/**
 * ★ Achado real (validação direta na API): o Video Render Provider (Shotstack) busca `backgroundImageUrl` sobre HTTP — o bucket é privado, então precisa de uma signed URL, não do path bruto.
 * ★ Achado real (produção — Railway): 1h não é suficiente. Essa URL fica gravada em `pending_scene_plan` e só é
 * consumida quando o usuário aprova o plano na revisão manual — que pode levar horas. Signed URL expirada vira
 * "This URL is not accessible (bad request)" no Shotstack. 7 dias cobre qualquer revisão realista (mesmo TTL já
 * usado em `video-pipeline-scene-edit.ts` para o mesmo cenário).
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

interface GeminiImagePart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: GeminiImagePart[] } }[];
}

export interface GeminiImageMediaContext {
  organizationId: string;
  campaignId: string;
  contentPieceId: string;
  /**
   * ★ Achado real (pedido direto do usuário — "anexar umas artes pra ele
   * entender a identidade visual da empresa"): validado real via curl que
   * anexar uma imagem de referência (junto do prompt de texto, como parte
   * `inlineData` adicional) faz a geração puxar paleta/tom reais da marca,
   * em vez de só descrever cores em palavras. Opcional — nenhuma referência
   * cadastrada gera exatamente como antes (`fetch-brand-reference-images.ts`).
   */
  referenceImages?: { mimeType: string; base64: string }[];
}

/**
 * Adapter concreto do Media Provider (architecture.md §5, §3.5.1) que GERA a
 * foto em vez de buscar num banco de imagens licenciadas — achado real,
 * pedido direto do usuário: as fotos de feed/stories vindas do Pexels
 * "ficam péssimas, nada a ver com o que pedi" mesmo com busca em inglês
 * (`derivePhotoSearchQuery`) — um banco de fotos genéricas nunca vai ter uma
 * foto que ilustre o gancho comercial/emocional específico de uma campanha
 * (ex.: "viajar no Natal" precisa de uma cena de Natal real, não qualquer
 * praia). `gemini-2.5-flash-image` ("Nano Banana"), validado real via curl
 * direto (imagem final fotorrealista, aspect ratio 9:16 respeitado via
 * `generationConfig.imageConfig.aspectRatio`).
 *
 * Só implementa `searchPhotos` — vídeo continua 100% Pexels
 * (`resolveMediaProvider`/`PexelsMediaProvider`, intocado; este provider
 * nunca é resolvido por lá, só diretamente em `photo-pipeline-select.ts`
 * quando `IMAGE_GENERATION_PROVIDER=gemini`). `searchMedia`/`fetchMedia`
 * lançam propositalmente — nunca devem ser chamados nesta instância.
 *
 * O texto (headline/subheadline/CTA) continua sendo o `visual_brief`
 * existente, sobreposto pelo Shotstack (`photo-pipeline-compose.ts`) — não
 * pedimos ao Gemini para renderizar texto na imagem (achado real de sessão
 * anterior: modelos de imagem generativa erram texto embutido com
 * frequência; Shotstack já resolve isso de forma confiável).
 */
export class GeminiImageMediaProvider implements MediaProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
    private readonly serviceRoleDb: SupabaseClient<Database>,
    private readonly context: GeminiImageMediaContext,
  ) {}

  async searchMedia(): Promise<MediaSearchResult> {
    throw new Error("GeminiImageMediaProvider não busca vídeo — use PexelsMediaProvider (resolveMediaProvider).");
  }

  async fetchMedia(): Promise<MediaCandidate> {
    throw new Error("GeminiImageMediaProvider não implementa fetchMedia — só gera fotos sob demanda via searchPhotos.");
  }

  async searchPhotos(request: MediaSearchRequest): Promise<MediaSearchResult> {
    const count = Math.max(1, Math.min(request.perPage ?? 1, 3));
    const aspectRatio = request.orientation === "square" ? "1:1" : "9:16";

    const candidates: MediaCandidate[] = [];
    for (let index = 0; index < count; index++) {
      candidates.push(await this.generateOne(request.query, aspectRatio, index));
    }

    return { candidates, providerKey: this.providerKey };
  }

  private async generateOne(prompt: string, aspectRatio: "1:1" | "9:16", index: number): Promise<MediaCandidate> {
    const startedAt = new Date();
    let errorMessage: string | undefined;

    try {
      // ★ Referências primeiro, texto por último — mesma ordem validada real
      // (curl direto). Achado real (3 rodadas de validação):
      // 1) instrução "branda" ("use only as inspiration... do not reproduce")
      //    não funcionou — testado com uma referência P&B/noir bem distinta
      //    do resultado normal (sempre colorido/quente) e o modelo ignorou a
      //    referência, preferindo a descrição de "fotografia comercial".
      // 2) instrução assertiva ("CRITICAL... must also be...") ANTES da
      //    descrição da cena funcionou isolada (curl com uma cena curta,
      //    escrita à mão), mas falhou pelo pipeline real de verdade — o
      //    prompt gerado por LLM (`deriveImageGenerationPrompt`) inclui sua
      //    própria linguagem explícita de cor/luz ("golden hour", "quente"),
      //    e essa descrição posterior, mais específica, vencia a instrução
      //    de estilo que vinha antes dela.
      // 3) mover a instrução de estilo pra DEPOIS da cena, como uma
      //    "sobreposição" explícita ("regardless of any lighting/color
      //    described above") — validado real pelo pipeline completo,
      //    resultado genuinamente P&B/noir com a mesma referência.
      const referenceParts = (this.context.referenceImages ?? []).map((ref) => ({
        inlineData: { mimeType: ref.mimeType, data: ref.base64 },
      }));
      const promptWithReferenceGuard =
        referenceParts.length > 0
          ? `${prompt}\n\nCRITICAL STYLE OVERRIDE: regardless of any lighting/color/mood described above, the final ` +
            `image's color grading, tonal contrast, and overall mood MUST match the attached reference image(s) as ` +
            `closely as possible — if the reference is warm, the output must be warm; if desaturated/monochrome/` +
            `high-contrast, the output must be too. Never default to a generic photorealistic warm look that ` +
            `ignores the reference's mood. Keep the scene/subjects/composition described above — only the color ` +
            `grading and mood come from the reference (never copy its logo/text/exact composition).`
          : prompt;

      const response = await fetchWithRetry(`${GEMINI_NATIVE_BASE_URL}/${this.providerKey}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [...referenceParts, { text: promptWithReferenceGuard }] }],
          generationConfig: { imageConfig: { aspectRatio } },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        errorMessage = `Gemini (geração de imagem) respondeu ${response.status}: ${errorBody}`;
        throw new Error(errorMessage);
      }

      const payload = (await response.json()) as GeminiGenerateContentResponse;
      const imagePart = (payload.candidates?.[0]?.content?.parts ?? []).find((part) => part.inlineData?.data);
      if (!imagePart?.inlineData?.data) {
        errorMessage = "Gemini não retornou nenhuma imagem (inlineData ausente na resposta).";
        throw new Error(errorMessage);
      }

      const mimeType = imagePart.inlineData.mimeType ?? "image/png";
      const extension = mimeType === "image/jpeg" ? "jpg" : "png";
      const buffer = Buffer.from(imagePart.inlineData.data, "base64");

      const storagePath =
        `${this.context.organizationId}/${this.context.campaignId}/generated/` +
        `${this.context.contentPieceId}-bg-${startedAt.getTime()}-${index}.${extension}`;

      const { error: uploadError } = await this.serviceRoleDb.storage
        .from(GENERATED_MEDIA_BUCKET)
        .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await this.serviceRoleDb.storage
        .from(GENERATED_MEDIA_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed) throw signError ?? new Error("Falha ao criar signed URL para a imagem gerada.");

      const { width, height } = aspectRatio === "1:1" ? { width: 1080, height: 1080 } : { width: 1080, height: 1920 };

      return {
        id: storagePath,
        previewUrl: signed.signedUrl,
        downloadUrl: signed.signedUrl,
        width,
        height,
        providerKey: this.providerKey,
        // ★ Achado real (pedido direto do usuário — "mostrar o prompt exato
        // usado em cada peça gerada"): texto EXATO mandado ao Gemini, já com
        // o guard de referência de estilo quando presente — nunca só o
        // `prompt` original (que o usuário nem vê se a referência mudou o
        // resultado).
        generationPrompt: promptWithReferenceGuard,
      };
    } catch (error) {
      errorMessage ??= error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await logProviderCall({
        serviceRoleDb: this.serviceRoleDb,
        providerKey: this.providerKey,
        capability: "media",
        model: this.providerKey,
        endpoint: `${GEMINI_NATIVE_BASE_URL}/${this.providerKey}:generateContent`,
        organizationId: this.context.organizationId,
        startedAt,
        finishedAt: new Date(),
        ok: !errorMessage,
        errorMessage,
      });
    }
  }
}
