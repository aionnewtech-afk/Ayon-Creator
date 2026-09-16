import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPieceFormat, ContentStyle, Database, ProviderTier } from "@ayon/types";
import { resolveLlmProvider } from "../providers/provider-gateway";
import { parseLlmJson } from "../shared/llm-json";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { ContentVersionRepository } from "../repositories/content-version.repository";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import { buildAssetGenerationSystemPrompt, buildAssetGenerationUserMessage } from "./asset-generation-prompts";

const TextPieceResponseSchema = z.object({
  content: z.string().min(1),
  rationale: z.string().min(1),
});

export interface GenerateTextPieceParams {
  /** Client de sessão (RLS) — grava content_pieces/content_versions. */
  db: SupabaseClient<Database>;
  /** Client de service role — resolve provider_configs. */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  contentPieceId: string;
  format: ContentPieceFormat;
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  learnedPreferencesText?: string;
  consolidatedStrategy: string;
  strategyRationale: string;
  /** ★ Achado real (briefing detalhado virou roteiro genérico): objetivo bruto digitado pelo usuário — fonte primária de itens específicos que `consolidatedStrategy` pode ter comprimido. */
  objective?: string;
  /** ★ Mesmo achado — fatos concretos de `researchCampaignObjective`, quando disponíveis. */
  researchNotes?: string;
  /** ★ Achado real (pedido direto do usuário — "cunho mais comercial ou pegada mais institucional"). */
  contentStyle?: ContentStyle;
}

export interface GenerateTextPieceResult {
  content: string;
  rationale: string;
}

/**
 * Gera uma peça textual (Fluxo 3, §3.1, "peça derivada") — regra
 * inegociável: nunca chamado sem o contexto do Brand Brain já carregado
 * pelo chamador (architecture.md §3.5).
 */
export async function generateTextPiece(params: GenerateTextPieceParams): Promise<GenerateTextPieceResult> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const contentVersionRepository = new ContentVersionRepository(params.db);

  await contentPieceRepository.update(params.contentPieceId, { status: "generating" });

  try {
    const llmProvider = await resolveLlmProvider(params.serviceRoleDb, params.tier);

    const userMessage = buildAssetGenerationUserMessage({
      brandName: params.brandName,
      knownFields: params.knownFields,
      learnedPreferencesText: params.learnedPreferencesText,
      objective: params.objective,
      researchNotes: params.researchNotes,
      consolidatedStrategy: params.consolidatedStrategy,
      strategyRationale: params.strategyRationale,
      format: params.format,
    });

    const completion = await llmProvider.complete({
      system: buildAssetGenerationSystemPrompt(params.format, params.contentStyle),
      messages: [{ role: "user", content: userMessage }],
      // ★ Achado real (validado com chamada real — objetivo com 6 itens
      // específicos + tom institucional, mais descritivo por item, cortou no
      // meio da 3ª descrição com 1536): a instrução "nunca comprima uma
      // lista" (acima) agora deliberadamente produz textos mais longos
      // quando o objetivo pede vários itens — 1536 bastava pro texto curto
      // de sempre, não pra isso.
      maxTokens: 2560,
    });

    const parsed = TextPieceResponseSchema.parse(parseLlmJson(completion.text));

    await contentVersionRepository.create({
      content_piece_id: params.contentPieceId,
      version_number: 1,
      generation_metadata: { llm_provider_key: completion.providerKey, tier: params.tier },
    });

    await contentPieceRepository.update(params.contentPieceId, {
      script: parsed.content,
      brand_rationale: parsed.rationale,
      status: "ready_for_review",
    });

    return { content: parsed.content, rationale: parsed.rationale };
  } catch (error) {
    // Achado real, sprint de estabilização: status voltava para "draft" —
    // indistinguível de "nunca tentado" na UI ("Aguardando"), então uma
    // peça que falhou de verdade (ex.: campanhas sem `video`/pieces
    // completos) nunca mostrava sinal nenhum de erro ao usuário. `failed`
    // já é um status válido e já tem tratamento de UI ("Falhou" +
    // "Tentar novamente") — só nunca era usado aqui.
    await contentPieceRepository.update(params.contentPieceId, { status: "failed" }).catch(() => undefined);
    throw error;
  }
}
