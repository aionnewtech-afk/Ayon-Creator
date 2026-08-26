import { logger } from "../logger";
import type { LlmProvider } from "../providers/llm-provider";
import { parseLlmJson } from "../shared/llm-json";

export interface ScriptSegment {
  text: string;
  /** Termo de busca curto e específico (destino/lugar/assunto concreto), extraído do trecho — nunca uma paráfrase genérica. */
  searchQuery: string;
  /**
   * ★ Achado real (pedido direto do usuário — roteiro cena-a-cena real,
   * exemplo trazido pronto: Oktoberfest/Blumenau/Pomerode com cada cena
   * marcada REAL/IA/TODOCANTO): decisão editorial por trecho, como um
   * diretor de criação faria — nunca inferida depois, decidida junto da
   * segmentação. `"real"` (padrão, comportamento de sempre) busca no banco
   * de vídeo; `"ai"` pula a busca e vai direto pra geração (Veo/Gemini,
   * usando `aiPrompt`); `"brand"` sinaliza pro usuário trocar manualmente
   * por material próprio da marca (nunca gerado/buscado automaticamente).
   */
  sceneType: "real" | "ai" | "brand";
  /** Só presente quando `sceneType === "ai"` — prompt cinematográfico completo (inglês, 9:16, estilo comercial de viagem realista, sem texto/logo/fantasia) pronto pro Veo/Gemini, já no nível de detalhe de um pedido profissional — nunca um resumo genérico do trecho. */
  aiPrompt?: string;
  /**
   * ★ Achado real (pedido direto do usuário — "expandir a biblioteca de
   * busca... onde procurar: material oficial X"): só presente quando
   * `sceneType === "real"` e o trecho menciona um lugar/evento específico
   * o bastante pra valer a pena procurar material oficial em vez de banco
   * de imagem genérico (ex.: um evento, uma cidade, um ponto turístico
   * nomeado) — nunca um link real (o LLM não teria como confirmar que
   * existe), só uma sugestão em texto de ONDE procurar (nome da fonte
   * oficial, tipo de conteúdo). Mostrado na revisão como dica pro usuário
   * buscar/enviar manualmente (upload já existente) se achar algo melhor
   * que o resultado do banco de imagem — nunca baixado/usado sozinho.
   */
  realSourceHint?: string;
}

