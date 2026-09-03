import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { HeygenAccountPoolRepository } from "../repositories/heygen-account-pool.repository";
import { ProviderConfigRepository } from "../repositories/provider-config.repository";
import { AnthropicCampaignResearchProvider } from "./anthropic-campaign-research-provider";
import { AnthropicLlmProvider } from "./anthropic-llm-provider";
import { AnthropicWebSearchTrendSourceProvider } from "./anthropic-web-search-trend-source-provider";
import type { CampaignResearchProvider } from "./campaign-research-provider";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice-provider";
import { FakeLlmProvider } from "./fake-llm-provider";
import { GeminiCampaignResearchProvider } from "./gemini-campaign-research-provider";
import { GeminiImageMediaProvider, type GeminiImageMediaContext } from "./gemini-image-media-provider";
import { GeminiLlmProvider } from "./gemini-llm-provider";
import { GeminiVeoVideoProvider, type GeminiVeoVideoContext } from "./gemini-veo-video-provider";
import { GeminiWebSearchTrendSourceProvider } from "./gemini-web-search-trend-source-provider";
import type { AvatarProvider } from "./avatar-provider";
import { HeyGenAvatarProvider } from "./heygen-avatar-provider";
import type { LlmProvider } from "./llm-provider";
import type { MediaProvider } from "./media-provider";
import { PexelsMediaProvider } from "./pexels-media-provider";
import { ShotstackVideoRenderProvider } from "./shotstack-video-render-provider";
import type { TrendSourceProvider } from "./trend-source-provider";
import type { VideoRenderProvider } from "./video-render-provider";
import type { VoiceProvider } from "./voice-provider";

/**
 * Único ponto de código que resolve `(capability, tier)` → adapter concreto
 * (architecture.md §5.1). Nenhum Core Engine deve importar um adapter
 * diretamente — sempre passar por aqui.
 *
 * `db` precisa ser um client de **service role** — `provider_configs` não
 * tem policy de RLS para o usuário final (database.md §8).
 */
export async function resolveLlmProvider(
  db: SupabaseClient<Database>,
  tier: ProviderTier,
  specialistId?: string,
): Promise<LlmProvider> {
  // Smoke test de CI (Missão H2, CONVENTIONS.md §10) — nunca setada em
  // .env.local/produção. Nome deliberadamente inequívoco para não ser
  // ligada por acidente.
  if (process.env.LLM_PROVIDER_MODE === "fake") {
    return new FakeLlmProvider();
  }

  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("llm", tier, specialistId);

  if (!config) {
    throw new Error(`Nenhum provider_config ativo para (capability=llm, tier=${tier}).`);
  }

  // ★ Troca temporária de fornecedor (conta Anthropic sem créditos, conta
  // Gemini com créditos disponíveis) — `LLM_PROVIDER=gemini` desvia a
  // capacidade `llm` (especialistas, Coordinator, geração de texto/roteiro,
  // segmentação de cena, voz da marca, brief visual, ranking/coordinator do
  // Trend Engine, Learning Engine) para o Gemini via sua camada de
  // compatibilidade OpenAI — nunca toca `provider_configs` (`config` acima
  // continua sendo a checagem de existência de configuração ativa, igual
  // para os dois fornecedores). `resolveTrendSourceProvider` abaixo tem seu
  // próprio branch (busca web — a API nativa do Gemini, não a camada
  // OpenAI-compatible, que não expõe a ferramenta de busca). Reversível:
  // remover a variável (ou voltar para "anthropic") restaura o comportamento
  // original exatamente como antes, sem nenhum efeito colateral.
  if (process.env.LLM_PROVIDER === "gemini") {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error(
        "GEMINI_API_KEY não configurada — necessária quando LLM_PROVIDER=gemini (ver README/`.env.local.example`).",
      );
    }
    // ★ Achado real (validação direta na API): "gemini-2.5-flash"/"gemini-2.0-flash"
    // retornam 404 ("no longer available to new users"/"no longer available")
    // para esta conta — "gemini-3-flash-preview" testado e confirmado
    // funcionando (JSON estrito, baixo custo). Ver `.env.local.example` para
    // trocar sem editar código.
    const geminiModel = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
    return new GeminiLlmProvider(geminiModel, geminiApiKey, db);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada — necessária para a Ayon conversar (ver README/`.env.local.example`).",
    );
  }

  return new AnthropicLlmProvider(config.provider_key, apiKey, db);
}

