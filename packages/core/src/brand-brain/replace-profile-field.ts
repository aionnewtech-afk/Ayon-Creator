import type { OnboardingQuestionKey } from "@ayon/types";

/**
 * Patch de **substituição direta** de um campo do Perfil da Marca — usado
 * pela edição manual (ONB-3/ONB-4), nunca pela conversa.
 *
 * Diferente de `applyExtractedFieldsToProfilePatch` (conversation-log.ts),
 * que faz *merge* aditivo em campos de lista (a Ayon nunca "esquece" um
 * concorrente já mencionado): aqui o usuário está editando o campo
 * diretamente, então o valor novo substitui o antigo por completo — inclusive
 * removendo itens de listas, o que o merge aditivo nunca permitiria.
 */
export function replaceProfileFieldPatch(
  questionKey: OnboardingQuestionKey,
  value: string,
): Record<string, unknown> {
  switch (questionKey) {
    case "company_history":
      return { company_history: value };
    case "products":
      return { products_summary: value };
    case "customers":
      return { target_audience: value };
    case "tone_of_voice":
      return { tone_of_voice: value };
    case "objectives":
      return { objectives: value };
    case "differentiators":
      return { differentiators: value };
    case "competitors":
      return { competitors: splitList(value) };
    case "forbidden_words":
      return { forbidden_words: splitList(value) };
    case "favorite_words":
      return { favorite_words: splitList(value) };
  }
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
