import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { ProviderConfigRepository } from "../repositories/provider-config.repository";
import { AnthropicLlmProvider } from "./anthropic-llm-provider";
import { AnthropicWebSearchTrendSourceProvider } from "./anthropic-web-search-trend-source-provider";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice-provider";
import { FakeLlmProvider } from "./fake-llm-provider";
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada — necessária para a Ayon conversar (ver README/`.env.local.example`).",
    );
  }

  return new AnthropicLlmProvider(config.provider_key, apiKey);
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada — necessária para o Trend Engine pesquisar tendências (ver README/`.env.local.example`).",
    );
  }

  return new AnthropicWebSearchTrendSourceProvider(config.provider_key, apiKey);
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

  return new ElevenLabsVoiceProvider(config.provider_key, apiKey);
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

  return new PexelsMediaProvider(config.provider_key, apiKey);
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

  return new ShotstackVideoRenderProvider(config.provider_key, apiKey, host);
}
