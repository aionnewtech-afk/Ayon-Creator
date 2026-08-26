import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { parseLlmJson } from "../shared/llm-json";
import { buildTemporalContextBlock } from "../shared/temporal-context";
import {
  TREND_CATEGORIES,
  type TrendCandidateSearchRequest,
  type TrendCandidateSearchResult,
  type TrendSourceProvider,
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
      max_tokens: 4096,
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
        category: candidate.category,
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
        category: z.enum(TREND_CATEGORIES),
      }),
    )
    .max(20),
});

/** ★ Mesmo pedido/categorias de gemini-web-search-trend-source-provider.ts — ver lá o comentário completo sobre a motivação. Mantido em paridade para a troca de fornecedor (LLM_PROVIDER) continuar reversível sem perder a categorização. */
const SYSTEM_PROMPT =
  'Você é o Trend Source Provider da Ayon Creator. Sua função é pesquisar na web, usando a ferramenta de busca disponível, sinais atuais e genuinamente relevantes para o nicho de negócio informado, organizados em 5 categorias fixas:\n' +
  '- "noticias": notícias reais e recentes diretamente relacionadas ao negócio/nicho do usuário.\n' +
  '- "pesquisas": pesquisas, dados e estatísticas de mercado/comportamento de consumo relevantes ao nicho.\n' +
  '- "redes_sociais": (1) assuntos/formatos/desafios em alta agora nas redes sociais (Instagram, TikTok, etc.) que conectam com o nicho, E (2) termos/consultas de busca em alta relacionados ao nicho (estilo Google Trends — o que as pessoas estão pesquisando agora sobre esse assunto). Inclua sinais dos dois tipos quando encontrar.\n' +
  '- "eventos": eventos e datas com significância real **em qualquer parte do mundo, não só no Brasil** — datas comemorativas/religiosas globais (ex.: Semana Santa, Natal, Ano Novo Chinês), grandes eventos esportivos/culturais internacionais (ex.: Copa do Mundo, Olimpíadas, um festival internacional relevante), sazonalidade global (ex.: verão no hemisfério norte) — só inclua um evento se ele tiver relação real com o nicho, nunca liste uma data só porque existe, e nunca restrinja a busca a um único país por padrão.\n' +
  '- "geral": qualquer outra tendência genuína do nicho que não se encaixa nas categorias acima.\n' +
  'Pesquise cada categoria separadamente, buscando sinais realmente atuais (não invente, não use senso comum desatualizado do seu treinamento — se a busca não confirmar algo recente, não inclua). Não avalie se o sinal combina com a marca especificamente — isso é responsabilidade do Intelligence Hub, não sua. Uma categoria pode ficar vazia (nunca invente um candidato só para preencher todas as 5). Depois de pesquisar, responda SOMENTE com um JSON estrito, sem texto antes ou depois: {"candidates": [{"title": "título curto", "summary": "do que se trata e por que é relevante para este nicho agora, 2-3 frases", "source_url": "URL da fonte mais relevante, ou null se não houver uma única fonte clara", "category": "noticias|pesquisas|redes_sociais|eventos|geral"}]}. No máximo 4 candidatos por categoria, no máximo 16 no total.';

/**
 * Achado real, sprint de estabilização: "Buscar novidades" sempre trazia as
 * mesmas tendências — a mensagem nunca dizia que dia era hoje (o modelo
 * caía no seu próprio senso de "atual", vindo do treino) nem o que já tinha
 * sido mostrado antes (nada incentivava variedade entre buscas). Os dois
 * corrigidos aqui, na mensagem por request — o `SYSTEM_PROMPT` (persona,
 * estático) não muda.
 */
function buildUserMessage(request: TrendCandidateSearchRequest): string {
  const excludeBlock =
    request.excludeTitles && request.excludeTitles.length > 0
      ? `\n\nTendências já mostradas ao usuário em buscas anteriores (evite repetir estas — procure sinais genuinamente novos, mas nunca invente algo só para variar):\n${request.excludeTitles.map((title) => `- ${title}`).join("\n")}`
      : "";

  return `${buildTemporalContextBlock()}\n\nNicho de negócio: ${request.niche}\nMarca (contexto, não filtro de pesquisa): ${request.brandName}\n\nPesquise tendências atuais (de verdade, de hoje) relevantes para este nicho.${excludeBlock}`;
}
