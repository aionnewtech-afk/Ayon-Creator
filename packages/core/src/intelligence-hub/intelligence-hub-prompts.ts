import { ONBOARDING_QUESTION_LABELS } from "../brand-brain/onboarding-themes";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";

/**
 * Blocos de contexto compartilhados entre especialistas e Coordinator. A
 * persona/comportamento de cada um vem do `system_prompt` do Specialist
 * Registry (dado, não código) — o que é código aqui é só a injeção do
 * contexto de marca, igual para todo mundo (architecture.md §4.1).
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

  return `Marca: ${brandName}\n\nO que sabemos sobre a marca:\n${fieldsText}${preferencesBlock}`;
}

export function buildSpecialistUserMessage(params: {
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  learnedPreferencesText?: string;
  objective: string;
}): string {
  return `${buildBrandContextBlock(params.brandName, params.knownFields, params.learnedPreferencesText)}\n\nObjetivo de campanha proposto pelo usuário:\n"${params.objective}"\n\nDê sua opinião especializada sobre esse objetivo de campanha, seguindo as regras do seu papel.`;
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
}): string {
  const opinionsText =
    params.opinions.length === 0
      ? "Nenhum especialista respondeu com sucesso desta vez."
      : params.opinions.map((o) => `- ${o.specialistName}: "${o.opinion}" (justificativa: ${o.rationale})`).join("\n");

  return `${buildBrandContextBlock(params.brandName, params.knownFields, params.learnedPreferencesText)}\n\nObjetivo de campanha proposto pelo usuário:\n"${params.objective}"\n\nOpiniões independentes dos especialistas:\n${opinionsText}\n\nConsolide isso em uma única estratégia coerente para esta campanha.\n\nResponda SOMENTE em JSON, sem texto antes ou depois, exatamente neste formato: {"consolidated_strategy": "a estratégia final, 3-5 frases", "rationale": "por que essa síntese, citando as opiniões dos especialistas e o Brand Brain", "divergences": "descrição de divergências resolvidas entre especialistas, ou null se convergiram"}.`;
}
