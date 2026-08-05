/**
 * Contrato de capacidade `media` (architecture.md §5) — nenhum Core Engine
 * conhece o fornecedor concreto por trás desta interface, apenas a
 * capacidade. Ver pexels-media-provider.ts para a implementação inicial
 * (Missão 9, Etapa 1) e a extensão de fotos da Missão 11 (arch. §14.4).
 */
export interface MediaCandidate {
  id: string;
  previewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  /** ★ Missão 11 — opcional: fotos não têm duração, só vídeos. */
  durationSeconds?: number;
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
  /** ★ novo (Missão 11) — busca de fotos (Pexels Photos API), usado pela geração automática de stories/carousel/thumbnail (arch. §14.4). */
  searchPhotos(request: MediaSearchRequest): Promise<MediaSearchResult>;
}
