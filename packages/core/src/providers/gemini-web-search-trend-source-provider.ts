import { z } from "zod";
import { parseLlmJson } from "../shared/llm-json";
import { buildTemporalContextBlock } from "../shared/temporal-context";
import { fetchWithRetry } from "../shared/fetch-with-retry";
import {
  TREND_CATEGORIES,
  type TrendCandidateSearchRequest,
  type TrendCandidateSearchResult,
  type TrendSourceProvider,
} from "./trend-source-provider";

const GEMINI_NATIVE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Adapter concreto do Trend Source Provider (architecture.md §3.3) sobre a
 * busca web nativa do Gemini ("Grounding with Google Search", `tools:
 * [{google_search:{}}]`) — troca temporária de fornecedor (conta Anthropic
 * sem créditos). Único arquivo do monorepo que chama a API **nativa** do
 * Gemini (não a camada OpenAI-compatible usada em `gemini-llm-provider.ts`)
 * — achado real, verificado direto na API: a busca web/grounding do Gemini
 * não é exposta pela camada OpenAI-compatible (erro "Invalid tool type"
 * para qualquer variante testada), só pela API nativa
 * (`:generateContent` + `tools: [{google_search:{}}]`).
 *
 * Mesmo `SYSTEM_PROMPT`/`buildUserMessage`/schema de resposta de
 * `anthropic-web-search-trend-source-provider.ts` (duplicados aqui, não
 * extraídos para um módulo compartilhado — mesmo padrão já usado entre os
 * adapters de LLM, cada um é auto-contido) — o comportamento (tendências
 * atuais, contexto temporal, exclusão de repetidas, formato de resposta)
 * é idêntico, só a transporte HTTP muda. `resolveTrendSourceProvider`
 * (provider-gateway.ts) decide qual dos dois fica ativo.
 */
export class GeminiWebSearchTrendSourceProvider implements TrendSourceProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
  ) {}

  async findCandidates(request: TrendCandidateSearchRequest): Promise<TrendCandidateSearchResult> {
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
        // ★ Achado real (validação com busca real): resultados de busca
        // variam de tamanho a cada chamada — 2048 (mesmo limite do adapter
        // Anthropic) truncou o JSON no meio em pelo menos uma execução real,
        // mesmo a API nativa não descontando tokens de "pensamento" deste
        // limite (`thoughtsTokenCount` reportado à parte). Margem maior
        // ainda agora que a busca cobre 5 categorias (mais candidatos por
        // resposta) — sem tocar o limite do adapter Anthropic (arquivo
        // separado, intocado).
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Gemini (busca de tendências) respondeu ${response.status}: ${errorBody}`);
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = (payload.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("\n");

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

/**
 * ★ Achado real (pedido direto do usuário): uma lista única de "tendências"
 * não engajava — pedido explícito de separar por tipo de sinal (notícias,
 * pesquisas de mercado, redes sociais, eventos/datas com significância,
 * tendências gerais), citando Copa do Mundo e Semana Santa como exemplos de
 * "eventos com significância" que devem ser considerados mesmo sem serem
 * uma "tendência" no sentido tradicional. Uma única chamada de busca ainda
 * cobre as 5 categorias (a ferramenta de busca do Gemini já dispara várias
 * pesquisas dentro da mesma chamada, confirmado real: `webSearchQueries`
 * retornou 5 buscas distintas numa única resposta durante a validação) —
 * mais barato e mais rápido que 5 chamadas separadas, uma por categoria.
 *
 * ★ Achado real #2 (feedback direto sobre uma busca real): "eventos" vinha
 * quase sempre enviesado para o Brasil (viés natural do idioma/contexto da
 * busca) — pedido explícito para nível global. "redes_sociais" passa a
 * cobrir também termos de busca em alta (estilo Google Trends), não só
 * redes sociais — mesmo pedido direto do usuário.
 */
const SYSTEM_PROMPT =
  'Você é o Trend Source Provider da Ayon Creator. Sua função é pesquisar na web, usando a ferramenta de busca disponível, sinais atuais e genuinamente relevantes para o nicho de negócio informado, organizados em 5 categorias fixas:\n' +
  '- "noticias": notícias reais e recentes diretamente relacionadas ao negócio/nicho do usuário.\n' +
  '- "pesquisas": pesquisas, dados e estatísticas de mercado/comportamento de consumo relevantes ao nicho.\n' +
  '- "redes_sociais": (1) assuntos/formatos/desafios em alta agora nas redes sociais (Instagram, TikTok, etc.) que conectam com o nicho, E (2) termos/consultas de busca em alta relacionados ao nicho (estilo Google Trends — o que as pessoas estão pesquisando agora sobre esse assunto). Inclua sinais dos dois tipos quando encontrar.\n' +
  '- "eventos": eventos e datas com significância real **em qualquer parte do mundo, não só no Brasil** — datas comemorativas/religiosas globais (ex.: Semana Santa, Natal, Ano Novo Chinês), grandes eventos esportivos/culturais internacionais (ex.: Copa do Mundo, Olimpíadas, um festival internacional relevante), sazonalidade global (ex.: verão no hemisfério norte) — só inclua um evento se ele tiver relação real com o nicho, nunca liste uma data só porque existe, e nunca restrinja a busca a um único país por padrão.\n' +
  '- "geral": qualquer outra tendência genuína do nicho que não se encaixa nas categorias acima.\n' +
  'Pesquise cada categoria separadamente, buscando sinais realmente atuais (não invente, não use senso comum desatualizado do seu treinamento — se a busca não confirmar algo recente, não inclua). Não avalie se o sinal combina com a marca especificamente — isso é responsabilidade do Intelligence Hub, não sua. Uma categoria pode ficar vazia (nunca invente um candidato só para preencher todas as 5). Depois de pesquisar, responda SOMENTE com um JSON estrito, sem texto antes ou depois: {"candidates": [{"title": "título curto", "summary": "do que se trata e por que é relevante para este nicho agora, 2-3 frases", "source_url": "URL da fonte mais relevante, ou null se não houver uma única fonte clara", "category": "noticias|pesquisas|redes_sociais|eventos|geral"}]}. No máximo 4 candidatos por categoria, no máximo 16 no total.';

function buildUserMessage(request: TrendCandidateSearchRequest): string {
  const excludeBlock =
    request.excludeTitles && request.excludeTitles.length > 0
      ? `\n\nTendências já mostradas ao usuário em buscas anteriores (evite repetir estas — procure sinais genuinamente novos, mas nunca invente algo só para variar):\n${request.excludeTitles.map((title) => `- ${title}`).join("\n")}`
      : "";

  return `${buildTemporalContextBlock()}\n\nNicho de negócio: ${request.niche}\nMarca (contexto, não filtro de pesquisa): ${request.brandName}\n\nPesquise tendências atuais (de verdade, de hoje) relevantes para este nicho.${excludeBlock}`;
}
