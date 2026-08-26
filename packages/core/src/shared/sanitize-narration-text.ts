/**
 * Rede de segurança para o texto de narração (achado real: mesmo com o
 * prompt corrigido pedindo só texto falado — ver asset-generation-prompts.ts
 * FORMAT_INSTRUCTIONS.script —, um LLM pode ocasionalmente reincluir uma
 * direção de cena/cenário entre parênteses ou colchetes). Remove blocos
 * inteiros entre `(...)`/`[...]` e rótulos de linha comuns de roteiro
 * ("Cena 1:", "Visual:", "Locução:") antes de qualquer texto ir para o
 * Voice Provider — nunca é a defesa principal (o prompt é), só evita que uma
 * falha pontual do LLM vire áudio real narrando direção de cenário.
 */
export function sanitizeNarrationText(script: string): string {
  const withoutBracketedBlocks = script
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ");

  const withoutSceneLabels = withoutBracketedBlocks
    .split("\n")
    .map((line) => line.replace(/^\s*(cena\s*\d*|abertura|desenvolvimento|fechamento|visual|locução|cenário)\s*:\s*/i, ""))
    .join("\n");

  return withoutSceneLabels.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
