/**
 * Contrato de capacidade "pesquisa de campo" pra estratégia de campanha —
 * ★ Achado real (pedido direto do usuário — "os textos são muito genéricos
 * ... a pesquisa tem que de fato valer a pena, pesquisar 5 destinos e me dar
 * o roteiro... com o que se pode esperar em cada"): até aqui, NENHUMA etapa
 * do Intelligence Hub pesquisava fatos reais — especialistas e Coordinator
 * escreviam só com base no objetivo + Brand Brain, então um objetivo do
 * tipo "5 lugares para desacelerar" virava texto "bonito mas genérico" (o
 * LLM nunca tinha nomes/fatos concretos pra citar, só inventava em cima do
 * próprio senso comum). Reaproveita a mesma busca web nativa (grounding)
 * já usada pelo Trend Engine (`TrendSourceProvider`) — schema de resposta
 * diferente (fatos concretos por item, não "tendências"), mesmo mecanismo de
 * transporte.
 */
export interface CampaignResearchRequest {
  objective: string;
  brandName: string;
  niche: string | null;
}

export interface CampaignResearchFinding {
  name: string;
  details: string;
  sourceUrl: string | null;
}

export interface CampaignResearchResult {
  findings: CampaignResearchFinding[];
  summary: string;
  providerKey: string;
}

export interface CampaignResearchProvider {
  research(request: CampaignResearchRequest): Promise<CampaignResearchResult>;
}
