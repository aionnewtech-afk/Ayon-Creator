/**
 * Contrato de capacidade `media` (architecture.md §5) — nenhum Core Engine
 * conhece o fornecedor concreto por trás desta interface, apenas a
 * capacidade. Ver pexels-media-provider.ts para a implementação inicial
 * (Missão 9, Etapa 1).
 */
export interface MediaCandidate {
  id: string;
  previewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  durationSeconds: number;
  providerKey: string;
}

export interface MediaSearchRequest {
  query: string;
  orientation?: "portrait" | "landscape" | "square";
  perPage?: number;
}

export interface MediaSearchResult {
  candidates: MediaCandidate[];
  providerKey: string;
}

export interface MediaProvider {
  searchMedia(request: MediaSearchRequest): Promise<MediaSearchResult>;
  fetchMedia(id: string): Promise<MediaCandidate>;
}
