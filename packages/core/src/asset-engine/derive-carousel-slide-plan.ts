import { logger } from "../logger";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";

export const CAROUSEL_SLIDE_COUNT = 4;

export interface CarouselSlide {
  /** Headline curta da lâmina (cabe em 1-2 linhas, mesmo espírito do `shortTitle` do visual_brief). */
  headline: string;
  /** 1 frase de apoio — vazia só na última lâmina, que usa `ctaText` no lugar. */
  body: string;
  /** Tema visual concreto da lâmina (lugar/cena/atividade), em inglês — usado só para gerar/buscar a foto de fundo, nunca mostrado ao usuário. */
  imageTheme: string;
}

const SYSTEM_PROMPT =
  "You write the slide-by-slide plan for an Instagram carousel ad — a real narrative arc across " +
  `${CAROUSEL_SLIDE_COUNT} slides, never ${CAROUSEL_SLIDE_COUNT} disconnected captions. Slide 1 is the hook ` +
  "(grabs attention, states the core promise). The middle slides each deliver ONE concrete benefit/value point " +
  "(never repeat the hook, never stay abstract — ground each in a specific detail from the campaign strategy). " +
  "The last slide is the call to action (short, direct, e.g. \"Fale com a gente agora\"). When the campaign's " +
  "video script is provided, it is the primary source of the narrative arc — the carousel should feel like a " +
  "visual summary/echo of that same script's hook and concrete details, so the video and the carousel tell the " +
  "same story, never two disconnected ones. For each slide, write: " +
  '"headline" (short, ~6 words max, in Portuguese), "body" (1 short supporting sentence in Portuguese — empty ' +
  'string on the last slide only, its CTA goes in "headline" instead), and "imageTheme" (a short, concrete, ' +
  "visual scene description IN ENGLISH for that specific slide — a real place/activity/moment that matches THAT " +
  "slide's point, never a generic repeat of the same scene across slides, never abstract business imagery). " +
  `Reply ONLY with JSON: {"slides": [{"headline": "...", "body": "...", "imageTheme": "..."}, ...]}, exactly ${CAROUSEL_SLIDE_COUNT} items.`;

/**
 * ★ Achado real (pedido direto do usuário — "o carrossel só gera um e é mal
 * feito"): o pipeline de foto tratava `carousel` exatamente como
 * `thumbnail`/`stories` — 1 imagem quadrada só, título+subheadline+CTA
 * genéricos repetidos, nunca um carrossel de verdade (várias lâminas
 * formando uma narrativa). Este passo novo gera o roteiro das lâminas
 * (`selectPhotoCandidates`/`composePhotoContentPiece` usam 1 lâmina por
 * candidato, cada uma com seu próprio tema visual e texto) — mesma rede de
 * segurança de toda derivação por LLM deste engine: falha nunca bloqueia o
 * pipeline, cai num roteiro de fallback determinístico (`fallbackSlides`).
 */
export async function deriveCarouselSlidePlan(params: {
  campaignTitle: string;
  consolidatedStrategy: string | null;
  /** ★ Achado real (pedido direto do usuário — "o storie precisa ser uma peça que seja um resumo do que tem no vídeo"): mesmo princípio aplicado ao carrossel — roteiro completo do vídeo, quando existe, vira a fonte principal da narrativa das lâminas. */
  script?: string | null;
  fallbackQuery: string;
  llmProvider: LlmProvider;
}): Promise<CarouselSlide[]> {
  try {
    const strategyBlock = params.consolidatedStrategy
      ? `\n\nEstratégia consolidada da campanha: "${params.consolidatedStrategy}"`
      : "";
    const scriptBlock = params.script
      ? `\n\nRoteiro completo do vídeo desta campanha (o carrossel deve resumir/ecoar esta mesma narrativa): "${params.script}"`
      : "";

    const result = await params.llmProvider.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Objetivo da campanha: ${params.campaignTitle}${strategyBlock}${scriptBlock}` }],
      // ★ Mesmo achado real de derive-image-generation-prompt.ts/resolve-visual-brief.ts:
      // budgets pequenos cortam a resposta do Gemini 3 antes do JSON fechar —
      // aqui a resposta tem 4 objetos, folga maior ainda.
      maxTokens: 900,
    });

    const parsed = parseLlmJson(result.text) as { slides?: CarouselSlide[] };
    if (parsed.slides?.length === CAROUSEL_SLIDE_COUNT && parsed.slides.every((s) => s.headline && s.imageTheme)) {
      return parsed.slides;
    }

    logger.warn("asset_engine.derive_carousel_slide_plan.unexpected_response", { rawText: result.text });
  } catch (error) {
    logger.warn("asset_engine.derive_carousel_slide_plan.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return fallbackSlides(params.campaignTitle, params.fallbackQuery);
}

/** Só usado em memória quando o LLM falha (nunca persistido) — pior caso vira 4 lâminas genéricas, nunca uma falha do pipeline. */
function fallbackSlides(campaignTitle: string, fallbackQuery: string): CarouselSlide[] {
  return [
    { headline: campaignTitle.slice(0, 40), body: "", imageTheme: fallbackQuery },
    { headline: "Por que agora", body: "O momento certo para aproveitar.", imageTheme: fallbackQuery },
    { headline: "O que você ganha", body: "Uma experiência pensada para você.", imageTheme: fallbackQuery },
    { headline: "Fale com a gente agora", body: "", imageTheme: fallbackQuery },
  ];
}
