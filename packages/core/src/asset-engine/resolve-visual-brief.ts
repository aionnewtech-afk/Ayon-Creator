import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";
import { logger } from "../logger";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ContentPieceRepository } from "../repositories/content-piece.repository";

export interface VisualBrief {
  /** Resumo curto do tema da campanha (poucas palavras) — usado como título em thumbnail/stories/carousel (arch. §14.5). */
  shortTitle: string;
  /**
   * ★ Achado real (pedido direto do usuário — peça "genérica", "sem apelo
   * comercial"): um título sozinho não faz uma peça parecer publicitária.
   * Linha de apoio (1 frase, apelo emocional/comercial específico do tema),
   * exibida junto com `shortTitle` num bloco combinado (shotstack-video-render-provider.ts).
   */
  subheadline: string;
  /** Chamada para ação curta (ex.: "Fale com a gente no WhatsApp"). */
  ctaText: string;
}

/**
 * Resolve o `visual_brief` da campanha (arch. §14.4.3) — parâmetros de
 * composição decididos por IA **uma vez por campanha**, nunca peça a peça,
 * para toda peça visual gerada depois compartilhar a mesma identidade
 * (mesmo título curto, nunca um por peça). Idempotente: se já resolvido,
 * lê e devolve sem chamar o LLM de novo.
 *
 * ★ Achado real: quando o LLM falhava (ex.: conta do provider sem crédito),
 * o fallback (corte bruto de `campaign.title`) era **persistido** como se
 * fosse um resultado válido — a idempotência acima então nunca deixava a
 * campanha tentar de novo, mesmo depois do provider voltar a funcionar
 * (imagem real: título cortado no meio da palavra, "quero atrair mais
 * clientes com foco em v"). Corrigido: só persiste quando o LLM realmente
 * responde; a falha devolve o fallback só para esta chamada, sem gravar,
 * permitindo uma tentativa real na próxima peça gerada.
 */
export async function resolveVisualBrief(
  db: SupabaseClient<Database>,
  campaignId: string,
  llmProvider: LlmProvider,
): Promise<VisualBrief> {
  const campaignRepository = new CampaignRepository(db);
  const campaign = await campaignRepository.findById(campaignId);
  if (!campaign) return EMPTY_BRIEF;

  const existing = campaign.visual_brief as VisualBrief | null;
  if (existing?.shortTitle) return existing;

  const strategySummary = campaign.strategy_summary as { consolidated_strategy?: string } | null;
  // ★ Achado real (pedido direto do usuário — "o storie precisa ser uma
  // peça que seja um resumo do que tem no vídeo (do roteiro)"): antes, o
  // texto da peça visual só olhava pro objetivo/estratégia da campanha,
  // nunca pro roteiro (`content_pieces.script` da peça primária) — o
  // vídeo e as fotos podiam acabar contando histórias diferentes da mesma
  // campanha. Quando o roteiro já existe, ele vira a fonte principal (mais
  // concreto que a estratégia); a estratégia continua como contexto extra.
  const primaryPiece = await new ContentPieceRepository(db).findPrimaryByCampaignId(campaignId);
  const generated = await generateVisualBrief(
    campaign.title,
    strategySummary?.consolidated_strategy ?? null,
    primaryPiece?.script ?? null,
    llmProvider,
  );
  if (!generated) return fallbackVisualBrief(campaign.title);

  await campaignRepository.update(campaignId, { visual_brief: generated as unknown as Record<string, unknown> });

  return generated;
}

const EMPTY_BRIEF: VisualBrief = { shortTitle: "", subheadline: "", ctaText: "" };

/**
 * ★ Achado real (feedback direto sobre uma peça gerada): um título sozinho
 * ("2-5 palavras que resumem o objetivo") não tinha apelo nenhum de peça
 * publicitária — não dizia o assunto específico da campanha (ex.: "Natal")
 * nem soava como uma peça comercial de verdade, e a imagem virava "genérica,
 * nada a ver com o que pedi". Pedido direto do usuário: peça "mais
 * publicitária, com apelo comercial e emocional" — 3 campos agora, numa só
 * chamada (headline + linha de apoio + CTA), usando a estratégia consolidada
 * da campanha (não só o objetivo bruto) para ter contexto de verdade.
 */
