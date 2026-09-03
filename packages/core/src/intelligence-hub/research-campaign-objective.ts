import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderTier } from "@ayon/types";
import { resolveCampaignResearchProvider } from "../providers/provider-gateway";
import { logger } from "../logger";

export interface ResearchCampaignObjectiveParams {
  /** Client de service role — resolve `provider_configs` (mesmo capability de `trend_source`). */
  serviceRoleDb: SupabaseClient<Database>;
  tier: ProviderTier;
  objective: string;
  brandName: string;
  niche: string | null;
}

/**
 * ★ Achado real (pedido direto do usuário — "os textos são muito genéricos
 * ... a pesquisa tem que de fato valer a pena, pesquisar 5 destinos e me dar
 * o roteiro... com o que se pode esperar em cada"): até aqui, nenhuma etapa
 * do Intelligence Hub pesquisava fatos reais — especialistas e Coordinator
 * escreviam só com base no objetivo + Brand Brain. Roda ANTES do painel de
 * especialistas (`runStrategyForCampaign`) e devolve um bloco de texto pronto
 * pra injetar nos prompts deles — nunca bloqueia a sessão: sem provider
 * configurado, sem achado real, ou qualquer erro na busca, devolve `null` e
 * a estratégia segue exatamente como antes (mesmo espírito "falha parcial
 * nunca bloqueia" já aplicado ao painel de especialistas).
 */
export async function researchCampaignObjective(params: ResearchCampaignObjectiveParams): Promise<string | null> {
  const provider = await resolveCampaignResearchProvider(params.serviceRoleDb, params.tier);
  if (!provider) return null;

  try {
    const result = await provider.research({
      objective: params.objective,
      brandName: params.brandName,
      niche: params.niche,
    });

    if (result.findings.length === 0) return null;

    const findingsText = result.findings
      .map((finding) => `- ${finding.name}: ${finding.details}${finding.sourceUrl ? ` (fonte: ${finding.sourceUrl})` : ""}`)
      .join("\n");

    return (
      "Pesquisa real feita sobre este objetivo — use estes fatos concretos (nomes, dados, detalhes reais) em vez " +
      `de generalidades, e preserve-os (não resuma até virarem vagos):\n${findingsText}\n\nSíntese: ${result.summary}`
    );
  } catch (error) {
    logger.warn("intelligence_hub.campaign_research_failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
