import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { parseLlmJson } from "../shared/llm-json";
import type {
  TrendCandidateSearchRequest,
  TrendCandidateSearchResult,
  TrendSourceProvider,
} from "./trend-source-provider";

/**
 * Adapter concreto do Trend Source Provider (architecture.md §3.3) sobre a
 * ferramenta de busca web nativa da API da Anthropic (`web_search_20250305`).
 * Único arquivo do monorepo, junto com anthropic-llm-provider.ts, que importa
 * o SDK da Anthropic para este propósito — trocar de fornecedor (ex.: Google
 * Trends, SerpAPI) nunca exige mudar quem chama `TrendSourceProvider`, só o
 * resultado da resolução em provider-gateway.ts.
 */
export class AnthropicWebSearchTrendSourceProvider implements TrendSourceProvider {
  private readonly client: Anthropic;

  constructor(
    private readonly providerKey: string,
    apiKey: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async findCandidates(request: TrendCandidateSearchRequest): Promise<TrendCandidateSearchResult> {
    const response = await this.client.messages.create({
      model: this.providerKey,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: buildUserMessage(request) }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const parsed = CandidateSearchResponseSchema.parse(parseLlmJson(text));

    return {
      candidates: parsed.candidates.map((candidate) => ({
        title: candidate.title,
        summary: candidate.summary,
        sourceUrl: candidate.source_url,
      })),
      providerKey: this.providerKey,
    };
  }
}

const CandidateSearchResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        source_url: z.string().nullable().default(null),
      }),
    )
    .max(10),
});

const SYSTEM_PROMPT =
  'Você é o Trend Source Provider da Ayon Creator. Sua única função é pesquisar na web tendências atuais e genuinamente relevantes para o nicho de negócio informado, usando a ferramenta de busca disponível. Não avalie se a tendência combina com a marca especificamente — isso é responsabilidade do Intelligence Hub, não sua. Priorize sinais recentes e verificáveis (notícias, dados de comportamento de consumo, movimentos de mercado do nicho) sobre especulação. Se a busca não revelar nada genuinamente relevante ao nicho, retorne uma lista vazia — nunca invente uma tendência para preencher a resposta. Depois de pesquisar, responda SOMENTE com um JSON estrito, sem texto antes ou depois: {"candidates": [{"title": "título curto da tendência", "summary": "do que se trata e por que é relevante para este nicho agora, 2-3 frases", "source_url": "URL da fonte mais relevante, ou null se não houver uma única fonte clara"}]}. No máximo 6 candidatos.';

function buildUserMessage(request: TrendCandidateSearchRequest): string {
  return `Nicho de negócio: ${request.niche}\nMarca (contexto, não filtro de pesquisa): ${request.brandName}\n\nPesquise tendências atuais relevantes para este nicho.`;
}
