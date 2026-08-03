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
}

export interface TrendCandidateSearchResult {
  candidates: TrendCandidate[];
  providerKey: string;
}

export interface TrendSourceProvider {
  findCandidates(request: TrendCandidateSearchRequest): Promise<TrendCandidateSearchResult>;
}
