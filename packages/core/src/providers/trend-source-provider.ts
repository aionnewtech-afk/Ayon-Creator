/**
 * Contrato de capacidade `trend_source` (architecture.md §3.3) — o Trend
 * Engine conhece apenas esta interface, nunca o fornecedor concreto por
 * trás dela. Ver anthropic-web-search-trend-source-provider.ts para a
 * implementação inicial (MVP).
 */

/**
 * ★ Achado real (pedido direto do usuário): "O que está em alta" numa lista
 * única, sem organização, não engajava — pedido explícito de blocos por
 * tipo de sinal. Categorias fixas (não um enum aberto do LLM) para a UI
 * sempre saber montar as mesmas seções, na mesma ordem, mesmo que uma
 * categoria venha vazia numa busca específica.
 */
export const TREND_CATEGORIES = ["noticias", "pesquisas", "redes_sociais", "eventos", "geral"] as const;
export type TrendCategory = (typeof TREND_CATEGORIES)[number];

export const TREND_CATEGORY_LABELS: Record<TrendCategory, string> = {
  noticias: "Notícias do seu negócio",
  pesquisas: "Pesquisas e dados de mercado",
  // ★ Achado real (pedido direto do usuário): "quero também uma categoria do
  // que está em alta nas redes sociais e nos termos buscados" — categoria
  // enriquecida (não uma nova, a mesma) para cobrir tendências de busca
  // (estilo Google Trends), não só redes sociais.
  redes_sociais: "Redes sociais e termos buscados",
  // ★ Achado real (pedido direto do usuário): "quero que os eventos sejam a
  // nível global" — antes, os eventos vinham quase sempre focados no Brasil
  // (viés natural do modelo/idioma da busca). Rótulo e prompt atualizados.
  eventos: "Eventos globais com significância",
  geral: "Outras tendências",
};

export interface TrendCandidate {
  title: string;
  summary: string;
  sourceUrl: string | null;
  category: TrendCategory;
}

export interface TrendCandidateSearchRequest {
  niche: string;
  brandName: string;
  /**
   * Títulos já mostrados ao usuário em buscas anteriores desta marca —
   * achado real, sprint de estabilização: "Buscar novidades" sempre
   * repetia as mesmas tendências, sem nenhum sinal de que já tinham sido
   * mostradas. Instrui o provider a evitar repetição, nunca um filtro
   * rígido (se não houver nada genuinamente novo, repetir é melhor que
   * inventar).
   */
  excludeTitles?: string[];
}

export interface TrendCandidateSearchResult {
  candidates: TrendCandidate[];
  providerKey: string;
}

export interface TrendSourceProvider {
  findCandidates(request: TrendCandidateSearchRequest): Promise<TrendCandidateSearchResult>;
}
