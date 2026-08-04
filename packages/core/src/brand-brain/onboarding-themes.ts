import type { Database, OnboardingQuestionKey } from "@ayon/types";

type BrandBrainProfileRow = Database["public"]["Tables"]["brand_brain_profiles"]["Row"];

/**
 * Divide o valor de um campo de lista (competitors/forbidden_words/favorite_words)
 * em itens curtos. O prompt (onboarding-prompt.ts) instrui o modelo a nunca
 * colocar vírgula dentro de um item, mas isso é reforço de defesa, não a
 * única garantia — por isso remove parênteses antes de dividir (achado em
 * teste E2E real: "Booking, 123Milhas" dentro de um parêntese explicativo
 * estava sendo cortado ao meio pelo split ingênuo em vírgula).
 */
export function splitListValue(rawValue: string): string[] {
  return rawValue
    .replace(/\([^)]*\)/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Os 5 temas da conversa "Conheça sua empresa" (ux-design.md §4.2) — nunca
 * expostos ao usuário como etapas, só usados para organizar o prompt e
 * decidir quando fazer o reflexo de tema com callback obrigatório.
 */
export interface OnboardingTheme {
  key: string;
  label: string;
  questionKeys: OnboardingQuestionKey[];
  openingPrompt: string;
}

export const ONBOARDING_THEMES: OnboardingTheme[] = [
  {
    key: "sobre_a_empresa",
    label: "Sobre a empresa",
    questionKeys: ["company_history", "products"],
    openingPrompt:
      "Me conta, do seu jeito: o que é a {brandName} e o que vocês vendem ou oferecem?",
  },
  {
    key: "clientes",
    label: "Clientes",
    questionKeys: ["customers"],
    openingPrompt:
      "E quem costuma comprar de vocês? Pode descrever até por perfil — ex: 'famílias planejando a primeira viagem internacional'.",
  },
  {
    key: "concorrencia_diferenciais",
    label: "Concorrência e diferenciais",
    questionKeys: ["competitors", "differentiators"],
    openingPrompt: "Quem você considera concorrente hoje — direto ou indireto?",
  },
  {
    key: "objetivos",
    label: "Objetivos",
    questionKeys: ["objectives"],
    openingPrompt:
      "Pensando nos próximos meses: o que você mais quer que o marketing te ajude a alcançar?",
  },
  {
    key: "voz_palavras",
    label: "Tom de voz e palavras",
    questionKeys: ["tone_of_voice", "forbidden_words", "favorite_words"],
    openingPrompt:
      "Se a {brandName} fosse uma pessoa falando com seu cliente, ela seria mais formal ou descontraída? Tem alguma palavra que vocês adoram usar, ou alguma que nunca pode aparecer?",
  },
];

export const ONBOARDING_QUESTION_LABELS: Record<OnboardingQuestionKey, string> = {
  company_history: "História da empresa",
  products: "Produtos",
  customers: "Clientes",
  tone_of_voice: "Tom de voz",
  competitors: "Concorrentes",
  objectives: "Objetivos",
  differentiators: "Diferenciais",
  forbidden_words: "Palavras proibidas",
  favorite_words: "Palavras favoritas",
};

/** Tema ao qual um campo estruturado pertence. */
export function themeForQuestionKey(questionKey: OnboardingQuestionKey): OnboardingTheme {
  const theme = ONBOARDING_THEMES.find((t) => t.questionKeys.includes(questionKey));
  if (!theme) throw new Error(`Nenhum tema encontrado para question_key=${questionKey}`);
  return theme;
}

/** Todos os question_keys dos 5 temas, na ordem canônica (PRD §4.5). */
export function allQuestionKeys(): OnboardingQuestionKey[] {
  return ONBOARDING_THEMES.flatMap((theme) => theme.questionKeys);
}

export interface KnownFieldsSnapshot {
  questionKey: OnboardingQuestionKey;
  value: string;
}

/**
 * Valor atual (síntese da Ayon, não citação literal) de um campo em
 * `brand_brain_profiles` — único lugar que sabe mapear `question_key` →
 * coluna, reaproveitado pelo prompt (o que a Ayon já sabe) e pela síntese
 * de ONB-3 (build-onboarding-synthesis.ts).
 */
export function profileFieldValue(
  profile: BrandBrainProfileRow,
  questionKey: OnboardingQuestionKey,
): string | null {
  switch (questionKey) {
    case "company_history":
      return profile.company_history;
    case "products":
      return profile.products_summary;
    case "customers":
      return profile.target_audience;
    case "tone_of_voice":
      return profile.tone_of_voice;
    case "objectives":
      return profile.objectives;
    case "differentiators":
      return profile.differentiators;
    case "competitors":
      return profile.competitors.length ? profile.competitors.join(", ") : null;
    case "forbidden_words":
      return profile.forbidden_words.length ? profile.forbidden_words.join(", ") : null;
    case "favorite_words":
      return profile.favorite_words.length ? profile.favorite_words.join(", ") : null;
  }
}

/** Snapshot dos campos já preenchidos, para alimentar o prompt (memória). */
export function knownFieldsFromProfile(profile: BrandBrainProfileRow | null): KnownFieldsSnapshot[] {
  if (!profile) return [];

  return allQuestionKeys()
    .map((questionKey) => ({ questionKey, value: profileFieldValue(profile, questionKey) }))
    .filter((field): field is KnownFieldsSnapshot => field.value !== null);
}

/**
 * Um aprendizado aceito pelo cliente (Brand Evolution, Fluxo 8) — shape do
 * jsonb `brand_brain_profiles.learned_preferences`. `{ insights: [...] }`
 * acumula ao longo do tempo (cada aceite adiciona uma entrada, nunca
 * sobrescreve as anteriores).
 */
export interface LearnedPreferenceEntry {
  id: string;
  insightType: string;
  appliedTo: string;
  text: string;
  appliedAt: string;
}

/**
 * Texto pronto para injeção no contexto de marca (`buildBrandContextBlock`)
 * — único mecanismo real de "aplicação" de um `learning_insight` aceito
 * (database.md §4.7, Missão 8): todo Core Engine que já monta contexto de
 * marca passa a ver os aprendizados aceitos, sem precisar de um caminho de
 * código separado por `applied_to`. `undefined` quando não há nenhum
 * aprendizado aceito ainda (caso de toda marca antes da Missão 8).
 */
export function learnedPreferencesTextFromProfile(profile: BrandBrainProfileRow | null): string | undefined {
  if (!profile) return undefined;

  const raw = profile.learned_preferences as { insights?: unknown } | null;
  const rawInsights = Array.isArray(raw?.insights) ? raw.insights : [];

  const texts = rawInsights
    .filter((entry): entry is LearnedPreferenceEntry => typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>).text === "string")
    .map((entry) => `- ${entry.text}`);

  return texts.length === 0 ? undefined : texts.join("\n");
}