/**
 * Resolve `(capability: "trend_source", tier)` → adapter concreto
 * (architecture.md §3.3). O Trend Engine nunca conhece o fornecedor
 * concreto por trás desta função, apenas `TrendSourceProvider`.
 */
export async function resolveTrendSourceProvider(
  db: SupabaseClient<Database>,
  tier: ProviderTier,
): Promise<TrendSourceProvider> {
  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("trend_source", tier);

  if (!config) {
    throw new Error(`Nenhum provider_config ativo para (capability=trend_source, tier=${tier}).`);
  }

  // ★ Troca temporária de fornecedor (conta Anthropic sem créditos) — busca
  // web via API **nativa** do Gemini (`GeminiWebSearchTrendSourceProvider`),
  // não a camada OpenAI-compatible usada em `resolveLlmProvider` acima (essa
  // não expõe busca/grounding — achado real, "Invalid tool type" testado
  // direto na API para toda variante tentada). Mesmo prompt/schema/
  // comportamento do adapter Anthropic, só o transporte muda. Reversível do
  // mesmo jeito: remover `LLM_PROVIDER` (ou voltar para "anthropic").
  if (process.env.LLM_PROVIDER === "gemini") {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error(
        "GEMINI_API_KEY não configurada — necessária quando LLM_PROVIDER=gemini (ver README/`.env.local.example`).",
      );
    }
    const geminiModel = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
    return new GeminiWebSearchTrendSourceProvider(geminiModel, geminiApiKey);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada — necessária para o Trend Engine pesquisar tendências (ver README/`.env.local.example`).",
    );
  }

  return new AnthropicWebSearchTrendSourceProvider(config.provider_key, apiKey);
}

/**
 * Resolve a pesquisa de campo pra estratégia de campanha (pedido direto do
 * usuário — "a pesquisa tem que de fato valer a pena") — reaproveita o MESMO
 * `provider_config` de `trend_source` (é literalmente o mesmo mecanismo,
 * busca web nativa com grounding, só muda o prompt/schema pro caso de uso).
 * Evita uma migration nova só pra registrar mais uma capability idêntica.
 *
 * ★ Diferente de `resolveTrendSourceProvider`: NUNCA lança erro — pesquisa é
 * um reforço opcional da estratégia, nunca um requisito (Trend Engine já é
 * 100% dependente de busca, essa não é). Sem `provider_config`/chave de API
 * configurada, `null` sinaliza "pula a pesquisa, segue sem ela" pra quem
 * chamar (`runStrategyForCampaign`).
 */
export async function resolveCampaignResearchProvider(
  db: SupabaseClient<Database>,
  tier: ProviderTier,
): Promise<CampaignResearchProvider | null> {
  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("trend_source", tier);
  if (!config) return null;

  if (process.env.LLM_PROVIDER === "gemini") {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) return null;
    const geminiModel = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
    return new GeminiCampaignResearchProvider(geminiModel, geminiApiKey);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  return new AnthropicCampaignResearchProvider(config.provider_key, apiKey);
}

/**
 * Resolve `(capability: "voice", tier)` → adapter concreto (Missão 9, Etapa
 * 1 — architecture.md §3.5.1/§5). O Asset Engine nunca conhece o fornecedor
 * concreto por trás desta função, apenas `VoiceProvider`.
 */
export async function resolveVoiceProvider(db: SupabaseClient<Database>, tier: ProviderTier): Promise<VoiceProvider> {
  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("voice", tier);

  if (!config) {
    throw new Error(`Nenhum provider_config ativo para (capability=voice, tier=${tier}).`);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY não configurada — necessária para sintetizar narração (ver `.env.local.example`).");
  }

  return new ElevenLabsVoiceProvider(config.provider_key, apiKey, db);
}

