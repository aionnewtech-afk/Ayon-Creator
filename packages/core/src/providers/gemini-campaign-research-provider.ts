import { z } from "zod";
import { parseLlmJson } from "../shared/llm-json";
import { buildTemporalContextBlock } from "../shared/temporal-context";
import { fetchWithRetry } from "../shared/fetch-with-retry";
import type { CampaignResearchProvider, CampaignResearchRequest, CampaignResearchResult } from "./campaign-research-provider";

const GEMINI_NATIVE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Adapter concreto do Campaign Research Provider sobre a busca web nativa do
 * Gemini ("Grounding with Google Search") — mesmo transporte/achados já
 * validados em `gemini-web-search-trend-source-provider.ts` (API nativa, não
 * a camada OpenAI-compatible; `maxOutputTokens` generoso pra não truncar o
 * JSON no meio de uma busca real).
 */
export class GeminiCampaignResearchProvider implements CampaignResearchProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
  ) {}

  async research(request: CampaignResearchRequest): Promise<CampaignResearchResult> {
    const response = await fetchWithRetry(`${GEMINI_NATIVE_BASE_URL}/${this.providerKey}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildUserMessage(request) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Gemini (pesquisa de campanha) respondeu ${response.status}: ${errorBody}`);
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = (payload.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("\n");

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

/**
 * ★ Achado real (pedido direto do usuário — exemplo real de campanha "5
 * lugares para desacelerar"): o pedido explícito era "pesquisar 5 destinos e
 * me dar o roteiro... com o que se pode esperar em cada" — o ponto central é
 * NUNCA inventar itens só pra preencher uma lista; quando a pesquisa real não
 * confirma o suficiente, retorna menos itens (nunca genérico disfarçado de
 * específico).
 */
const SYSTEM_PROMPT =
  'Você é o Pesquisador de Campo da Ayon Creator. Sua função é pesquisar na web, usando a ferramenta de busca disponível, fatos REAIS e concretos relevantes para o objetivo de campanha informado — nomes de lugares, produtos, eventos, dados ou particularidades verificáveis, nunca generalidades inventadas com base em senso comum desatualizado do seu treinamento.\n' +
  'Se o objetivo pedir uma lista de itens específicos (ex.: "5 lugares para X", "os melhores Y"), pesquise e retorne itens REAIS, cada um com detalhes concretos e específicos do que esperar/por que se encaixa (nunca um item genérico só pra completar a contagem — se a busca não confirmar itens suficientes, retorne menos).\n' +
  'Se o objetivo não pedir uma lista, pesquise e retorne fatos/contexto real e atual que ajudem a fundamentar a estratégia (dados de mercado, notícias, particularidades reais do nicho) em vez de generalidades.\n' +
  'Responda SOMENTE com um JSON estrito, sem texto antes ou depois: {"findings": [{"name": "nome do item/fato pesquisado", "details": "2-4 frases concretas e específicas, com dados/nomes reais quando existirem", "source_url": "URL da fonte mais relevante, ou null se não houver uma única fonte clara"}], "summary": "síntese de 2-4 frases de tudo que foi encontrado, pronta para orientar quem for escrever a campanha"}. No máximo 10 itens.';

function buildUserMessage(request: CampaignResearchRequest): string {
  return `${buildTemporalContextBlock()}\n\nMarca: ${request.brandName}\nNicho de negócio: ${request.niche ?? "não informado"}\n\nObjetivo de campanha proposto pelo usuário:\n"${request.objective}"\n\nPesquise fatos reais e específicos que fundamentem esse objetivo de campanha.`;
}