async function generateVisualBrief(
  campaignTitle: string,
  consolidatedStrategy: string | null,
  script: string | null,
  llmProvider: LlmProvider,
): Promise<VisualBrief | null> {
  try {
    const strategyBlock = consolidatedStrategy ? `\n\nEstratégia consolidada desta campanha: "${consolidatedStrategy}"` : "";
    // ★ Achado real (pedido direto do usuário — stories tem que ser "um
    // resumo do que tem no vídeo"): roteiro completo quando existe — é a
    // fonte mais concreta e específica que a Ayon já escreveu pra essa
    // campanha, mais confiável que o objetivo bruto pra ancorar o texto da
    // peça visual num gancho/momento real da narrativa.
    const scriptBlock = script ? `\n\nRoteiro completo do vídeo desta campanha (a peça visual deve resumir/ecoar este mesmo gancho): "${script}"` : "";

    const result = await llmProvider.complete({
      system:
        'Você escreve o texto de uma peça publicitária (imagem de campanha), com apelo comercial e emocional real — nunca um resumo burocrático do objetivo. Quando o roteiro do vídeo da campanha estiver disponível, ele é a fonte principal: a peça visual precisa soar como um resumo/eco do MESMO gancho e momento concreto que o roteiro conta (não um tema genérico à parte) — vídeo e foto de uma campanha devem contar a mesma história, nunca histórias diferentes. Sempre que o roteiro ou a estratégia mencionar um tema/ocasião/destino concreto (ex.: Natal, fim de ano, verão, um destino específico), o texto precisa citar esse tema diretamente, nunca ficar genérico. Nunca copie o objetivo literal digitado pelo usuário. Gere 3 campos: "shortTitle" (headline curta, no máximo ~6 palavras, cabe em 1-2 linhas), "subheadline" (1 frase de apoio, reforça o benefício/gancho emocional do roteiro), "ctaText" (chamada para ação bem curta, 3-5 palavras, ex.: "Fale com a gente agora"). Responda SOMENTE com JSON: {"shortTitle": "...", "subheadline": "...", "ctaText": "..."}.',
      messages: [{ role: "user", content: `Objetivo da campanha: ${campaignTitle}${strategyBlock}${scriptBlock}` }],
      // ★ Achado real (validação): budgets pequenos (60-128) são insuficientes
      // para o Gemini 3 — mesmo com `reasoning_effort: "low"` (gemini-llm-provider.ts),
      // o gasto residual de "pensamento" corta a resposta antes do JSON
      // fechar. 3 campos agora em vez de 1; folga maior ainda.
      maxTokens: 500,
    });

    const parsed = parseLlmJson(result.text) as Partial<VisualBrief>;
    if (parsed.shortTitle) {
      return {
        shortTitle: parsed.shortTitle,
        subheadline: parsed.subheadline ?? "",
        ctaText: parsed.ctaText ?? "",
      };
    }

    logger.warn("asset_engine.generate_visual_brief.unexpected_response", { rawText: result.text });
  } catch (error) {
    logger.warn("asset_engine.generate_visual_brief.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

/** Só usado em memória quando o LLM falha (nunca persistido — ver comentário acima) — corta na última palavra inteira, nunca no meio, sem subheadline/CTA (melhor não afirmar nada do que inventar). */
function fallbackVisualBrief(campaignTitle: string): VisualBrief {
  const sliced = campaignTitle.slice(0, 40);
  const lastSpace = sliced.lastIndexOf(" ");
  return { shortTitle: (lastSpace > 10 ? sliced.slice(0, lastSpace) : sliced).trim(), subheadline: "", ctaText: "" };
}