/**
 * Resolve `(capability: "media", tier)` → adapter concreto (Missão 9, Etapa
 * 1 — architecture.md §3.5.1/§5). O Asset Engine nunca conhece o fornecedor
 * concreto por trás desta função, apenas `MediaProvider`.
 */
export async function resolveMediaProvider(db: SupabaseClient<Database>, tier: ProviderTier): Promise<MediaProvider> {
  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("media", tier);

  if (!config) {
    throw new Error(`Nenhum provider_config ativo para (capability=media, tier=${tier}).`);
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY não configurada — necessária para buscar cenas (ver `.env.local.example`).");
  }

  return new PexelsMediaProvider(config.provider_key, apiKey, db);
}

/**
 * Resolve o adapter de GERAÇÃO de foto (não busca) para feed/stories/thumbnail
 * — achado real, pedido direto do usuário: fotos de banco (Pexels) "nada a
 * ver com o que pedi", queria fotos criadas pelo Gemini. Deliberadamente
 * **fora** de `resolveMediaProvider` acima: aquela função também resolve o
 * Media Provider do vídeo (`searchMedia`, Pexels, intocado por pedido
 * explícito do usuário) — uma capacidade `media` só via `provider_configs`
 * trocaria os dois de uma vez. Aqui o desvio é só por variável de ambiente
 * (`IMAGE_GENERATION_PROVIDER=gemini`), nunca toca `provider_configs`;
 * retorna `null` quando desligado (comportamento padrão: `selectPhotoCandidates`
 * cai de volta no Pexels via `resolveMediaProvider`, 100% reversível).
 */
export function resolveImageGenerationMediaProvider(
  serviceRoleDb: SupabaseClient<Database>,
  context: GeminiImageMediaContext,
): MediaProvider | null {
  if (process.env.IMAGE_GENERATION_PROVIDER !== "gemini") return null;

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada — necessária quando IMAGE_GENERATION_PROVIDER=gemini (ver README/`.env.local.example`).",
    );
  }

  // ★ Achado real (validação direta na API): "gemini-2.5-flash-image" ("Nano
  // Banana") gera imagens fotorrealistas reais, aspect ratio 9:16/1:1
  // controlável via `generationConfig.imageConfig.aspectRatio`.
  const geminiImageModel = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  return new GeminiImageMediaProvider(geminiImageModel, geminiApiKey, serviceRoleDb, context);
}

/**
 * Resolve o adapter de GERAÇÃO de vídeo (Veo) — 3ª camada do fallback
 * híbrido de cenas de vídeo (`video-pipeline-scenes.ts`), pedido direto do
 * usuário depois de validar um teste real pago (Veo 3.1 Lite, aprovado
 * "adorei"). Env var própria (`VIDEO_GENERATION_PROVIDER`, nunca
 * `IMAGE_GENERATION_PROVIDER`) — perfis de custo (cobra por segundo,
 * diferente da imagem quase gratuita) e latência (até ~6min por geração)
 * completamente diferentes, nunca devem ficar acoplados no mesmo toggle.
 * Retorna `null` quando desligado (padrão — 100% reversível).
 */
export function resolveVeoVideoProvider(
  serviceRoleDb: SupabaseClient<Database>,
  context: GeminiVeoVideoContext,
): GeminiVeoVideoProvider | null {
  if (process.env.VIDEO_GENERATION_PROVIDER !== "gemini") return null;

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada — necessária quando VIDEO_GENERATION_PROVIDER=gemini (ver README/`.env.local.example`).",
    );
  }

  // ★ Achado real (validação direta na API, `ListModels`): "veo-3.1-generate-preview"
  // (Standard, $0.40/s), "veo-3.1-fast-generate-preview" (Fast, $0.10-0.12/s)
  // e "veo-3.1-lite-generate-preview" (Lite, $0.05-0.08/s) — Lite escolhido
  // explicitamente pelo usuário (custo mais baixo), testado real (~5min de
  // geração, qualidade aprovada).
  const geminiVideoModel = process.env.GEMINI_VIDEO_MODEL ?? "veo-3.1-lite-generate-preview";
  return new GeminiVeoVideoProvider(geminiVideoModel, geminiApiKey, serviceRoleDb, context);
}

