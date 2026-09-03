import { ONBOARDING_QUESTION_LABELS } from "../brand-brain/onboarding-themes";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import { buildTemporalContextBlock } from "../shared/temporal-context";

/**
 * Blocos de contexto compartilhados entre especialistas e Coordinator. A
 * persona/comportamento de cada um vem do `system_prompt` do Specialist
 * Registry (dado, não código) — o que é código aqui é só a injeção do
 * contexto de marca, igual para todo mundo (architecture.md §4.1).
 * `buildTemporalContextBlock` vive em `shared/temporal-context.ts` (exportado
 * pelo barrel de lá, não daqui) porque também é usado pelo Provider Layer.
 */

/**
 * Reaproveitado também pelo Trend Engine (trend-ranking-prompts.ts) e pelo
 * Learning Engine (learning-engine-prompts.ts) — mesmo bloco de contexto de
 * marca para qualquer decisão do Intelligence Hub. `learnedPreferencesText`
 * ★ Missão 8 — aprendizados do Brand Evolution já aceitos pelo cliente
 * (`learnedPreferencesTextFromProfile`, onboarding-themes.ts); `undefined`
 * enquanto a marca não tiver nenhum aceito ainda.
 */
export function buildBrandContextBlock(brandName: string, knownFields: KnownFieldsSnapshot[], learnedPreferencesText?: string): string {
  const fieldsText =
    knownFields.length === 0
      ? "Nada registrado ainda sobre esta marca."
      : knownFields.map((f) => `- ${ONBOARDING_QUESTION_LABELS[f.questionKey]}: ${f.value}`).join("\n");

  const preferencesBlock = learnedPreferencesText
    ? `\n\nAprendizados aplicados anteriormente (Brand Evolution, aceitos pelo cliente — leve isso em conta como preferência real da marca):\n${learnedPreferencesText}`
    : "";

  return `${buildTemporalContextBlock()}\n\nMarca: ${brandName}\n\nO que sabemos sobre a marca:\n${fieldsText}${preferencesBlock}`;
}

/**
 * Achado real, sprint de estabilização: opiniões de especialista vinham
 * longas demais (o `system_prompt` de cada especialista, dado no Specialist
 * Registry, não instruía objetividade) — reforçado aqui, uma vez, em vez de
 * editar o prompt de cada especialista individualmente no banco.
 */
const BREVITY_INSTRUCTION =
  "Seja objetivo: opinion em no máximo 2-3 frases diretas (sem repetir o objetivo do usuário), rationale em no máximo 1-2 frases.";

/** ★ Achado real (pedido direto do usuário — "a pesquisa tem que de fato valer a pena"): quando `researchCampaignObjective` encontra fatos reais, os especialistas/Coordinator precisam citá-los de verdade, não só saber que existem. */
function buildResearchBlock(researchNotes?: string): string {
  return researchNotes
    ? `\n\n${researchNotes}\n\nUse esses fatos concretos na sua resposta (cite nomes/dados reais) — nunca ignore a pesquisa em favor de generalidades.`
    : "";
}

export function buildSpecialistUserMessage(params: {
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  learnedPreferencesText?: string;
  objective: string;
  researchNotes?: string;
}): string {
  return `${buildBrandContextBlock(params.brandName, params.knownFields, params.learnedPreferencesText)}\n\nObjetivo de campanha proposto pelo usuário:\n"${params.objective}"${buildResearchBlock(params.researchNotes)}\n\nDê sua opinião especializada sobre esse objetivo de campanha, seguindo as regras do seu papel. ${BREVITY_INSTRUCTION}`;
}

export interface SuccessfulOpinionForCoordinator {
  specialistName: string;
  opinion: string;
  rationale: string;
}

export function buildCoordinatorUserMessage(params: {
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  learnedPreferencesText?: string;
  objective: string;
  opinions: SuccessfulOpinionForCoordinator[];
  researchNotes?: string;
}): string {
  const opinionsText =
    params.opinions.length === 0
      ? "Nenhum especialista respondeu com sucesso desta vez."
      : params.opinions.map((o) => `- ${o.specialistName}: "${o.opinion}" (justificativa: ${o.rationale})`).join("\n");

  // ★ Achado real: o ponto de falha real não é a pesquisa existir, é o
  // Coordinator "resumir" os fatos concretos até sumirem — "5 destinos reais"
  // vira "destinos incríveis" na consolidação. `consolidated_strategy`
  // precisa preservar nomes/dados citados pelos especialistas, não só a
  // vibe.
  const researchInstruction = params.researchNotes
    ? " A pesquisa real trazida pelos especialistas tem fatos concretos (nomes, dados) — preserve-os em `consolidated_strategy`, nunca resuma até virarem genéricos."
    : "";

  return `${buildBrandContextBlock(params.brandName, params.knownFields, params.learnedPreferencesText)}\n\nObjetivo de campanha proposto pelo usuário:\n"${params.objective}"${buildResearchBlock(params.researchNotes)}\n\nOpiniões independentes dos especialistas:\n${opinionsText}\n\nConsolide isso em uma única estratégia coerente para esta campanha.${researchInstruction} ${BREVITY_INSTRUCTION}\n\nResponda SOMENTE em JSON, sem texto antes ou depois, exatamente neste formato: {"executive_summary": "1 frase direta, o essencial da estratégia para quem só vai ler isso", "consolidated_strategy": "a estratégia final, 3-5 frases objetivas", "rationale": "por que essa síntese, citando as opiniões dos especialistas e o Brand Brain, no máximo 2-3 frases", "divergences": "descrição objetiva de divergências resolvidas entre especialistas, ou null se convergiram"}.`;
}
