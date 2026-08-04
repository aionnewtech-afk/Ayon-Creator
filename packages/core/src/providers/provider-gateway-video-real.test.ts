import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@ayon/types";
import { resolveMediaProvider, resolveVideoRenderProvider, resolveVoiceProvider } from "./provider-gateway";

/**
 * Valida a resolução real via Provider Gateway (DB-driven — `provider_configs`,
 * migration `0017`) das 3 capacidades novas da Missão 9, Etapa 1, não só os
 * adapters isolados (já cobertos por `video-providers-real.test.ts`). Prova
 * que o seed da migration está correto e que `resolveVoiceProvider`/
 * `resolveMediaProvider`/`resolveVideoRenderProvider` encontram a linha certa.
 *
 * Requer, além das 3 chaves de fornecedor, `NEXT_PUBLIC_SUPABASE_URL` e
 * `SUPABASE_SERVICE_ROLE_KEY` (já configuradas em `.env.local` desde a
 * Sprint 1) — `provider_configs` não tem policy de RLS para usuário final
 * (database.md §8), só service role pode lê-la.
 */
describe("Provider Gateway — voice/media/video_render (chamada real via DB)", () => {
  const hasAllEnv =
    process.env.ELEVENLABS_API_KEY &&
    process.env.PEXELS_API_KEY &&
    process.env.SHOTSTACK_API_KEY &&
    process.env.SHOTSTACK_HOST &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  it.skipIf(!hasAllEnv)(
    "resolve os 3 providers a partir de provider_configs (tier econômico) e confirma cada um com uma chamada real",
    async () => {
      const serviceRoleDb = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );

      const voiceProvider = await resolveVoiceProvider(serviceRoleDb, "economico");
      const voiceResult = await voiceProvider.synthesizeVoice({ script: "Teste de resolução via Provider Gateway." });
      expect(voiceResult.providerKey).toBe("elevenlabs");
      expect(voiceResult.audioBase64.length).toBeGreaterThan(0);

      const mediaProvider = await resolveMediaProvider(serviceRoleDb, "economico");
      const mediaResult = await mediaProvider.searchMedia({ query: "cidade à noite", orientation: "portrait", perPage: 1 });
      expect(mediaResult.providerKey).toBe("pexels");
      expect(mediaResult.candidates.length).toBeGreaterThan(0);

      const renderProvider = await resolveVideoRenderProvider(serviceRoleDb, "economico");
      const renderResult = await renderProvider.composeVideo({
        audioUrl: "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/lit.mp3",
        videoSources: [{ url: mediaResult.candidates[0]!.downloadUrl, startSeconds: 0, lengthSeconds: 5 }],
        captionCues: [{ text: "Provider Gateway OK", startSeconds: 0, lengthSeconds: 5 }],
        aspectRatio: "9:16",
      });
      expect(renderResult.providerKey).toBe("shotstack");
      expect(renderResult.videoUrl).toMatch(/^https:\/\//);
    },
    5 * 60_000,
  );
});
