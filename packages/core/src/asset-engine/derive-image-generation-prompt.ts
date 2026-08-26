import { logger } from "../logger";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";

const FALLBACK_COMPOSITION_SUFFIX =
  "Photorealistic, high-end commercial advertising photography, vertical 9:16 portrait composition, clear open " +
  "uncluttered space in the upper third of the frame for text overlay, no text, no logos, no watermarks in the image.";

/**
 * ★ Achado real (pedido direto do usuário — "ainda tá amador, simples
 * demais... ou ele cria a imagem e você inclui o texto"): comparando a peça
 * composta (foto + painel sólido via `renderPanel`, retângulo SVG genérico)
 * com o que o usuário via como referência de agência, o gargalo não era
 * mais contraste/hierarquia (já corrigido antes) — era o painel em si,
 * nunca desenhado, sempre um bloco de cor chapada. Pedido explícito do
 * usuário: deixar o próprio gerador de imagem desenhar a peça inteira
 * (foto + zona de painel com tratamento gráfico real — gradiente, textura,
 * elemento decorativo), o texto continua sendo sobreposto depois por
 * `composeImage` (sempre 100% correto — nunca risco de erro de ortografia
 * do modelo de imagem). Concatenado em código (nunca pedido "verbatim" ao
 * LLM como antes) — garante que a instrução crítica de "sem texto no
 * painel" sempre chega ao gerador de imagem, mesmo se o LLM que escreve a
 * cena esquecer de repeti-la.
 */
export function buildDesignedPanelSuffix(primaryColorHex: string | null, secondaryColorHex: string | null): string {
  const panelColor = secondaryColorHex ?? primaryColorHex;
  const colorInstruction = panelColor
    ? `using this exact brand color as its base: ${panelColor} (a tasteful gradient or subtle texture derived from ` +
      "this color is welcome, but the color family must stay true to it)"
    : "using a color that harmonizes with the photo's own palette";

  return (
    " This is not just a background photo — it is the COMPLETE bottom-anchored creative for a vertical 9:16 " +
    "social media ad. The top ~55-60% of the frame is the photographic scene described above. The bottom ~40-45% " +
    `of the frame must be a designed graphic panel — solid or gradient color block, ${colorInstruction} — with a ` +
    "tasteful, professional graphic treatment (soft gradient, subtle geometric or organic pattern, a thin " +
    "decorative accent line, or a gentle light/shadow effect): it must look like a deliberately art-directed ad " +
    "panel, NEVER a flat plain rectangle with nothing on it. The transition between the photo and the panel should " +
    "blend smoothly (a soft gradient fade), not a hard visible seam. CRITICAL: this panel area must remain " +
    "completely EMPTY of any text, letters, words, numbers, or typography of any kind — headline, subheadline and " +
    "call-to-action text will be added separately on top of it afterward, so any text the model draws here would " +
    "just have to be painted over. No logos, no watermarks anywhere in the image."
  );
}

const SYSTEM_PROMPT =
  "You write a single English prompt for an AI image generator, describing the photographic SCENE half of a real " +
  "advertising campaign piece — never a generic stock-photo description, a photorealistic commercial photograph " +
  "with genuine emotional/commercial appeal that matches the specific campaign theme (occasion, destination, " +
  "audience, mood). Always translate/adapt the campaign context (it may be in Portuguese) into English. Be " +
  "concrete and specific about the real scene (place, activity, people, lighting, season) — never abstract " +
  'business jargon like "planning" or "strategy". When the campaign\'s video script is provided, it is the ' +
  "primary source — depict a concrete moment/hook straight from that same script, so the photo and the video feel " +
  "like the same campaign telling the same story, never a separate generic theme. " +
  // ★ Achado real (pedido direto do usuário — stories "sempre ruins, diferentes
  // do que pedi"): comparando 2 gerações reais lado a lado, a mesma instrução
  // "be concrete and specific" às vezes produzia um cenário genuinamente
  // nomeado ("Santorini... blue domes of Oia") e às vezes um terraço
  // litorâneo genérico sem NENHUM traço do destino real — e quando o prompt
  // nomeava o lugar de verdade, a imagem gerada acompanhava fielmente
  // (validado real, mesmo destino, mesma chamada de geração). A causa raiz
  // não era a geração de imagem, era a escrita do prompt não ser
  // consistentemente específica. Regra explícita agora, não mais "sugestão".
  "CRITICAL: if the campaign theme or strategy names a specific destination/place (a city, region, country, or " +
  "landmark), you MUST name a real, recognizable, geographically accurate landmark or visual signature of that " +
  "exact place in the scene (e.g. for Santorini: whitewashed buildings and blue domes overlooking the caldera; " +
  "for Paris: the Eiffel Tower or Haussmannian architecture; for Rio de Janeiro: Christ the Redeemer or Copacabana " +
  "beachfront) — never a generic beach/terrace/cityscape that could be anywhere in the world. If no specific " +
  "destination is named, ground the scene in a concrete real-world setting that fits the niche instead of an " +
  'abstract one. Describe ONLY the photographic scene — composition instructions for the rest of the ad piece ' +
  'are appended separately, never write them yourself. Reply ONLY with JSON in the format {"imagePrompt": "..."}.';

