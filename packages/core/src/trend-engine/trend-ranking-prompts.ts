import { buildBrandContextBlock } from "../intelligence-hub/intelligence-hub-prompts";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import type { TrendCandidate } from "../providers/trend-source-provider";

/**
 * Blocos de contexto compartilhados entre especialistas e Coordinator para a
 * decisão `trend_ranking` (architecture.md §3.3) — mesmo espírito de
 * intelligence-hub-prompts.ts (código só monta contexto, persona vem do
 * `system_prompt` do Specialist Registry), mas com uma lista de candidatos de
 * tendência no lugar de um objetivo de campanha em texto livre.
 */
function buildCandidatesBlock(candidates: TrendCandidate[]): string {
  if (candidates.length === 0) return "Nenhum candidato de tendência foi encontrado nesta busca.";

  return candidates
    .map((candidate, index) => `${index + 1}. ${candidate.title} — ${candidate.summary}`)
    .join("\n");
}

export function buildTrendRankingSpecialistMessage(params: {
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  learnedPreferencesText?: string;
  candidates: TrendCandidate[];
}): string {
  return `${buildBrandContextBlock(params.brandName, params.knownFields, params.learnedPreferencesText)}\n\nCandidatos de tendência encontrados para o nicho desta marca (ainda não avaliados, nenhum é campanha ainda):\n${buildCandidatesBlock(params.candidates)}\n\nDê sua opinião especializada sobre quais destes candidatos, se algum, são genuinamente relevantes para esta marca especificamente — e por quê. Cite os candidatos pelo título.`;
}

export interface SuccessfulOpinionForTrendCoordinator {
  specialistName: string;
  opinion: string;
  rationale: string;
}

export function buildTrendRankingCoordinatorMessage(params: {
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  learnedPreferencesText?: string;
  candidates: TrendCandidate[];
  opinions: SuccessfulOpinionForTrendCoordinator[];
}): string {
  const opinionsText =
    params.opinions.length === 0
      ? "Nenhum especialista respondeu com sucesso desta vez."
      : params.opinions.map((o) => `- ${o.specialistName}: "${o.opinion}" (justificativa: ${o.rationale})`).join("\n");

  return `${buildBrandContextBlock(params.brandName, params.knownFields, params.learnedPreferencesText)}\n\nCandidatos de tendência encontrados:\n${buildCandidatesBlock(params.candidates)}\n\nOpiniões independentes dos especialistas:\n${opinionsText}\n\nConsolide isso em um ranqueamento final dos candidatos genuinamente relevantes para esta marca (do mais para o menos relevante). Descarte candidatos que nenhum especialista considerou relevantes. Se nenhum candidato for relevante, retorne uma lista vazia — nunca force um ranqueamento.\n\nResponda SOMENTE em JSON, sem texto antes ou depois, exatamente neste formato: {"rankings": [{"title": "título do candidato, igual ao que recebeu", "summary": "do que se trata, 1-2 frases", "rationale": "por que é relevante para esta marca especificamente, ancorado no Brand Brain e nas opiniões dos especialistas", "source_url": "URL da fonte, ou null"}], "overall_rationale": "visão geral de como você chegou a este ranqueamento, citando as opiniões dos especialistas"}.`;
}