/**
 * Resolve o Avatar Provider (HeyGen) — "digital twin" do porta-voz da marca
 * (`production_mode = "ai_avatar"`, pedido direto do usuário — "iniciar o
 * avatar do porta voz da empresa"). Sem tier/`provider_configs` por ora
 * (único fornecedor, achado real: HeyGen é o único com API pública de
 * clonagem de avatar por consentimento avaliada).
 *
 * ★ Achado real (pedido direto do usuário — "então a api pra múltiplos
 * criadores você resolve né?"): a HeyGen limita 1 "avatar group" por
 * conta/chave de API (visto ao vivo, erro real: "limit of 1 verified avatar
 * group slots") — 1 única `HEYGEN_API_KEY` global significava que só a
 * PRIMEIRA organização do sistema inteiro conseguiria ter avatar. Modelo
 * escolhido (o criador paga a Ayon direto, custo da HeyGen embutido no
 * plano — nunca "traga sua própria chave"): a Ayon mantém um pool de contas
 * HeyGen reais (`heygen_account_pool`, migration 0026), 1 conta por
 * organização, atribuída na hora (`claim_heygen_account`, atômico).
 *
 * Fallback pra `HEYGEN_API_KEY` (`.env`) só quando o pool está **vazio de
 * verdade** (0 linhas — "nunca configurado ainda", preserva o
 * comportamento anterior a esta migração sem exigir setup manual pra
 * continuar testando localmente). Pool com linhas mas sem nenhuma
 * disponível pra esta organização é um erro explícito — nunca cai de volta
 * pra `.env` nesse caso, porque isso reintroduziria silenciosamente o mesmo
 * bug de 2 organizações compartilhando a mesma conta/teto.
 */
export async function resolveAvatarProvider(
  serviceRoleDb: SupabaseClient<Database>,
  organizationId: string,
): Promise<AvatarProvider | null> {
  const pool = new HeygenAccountPoolRepository(serviceRoleDb);
  const poolSize = await pool.count();

  if (poolSize === 0) {
    const heygenApiKey = process.env.HEYGEN_API_KEY;
    if (!heygenApiKey) return null;
    return new HeyGenAvatarProvider("heygen", heygenApiKey, serviceRoleDb, organizationId);
  }

  const claimedApiKey = await pool.claimForOrganization(organizationId);
  if (!claimedApiKey) {
    throw new Error(
      "Sem contas HeyGen disponíveis no pool pra atribuir a esta organização — adicione mais contas em `heygen_account_pool`.",
    );
  }

  return new HeyGenAvatarProvider("heygen", claimedApiKey, serviceRoleDb, organizationId);
}

/**
 * Resolve `(capability: "video_render", tier)` → adapter concreto (Missão 9,
 * Etapa 1 — architecture.md §3.5.1/§5, capacidade nova). O Asset Engine
 * nunca conhece o fornecedor concreto por trás desta função, apenas
 * `VideoRenderProvider`.
 */
export async function resolveVideoRenderProvider(
  db: SupabaseClient<Database>,
  tier: ProviderTier,
): Promise<VideoRenderProvider> {
  const repository = new ProviderConfigRepository(db);
  const config = await repository.findActive("video_render", tier);

  if (!config) {
    throw new Error(`Nenhum provider_config ativo para (capability=video_render, tier=${tier}).`);
  }

  const apiKey = process.env.SHOTSTACK_API_KEY;
  const host = process.env.SHOTSTACK_HOST;
  if (!apiKey || !host) {
    throw new Error(
      "SHOTSTACK_API_KEY/SHOTSTACK_HOST não configuradas — necessárias para compor o vídeo final (ver `.env.local.example`).",
    );
  }

  return new ShotstackVideoRenderProvider(config.provider_key, apiKey, host, db);
}