/**
 * ★ Achado real (pedido direto do usuário): "as imagens de feed e storie
 * acho que ficam melhores se elas forem criadas pelo Gemini" — a busca por
 * foto de banco (`derivePhotoSearchQuery`, 2-4 palavras-chave) é boa o
 * bastante pra achar uma foto real que combine com o tema, mas não carrega
 * apelo comercial/emocional nenhum (o próprio pedido anterior do usuário,
 * já resolvido em `resolve-visual-brief.ts`). Geração de imagem pede o
 * oposto: uma cena inteira, descrita com intenção publicitária real — por
 * isso uma derivação própria, reaproveitando a `consolidated_strategy` da
 * campanha (mesmo contexto já usado pelo `visual_brief`) em vez do tema
 * bruto. Mesma rede de segurança das outras derivações por LLM: falha nunca
 * bloqueia o pipeline, cai num prompt de fallback determinístico.
 */
export async function deriveImageGenerationPrompt(params: {
  theme: string;
  consolidatedStrategy: string | null;
  nicheOverride: string | null;
  llmProvider: LlmProvider;
  fallbackQuery: string;
  /**
   * ★ Achado real (pedido direto do usuário — "o storie precisa ser uma
   * peça que seja um resumo do que tem no vídeo, do roteiro"): roteiro
   * completo do vídeo da campanha, quando existe — a cena gerada deve
   * retratar um momento/gancho concreto do MESMO roteiro, não um tema à
   * parte. Opcional: `video-pipeline-scenes.ts` já passa o trecho do
   * roteiro como `theme` diretamente, não precisa deste campo de novo.
   */
  script?: string | null;
  /** ★ Repassadas pro painel desenhado (`buildDesignedPanelSuffix`) — cor de marca real em vez de uma cor genérica escolhida pelo modelo. */
  brandPrimaryColorHex?: string | null;
  brandSecondaryColorHex?: string | null;
}): Promise<string> {
  const panelSuffix = buildDesignedPanelSuffix(params.brandPrimaryColorHex ?? null, params.brandSecondaryColorHex ?? null);

  try {
    const strategyBlock = params.consolidatedStrategy
      ? `\n\nEstratégia consolidada da campanha: "${params.consolidatedStrategy}"`
      : "";
    const scriptBlock = params.script
      ? `\n\nRoteiro completo do vídeo desta campanha (a cena deve retratar um momento/gancho concreto deste mesmo roteiro): "${params.script}"`
      : "";
    const overrideBlock = params.nicheOverride
      ? `\n\nO usuário pediu especificamente esta ideia de imagem: "${params.nicheOverride}"`
      : "";

    const result = await params.llmProvider.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Tema da campanha: ${params.theme}${strategyBlock}${scriptBlock}${overrideBlock}` }],
      // ★ Mesmo achado real de derive-photo-search-query.ts/resolve-visual-brief.ts:
      // budgets pequenos cortam a resposta do Gemini 3 antes do JSON fechar.
      // Prompt aqui é mais longo que o de busca (cena inteira, não 2-4 palavras).
      maxTokens: 600,
    });

    const parsed = parseLlmJson(result.text) as { imagePrompt?: string };
    if (parsed.imagePrompt) return `${parsed.imagePrompt}${panelSuffix}`;

    logger.warn("asset_engine.derive_image_generation_prompt.unexpected_response", { rawText: result.text });
  } catch (error) {
    logger.warn("asset_engine.derive_image_generation_prompt.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return `Photorealistic commercial advertising photograph: ${params.fallbackQuery}. ${FALLBACK_COMPOSITION_SUFFIX}${panelSuffix}`;
}
