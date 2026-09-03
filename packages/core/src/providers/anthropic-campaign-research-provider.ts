import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { parseLlmJson } from "../shared/llm-json";
import { buildTemporalContextBlock } from "../shared/temporal-context";
import type { CampaignResearchProvider, CampaignResearchRequest, CampaignResearchResult } from "./campaign-research-provider";

/**
 * Adapter concreto do Campaign Research Provider sobre a ferramenta de busca
 * web nativa da API da Anthropic (`web_search_20250305`) — mesmo transporte
 * já validado em `anthropic-web-search-trend-source-provider.ts`, schema de
 * resposta diferente (fatos concretos por item, não "tendências").
 */
export class AnthropicCampaignResearchProvider implements CampaignResearchProvider {
  private readonly client: Anthropic;

  constructor(
    private readonly providerKey: string,
    apiKey: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async research(request: CampaignResearchRequest): Promise<CampaignResearchResult> {
    const response = await this.client.messages.create({
      model: this.providerKey,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: buildUserMessage(request) }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const parsed = ResearchResponseSchema.parse(parseLlmJson(text));

    return {
      findings: parsed.findings.map((finding) => ({
        name: finding.name,
        details: finding.details,
        sourceUrl: finding.source_url,
      })),
      summary: parsed.summary,
      providerKey: this.providerKey,
    };
  }
}

const ResearchResponseSchema = z.object({
  findings: z
    .array(
      z.object({
        name: z.string().min(1),
        details: z.string().min(1),
        source_url: z.string().nullable().default(null),
      }),
    )
    .max(10),
  summary: z.string().min(1),
});

/** ★ Mesmo pedido/schema de gemini-campaign-research-provider.ts — ver lá o comentário completo sobre a motivação. Mantido em paridade para a troca de fornecedor (LLM_PROVIDER) continuar reversível. */
const SYSTEM_PROMPT =
  'Você é o Pesquisador de Campo da Ayon Creator. Sua função é pesquisar na web, usando a ferramenta de busca disponível, fatos REAIS e concretos relevantes para o objetivo de campanha informado — nomes de lugares, produtos, eventos, dados ou particularidades verificáveis, nunca generalidades inventadas com base em senso comum desatualizado do seu treinamento.\n' +
  'Se o objetivo pedir uma lista de itens específicos (ex.: "5 lugares para X", "os melhores Y"), pesquise e retorne itens REAIS, cada um com detalhes concretos e específicos do que esperar/por que se encaixa (nunca um item genérico só pra completar a contagem — se a busca não confirmar itens suficientes, retorne menos).\n' +
  'Se o objetivo não pedir uma lista, pesquise e retorne fatos/contexto real e atual que ajudem a fundamentar a estratégia (dados de mercado, notícias, particularidades reais do nicho) em vez de generalidades.\n' +
  'Responda SOMENTE com um JSON estrito, sem texto antes ou depois: {"findings": [{"name": "nome do item/fato pesquisado", "details": "2-4 frases concretas e específicas, com dados/nomes reais quando existirem", "source_url": "URL da fonte mais relevante, ou null se não houver uma única fonte clara"}], "summary": "síntese de 2-4 frases de tudo que foi encontrado, pronta para orientar quem for escrever a campanha"}. No máximo 10 itens.';

function buildUserMessage(request: CampaignResearchRequest): string {
  return `${buildTemporalContextBlock()}\n\nMarca: ${request.brandName}\nNicho de negócio: ${request.niche ?? "não informado"}\n\nObjetivo de campanha proposto pelo usuário:\n"${request.objective}"\n\nPesquise fatos reais e específicos que fundamentem esse objetivo de campanha.`;
}
