import type { LlmCompletionRequest, LlmCompletionResult, LlmProvider } from "./llm-provider";

/**
 * Provider de teste (Missão H2, CONVENTIONS.md §10) — nunca usado em
 * produção, só no smoke test de CI (`LLM_PROVIDER_MODE=fake`, ver
 * `resolveLlmProvider`). Resposta fixa, instantânea, sem custo de token.
 *
 * O JSON retornado é a UNIÃO dos campos exigidos pelos schemas Zod dos
 * únicos call sites que o smoke test de H2 exercita — painel de
 * especialistas (`opinion`/`rationale`), Coordinator de `campaign_strategy`
 * (`consolidated_strategy`/`rationale`/`divergences`) e geração de peça de
 * texto do Asset Engine (`content`/`rationale`). Cada schema só valida os
 * campos que declara e ignora o resto (nenhum usa `.strict()`), então uma
 * única resposta serve aos três. **Não cobre** os schemas de onboarding,
 * Trend Engine ou Learning Engine (shapes incompatíveis — arrays/enums
 * próprios) — um smoke test futuro que exercite esses fluxos precisa
 * estender este fake ou usar um dedicado.
 */
export class FakeLlmProvider implements LlmProvider {
  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const text = JSON.stringify({
      opinion: "Recomendação de teste gerada pelo FakeLlmProvider — usada apenas no smoke test de CI.",
      rationale: "Resposta fixa e determinística; não reflete análise real de nenhum especialista ou Coordinator.",
      consolidated_strategy: "Estratégia de teste consolidada pelo FakeLlmProvider — usada apenas no smoke test de CI.",
      divergences: null,
      content: "Conteúdo de teste gerado pelo FakeLlmProvider — usado apenas no smoke test de CI.",
    });

    return { text, providerKey: "fake-llm-provider" };
  }
}
