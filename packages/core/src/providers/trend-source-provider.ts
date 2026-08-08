/**
 * Contrato de capacidade `trend_source` (architecture.md §3.3) — o Trend
 * Engine conhece apenas esta interface, nunca o fornecedor concreto por
 * trás dela. Ver anthropic-web-search-trend-source-provider.ts para a
 * implementação inicial (MVP).
 */
export interface TrendCandidate {
  title: string;
  summary: string;
  sourceUrl: string | null;
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
