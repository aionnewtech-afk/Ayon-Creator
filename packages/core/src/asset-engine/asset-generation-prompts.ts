import { buildBrandContextBlock } from "../intelligence-hub/intelligence-hub-prompts";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import type { ContentPieceFormat } from "@ayon/types";

/**
 * Prompts do Asset Engine (architecture.md §3.5, docs/engine-behavior.md
 * §5) para os formatos textuais do MVP da Missão 7. Peça derivada reaproveita
 * a estratégia já consolidada da campanha, sem novo painel de especialistas
 * (Fluxo 3, §3.1) — mesmo espírito de "código só monta contexto, comportamento
 * vem do prompt" já usado no Brand Brain e no Intelligence Hub.
 */
const FORMAT_INSTRUCTIONS: Record<ContentPieceFormat, string> = {
  caption:
    "Formato: legenda de rede social. Curta (2-4 frases), com uma ideia central clara e, quando fizer sentido, uma chamada para ação. Nunca genérica — precisa soar como a marca especificamente.",
  blog_post:
    "Formato: post de blog. Mais longo e estruturado (introdução, 2-3 parágrafos de desenvolvimento, conclusão com próximo passo). Tom consistente com o `tone_of_voice` da marca do início ao fim.",
  email:
    "Formato: e-mail de marketing. Inclua um assunto (linha separada, prefixado por 'Assunto:') e o corpo do e-mail. Direto, sem enrolação, terminando com uma ação clara.",
  script:
    // ★ Achado real: este texto vai DIRETO para o Voice Provider (ElevenLabs)
    // como narração, sem nenhuma edição humana no meio — a instrução antiga
    // ("Estruturado por cena/bloco, ex.: 'Abertura:'") levava o LLM a incluir
    // rótulos de cena e direções de cenário entre parênteses/colchetes
    // (ex.: "(Cenário: ambiente aconchegante...)"), que a narração então lia
    // em voz alta literalmente. Formato agora pede só o texto falado puro.
    "Formato: texto de narração do vídeo principal da campanha, sintetizado por voz de IA sem nenhuma edição humana depois. Escreva SOMENTE as palavras exatas que serão faladas em voz alta, como um texto corrido e natural — nunca inclua rótulo de cena/bloco, indicação de cenário, direção visual, nome de personagem ou qualquer texto entre parênteses/colchetes (nunca algo como '(Cenário: ...)', '[Abertura]', 'Visual:', 'Locução:'), porque tudo isso seria narrado literalmente. Use quebra de parágrafo só para marcar uma pausa natural na fala, nunca para separar 'cenas'.",
  teleprompter:
    "Formato: versão para teleprompter do roteiro da campanha. Frases curtas, pontuação que indica pausas naturais, linguagem falada (nunca formal/escrita) — precisa ser fácil de ler em voz alta sem tropeçar.",
  // Formatos visuais (own_media, MVP) não passam por geração de texto — nunca chamados com estas instruções.
  video: "",
  stories: "",
  carousel: "",
  thumbnail: "",
};

export function buildAssetGenerationSystemPrompt(format: ContentPieceFormat): string {
  return `Você é o Asset Engine da Ayon Creator, gerando uma peça de conteúdo derivada de uma estratégia de campanha já aprovada. ${FORMAT_INSTRUCTIONS[format]} Regras permanentes: use sempre o tom de voz e as palavras favoritas da marca (Brand Brain), nunca use uma palavra proibida. Nunca invente especificação de produto, preço ou prazo que não veio do contexto fornecido — se a informação não existe, seja genérico o suficiente para não afirmar algo falso. Coerência com a mensagem central da estratégia é obrigatória. Responda SOMENTE em JSON, sem texto antes ou depois: {"content": "o texto da peça, já pronto para uso", "rationale": "por que essa peça reflete a marca, 1-3 frases, citando algo específico do Brand Brain ou da estratégia"}.`;
}

export function buildAssetGenerationUserMessage(params: {
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  learnedPreferencesText?: string;
  consolidatedStrategy: string;
  strategyRationale: string;
  format: ContentPieceFormat;
}): string {
  return `${buildBrandContextBlock(params.brandName, params.knownFields, params.learnedPreferencesText)}\n\nEstratégia consolidada desta campanha:\n"${params.consolidatedStrategy}"\n\nPor que essa estratégia foi definida assim:\n"${params.strategyRationale}"\n\nGere a peça no formato indicado no seu papel, reaproveitando essa estratégia — não invente uma direção nova.`;
}