function buildSystemPrompt(context: string): string {
  return (
    "Você é o diretor de criação de uma agência, dividindo um roteiro de narração em trechos lógicos e decidindo " +
    "a ORIGEM de cada cena — exatamente como um roteiro de produção profissional (real vs. gerado por IA vs. " +
    "material próprio da marca), nunca só uma busca genérica. " +
    "Cada trecho deve corresponder a uma ideia/lugar/assunto concreto do roteiro (ex.: um destino, uma atração, um prato). " +
    `Contexto da campanha (destino/nicho): "${context}". ` +
    "\n\nPara CADA trecho, decida `sceneType`:\n" +
    "- \"real\" (padrão): a cena pode vir de um banco de vídeo comum (pessoas fazendo algo ligado ao trecho) OU, quando o trecho menciona um lugar/evento/atração ESPECÍFICO E NOMEADO (uma cidade, um festival, um ponto turístico com nome próprio), existe material OFICIAL melhor que banco de imagem genérico — nesse caso preencha `realSourceHint` com uma sugestão curta de ONDE procurar (ex.: \"material oficial de turismo da cidade X\", \"perfil oficial do evento Y no Instagram\", \"portal de turismo oficial de Z, costuma disponibilizar material pra agentes de viagem\") — sempre em português, sempre uma SUGESTÃO de onde procurar, nunca um link inventado (você não tem como confirmar que existe). Trechos sem lugar/evento nomeado específico não precisam de `realSourceHint`.\n" +
    "- \"ai\": use quando a cena pedida não existe como filmagem real disponível (ex.: uma transição conceitual entre 2 lugares, uma cena ilustrativa/emocional sem local real específico, um momento que precisa parecer possível mas não é uma filmagem existente). Quando `sceneType` for \"ai\", preencha `aiPrompt` com um prompt cinematográfico COMPLETO em inglês, no mesmo nível de detalhe de um pedido profissional de produção — sempre: vertical 9:16, estilo documentário/comercial de viagem realista, descreva pessoas/idade/aparência quando relevante, iluminação, movimento de câmera, e termine sempre com restrições explícitas (\"no text, no logos, no exaggerated colors, no fantasy elements\", realistic/photorealistic). Nunca um resumo genérico de 1 frase — escreva como o exemplo: \"Vertical 9:16 cinematic travel film, realistic tourism commercial. [descrição detalhada da cena, pessoas, ambiente, luz, câmera]. Premium travel agency advertisement, no text, no logos, no exaggerated colors, no fantasy elements.\"\n" +
    "- \"brand\": use SÓ quando o trecho é claramente sobre a própria marca/agência (ex.: fechamento com logo, chamada pra ação assinada pela marca) — nunca pra cenas de lugar/pessoas genéricas.\n" +
    "\n" +
    // ★ Achado real (validação): o banco de vídeos (Pexels) é indexado majoritariamente
    // em inglês — buscas em português retornavam correspondência fraca por
    // palavra-chave solta (confirmado testando o mesmo tema direto na API do
    // Pexels: query em português trouxe uma foto de uma rua chamada "Boa
    // Viagem", sem relação nenhuma com o tema; a mesma ideia em inglês trouxe
    // resultados genuinamente relevantes). Só o `searchQuery` muda de idioma
    // — o `text` de cada trecho continua em português (precisa reconstruir o
    // roteiro original, narrado em português).
    "Pra QUALQUER `sceneType`, sempre preencha `searchQuery` também (2-5 palavras, EM INGLÊS, sem jargão) — usado como busca de fallback mesmo em cenas \"ai\"/\"brand\", caso a geração falhe. " +
    // ★ Achado real (pedido direto do usuário — vídeo "sem nexo, sem emoção",
    // feedback específico: "só gostei das cenas que tinham as pessoas"):
    // uma busca só de lugar/objeto ("beach sunset", "colonial cafe") traz
    // cenas de banco de imagens vazias e genéricas — sem ninguém pra
    // carregar a emoção da peça publicitária. SEMPRE inclua pessoas fazendo
    // uma atividade concreta ligada ao trecho (quem, fazendo o quê), nunca
    // só o cenário sozinho — regra por padrão, não só pra trechos sem
    // lugar concreto.
    "SEMPRE inclua pessoas reais fazendo uma atividade concreta e ligada ao trecho na busca — nunca um cenário/objeto vazio sozinho. Ex.: em vez de \"beach sunset\", busque \"couple walking beach sunset\"; em vez de \"colonial cafe\", busque \"friends colonial cafe coffee\"; em vez de \"mountain village\", busque \"tourists mountain village\". Escolha o tipo de pessoa (casal, amigos, família, turistas, um profissional) que combine com o público da campanha, indicado no contexto acima. Só use um termo sem pessoa se o trecho for genuinamente só sobre um objeto/prato específico (ex. um close de um prato) — mesmo assim prefira incluir alguém interagindo com ele (\"person eating\", \"chef preparing\") quando fizer sentido. " +
    "Para trechos que NÃO mencionam um lugar/atração concreto (ex.: encerramento, chamada para ação, promessa de suporte), NÃO use termos abstratos de escritório/planejamento (como 'travel planning', 'map', 'itinerary') — eles tendem a trazer clipes de estoque com texto ou bandeiras de outros países, quebrando a identidade da campanha. Prefira pessoas vivendo o benefício da marca (ex.: alguém sorrindo ao telefone, um aperto de mão, uma família feliz), sempre em inglês. " +
    "Responda só com um JSON no formato {\"segments\": [{\"text\": \"...\", \"searchQuery\": \"...\", \"sceneType\": \"real|ai|brand\", \"aiPrompt\": \"...\", \"realSourceHint\": \"...\"}]} (`aiPrompt`/`realSourceHint` só quando fizerem sentido pro `sceneType` daquele trecho, ausentes/omitidos nos outros casos), cobrindo o roteiro inteiro (a concatenação dos `text` deve reconstruir o roteiro, em português — só `searchQuery`/`aiPrompt` são em inglês), com pelo menos 2 e no máximo 6 trechos."
  );
}

