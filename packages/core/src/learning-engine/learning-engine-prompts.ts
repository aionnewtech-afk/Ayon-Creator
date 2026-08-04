import { buildBrandContextBlock } from "../intelligence-hub/intelligence-hub-prompts";
import type { KnownFieldsSnapshot } from "../brand-brain/onboarding-prompt";
import type { Database } from "@ayon/types";

type LearningSignalRow = Database["public"]["Tables"]["learning_signals"]["Row"];

const MAX_SIGNAL_EXAMPLES = 20;

/**
 * Blocos de contexto compartilhados entre especialistas e Coordinator para a
 * decisão `learning_analysis` (architecture.md §3.6) — mesmo espírito de
 * trend-ranking-prompts.ts, mas com sinais de comportamento (aprovação/
 * rejeição/edição de peça) no lugar de candidatos de tendência.
 */
function describeEditedDelta(previousScript: unknown, newScript: unknown): string {
  if (typeof previousScript !== "string" || typeof newScript !== "string" || previousScript.length === 0) {
    return "editada manualmente";
  }
  const ratio = (newScript.length - previousScript.length) / previousScript.length;
  if (ratio <= -0.15) return "editada manualmente (bastante encurtada)";
  if (ratio >= 0.15) return "editada manualmente (bastante alongada)";
  return "editada manualmente (ajuste pontual)";
}

function buildSignalsBlock(signals: LearningSignalRow[]): string {
  const counts = { approved: 0, rejected: 0, edited: 0 };
  for (const signal of signals) {
    if (signal.signal_type === "approved" || signal.signal_type === "rejected" || signal.signal_type === "edited") {
      counts[signal.signal_type] += 1;
    }
  }

  const summaryLine = `Total de eventos desde a última análise: ${signals.length} (aprovados sem alterações: ${counts.approved}, rejeitados: ${counts.rejected}, editados manualmente: ${counts.edited}).`;

  const examples = signals.slice(0, MAX_SIGNAL_EXAMPLES).map((signal) => {
    const payload = signal.payload as Record<string, unknown>;
    const format = typeof payload.format === "string" ? payload.format : "formato desconhecido";

    if (signal.signal_type === "rejected") {
      const reason = typeof payload.reason === "string" ? payload.reason : null;
      return `- Peça de ${format} rejeitada${reason ? `: "${reason}"` : ", sem motivo informado"}.`;
    }
    if (signal.signal_type === "edited") {
      return `- Peça de ${format} ${describeEditedDelta(payload.previousScript, payload.newScript)}.`;
    }
    return `- Peça de ${format} aprovada sem alterações.`;
  });

  const omittedCount = signals.length - examples.length;
  const omittedLine = omittedCount > 0 ? `\n(+ ${omittedCount} eventos adicionais, mesmo padrão de tipos acima.)` : "";

  return `${summaryLine}\n\n${examples.join("\n")}${omittedLine}`;
}

export function buildLearningAnalysisSpecialistMessage(params: {
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  signals: LearningSignalRow[];
}): string {
  return `${buildBrandContextBlock(params.brandName, params.knownFields)}\n\nDados reais de comportamento desta marca, coletados na revisão de peças de conteúdo geradas em campanhas recentes:\n${buildSignalsBlock(params.signals)}\n\nAnalise esses dados e aponte, da sua área de especialidade, um padrão concreto e específico que valha a pena virar uma sugestão de ajuste de estratégia para o cliente — no estilo "vídeos de até 35 segundos performam melhor", mas baseado apenas no que você realmente vê nos dados acima, nunca um palpite genérico. Se os dados não mostrarem um padrão claro o suficiente, diga isso explicitamente — nunca force uma conclusão fraca.`;
}

export interface SuccessfulOpinionForLearningCoordinator {
  specialistName: string;
  opinion: string;
  rationale: string;
}

export function buildLearningAnalysisCoordinatorMessage(params: {
  brandName: string;
  knownFields: KnownFieldsSnapshot[];
  signals: LearningSignalRow[];
  opinions: SuccessfulOpinionForLearningCoordinator[];
}): string {
  const opinionsText =
    params.opinions.length === 0
      ? "Nenhum especialista respondeu com sucesso desta vez."
      : params.opinions.map((o) => `- ${o.specialistName}: "${o.opinion}" (justificativa: ${o.rationale})`).join("\n");

  return `${buildBrandContextBlock(params.brandName, params.knownFields)}\n\nDados reais de comportamento desta marca:\n${buildSignalsBlock(params.signals)}\n\nOpiniões independentes dos especialistas:\n${opinionsText}\n\nConsolide isso em até 5 sugestões de aprendizado genuinamente sustentadas pelos dados e pelas opiniões acima — nunca invente um padrão que os dados não sustentam. Se nenhuma sugestão for sólida o suficiente, retorne uma lista vazia; não force quantidade. Para cada sugestão, escolha para qual parte do produto ela deveria influenciar no futuro: "brand_brain" (preferência geral da marca), "trend_engine" (como avaliar tendências), "intelligence_hub" (como a estratégia de campanha é pensada) ou "asset_engine" (como as peças são geradas).\n\nResponda SOMENTE em JSON, sem texto antes ou depois, exatamente neste formato: {"insights": [{"insight_type": "identificador curto em snake_case, ex: formato_preferido", "summary": "o texto que o cliente vai ler, em linguagem simples e específica, terminando com uma pergunta genuína tipo 'Deseja atualizar sua estratégia?'", "rationale": "por que você chegou a essa sugestão, citando os dados e as opiniões dos especialistas", "applied_to": "brand_brain, trend_engine, intelligence_hub ou asset_engine"}], "overall_rationale": "visão geral de como você chegou a essas sugestões"}.`;
}
