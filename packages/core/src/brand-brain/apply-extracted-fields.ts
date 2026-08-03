import type { Database } from "@ayon/types";
import type { ExtractedField } from "./process-onboarding-turn";
import { splitListValue } from "./onboarding-themes";

type BrandBrainProfileRow = Database["public"]["Tables"]["brand_brain_profiles"]["Row"];

/**
 * Converte campos extraídos de um turno da conversa num patch para
 * `brand_brain_profiles`. Campos escalares (história, produtos, etc.) são
 * substituídos pela síntese mais recente da Ayon; campos de lista
 * (concorrentes, palavras proibidas/favoritas) são acrescentados, nunca
 * substituídos — a Ayon não "esquece" um concorrente já mencionado.
 */
export function applyExtractedFieldsToProfilePatch(
  extractedFields: ExtractedField[],
  currentProfile: BrandBrainProfileRow | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const mergeArrayField = (
    column: "competitors" | "forbidden_words" | "favorite_words",
    rawValue: string,
  ): void => {
    const newItems = splitListValue(rawValue);
    const alreadyInPatch = patch[column] as string[] | undefined;
    const existing = alreadyInPatch ?? currentProfile?.[column] ?? [];
    patch[column] = Array.from(new Set([...existing, ...newItems]));
  };

  for (const field of extractedFields) {
    switch (field.questionKey) {
      case "company_history":
        patch.company_history = field.value;
        break;
      case "products":
        patch.products_summary = field.value;
        break;
      case "customers":
        patch.target_audience = field.value;
        break;
      case "tone_of_voice":
        patch.tone_of_voice = field.value;
        break;
      case "objectives":
        patch.objectives = field.value;
        break;
      case "differentiators":
        patch.differentiators = field.value;
        break;
      case "competitors":
        mergeArrayField("competitors", field.value);
        break;
      case "forbidden_words":
        mergeArrayField("forbidden_words", field.value);
        break;
      case "favorite_words":
        mergeArrayField("favorite_words", field.value);
        break;
    }
  }

  return patch;
}
