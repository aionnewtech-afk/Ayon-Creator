import type { Database, OnboardingQuestionKey } from "@ayon/types";
import { ONBOARDING_QUESTION_LABELS, allQuestionKeys, profileFieldValue } from "./onboarding-themes";

type BrandBrainProfileRow = Database["public"]["Tables"]["brand_brain_profiles"]["Row"];
type BrandOnboardingAnswerRow = Database["public"]["Tables"]["brand_onboarding_answers"]["Row"];

export interface SynthesisFieldEntry {
  questionKey: OnboardingQuestionKey;
  label: string;
  /** Síntese atual da Ayon para o campo — null se nunca preenchido/pulado. */
  value: string | null;
  /** Citação literal mais recente do usuário para este campo, se houver. */
  quote: string | null;
}

/**
 * Monta a síntese exibida em ONB-3 ("O que a Ayon entendeu até agora") sem
 * nenhuma chamada extra de IA — os campos de `brand_brain_profiles` já são a
 * síntese da Ayon; `brand_onboarding_answers` fornece a citação original
 * como lastro (ux-design.md §4.2).
 */
export function buildOnboardingSynthesis(
  profile: BrandBrainProfileRow,
  answers: BrandOnboardingAnswerRow[],
): SynthesisFieldEntry[] {
  const latestQuoteByKey = new Map<OnboardingQuestionKey, string>();
  for (const answer of answers) {
    // `answers` vem ordenado do mais antigo para o mais recente — a última
    // atribuição a cada chave preserva a citação mais recente.
    latestQuoteByKey.set(answer.question_key, answer.answer_text);
  }

  return allQuestionKeys().map((questionKey) => ({
    questionKey,
    label: ONBOARDING_QUESTION_LABELS[questionKey],
    value: profileFieldValue(profile, questionKey),
    quote: latestQuoteByKey.get(questionKey) ?? null,
  }));
}