/**
 * Segmenta o roteiro em trechos com termo de busca próprio (arch. §14.7) —
 * substitui a busca única por `campaign.title` da Etapa 1 original. Cada
 * trecho vira uma busca separada no Media Provider (video-pipeline-scenes.ts),
 * em vez de uma única cena genérica repetida para o vídeo inteiro.
 *
 * `context` (destino/nicho da campanha) é injetado no prompt para blindar
 * trechos sem lugar concreto (ex.: fechamento/CTA) contra buscas genéricas
 * demais — ★ achado real da validação da Missão 11 (task 15): um trecho de
 * fechamento sem contexto gerou a busca "planejamento de viagem", que
 * trouxe um clipe de estoque com um cartão escrito "USA", destoando de uma
 * campanha sobre um destino brasileiro.
 *
 * Nunca bloqueia o pipeline: qualquer falha de parsing/resposta inesperada
 * cai num único segmento cobrindo o roteiro inteiro, usando `fallbackQuery`
 * (nicho da marca) — pior caso é o comportamento da Etapa 1 original, nunca
 * uma falha.
 */
export async function segmentScript(
  script: string,
  llmProvider: LlmProvider,
  fallbackQuery: string,
  context: string,
): Promise<ScriptSegment[]> {
  try {
    const result = await llmProvider.complete({
      system: buildSystemPrompt(context),
      messages: [{ role: "user", content: script }],
      // ★ Achado real (validação): 1024 é pequeno demais para o Gemini 3 — o
      // gasto residual de "pensamento" (mesmo com reasoning_effort: "low" em
      // gemini-llm-provider.ts) somado à resposta precisar reproduzir o
      // roteiro inteiro nos `text` dos trechos cortava o JSON antes de
      // fechar, caindo sempre no fallback de 1 segmento genérico em
      // silêncio — causa real de "as cenas do vídeo não combinam com a
      // fala" (o vídeo inteiro usava uma única busca genérica por nicho, em
      // vez de uma cena por trecho da narração). ★ Elevado de 2048 pra 4096
      // (pedido direto do usuário — roteiro cena-a-cena com prompt
      // cinematográfico completo por cena de IA): cada `aiPrompt` sozinho
      // já é um parágrafo inteiro, várias cenas "ai" no mesmo roteiro
      // esgotavam 2048 antes de fechar o JSON.
      maxTokens: 4096,
    });

    const parsed = parseLlmJson(result.text) as { segments?: ScriptSegment[] };
    if (parsed.segments?.length && parsed.segments.every((s) => s.text && s.searchQuery)) {
      // ★ Defensivo: normaliza `sceneType` ausente/inválido pra "real" (o
      // comportamento de sempre, busca no banco de vídeo) — nunca deixa um
      // valor fora do enum esperado vazar pra `selectVideoScenes`.
      return parsed.segments.map((segment) => ({
        ...segment,
        sceneType: segment.sceneType === "ai" || segment.sceneType === "brand" ? segment.sceneType : "real",
      }));
    }

    logger.warn("asset_engine.segment_script.unexpected_response", { rawText: result.text });
  } catch (error) {
    logger.warn("asset_engine.segment_script.failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return [{ text: script, searchQuery: fallbackQuery, sceneType: "real" }];
}
