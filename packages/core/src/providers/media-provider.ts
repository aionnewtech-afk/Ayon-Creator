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
  /**
   * ★ Achado real (pedido direto do usuário — "o carrossel só gera um e é
   * mal feito"): quando este candidato representa 1 lâmina de um carrossel
   * de várias (não uma foto de fundo alternativa isolada), carrega o texto
   * próprio daquela lâmina — mesmo canal que já atravessa
   * select → n8n → compose sem mudança de contrato
   * (`photo-pipeline-select.ts`/`photo-pipeline-compose.ts`). Ausente em
   * qualquer outro fluxo.
   */
  slideHeadline?: string;
  slideBody?: string;
  /**
   * ★ Achado real (pedido direto do usuário — "mostrar o prompt exato usado
   * em cada peça gerada"): texto exato mandado ao provider pra chegar
   * nesse candidato — o prompt completo de geração (Gemini) ou o termo de
   * busca usado (Pexels, banco de fotos/vídeo licenciado — "prompt" aqui é
   * só o termo de busca, nunca uma criação da IA). Puramente informativo,
   * nunca lido de volta por nenhum pipeline — só flui até a UI de revisão.
   */
  generationPrompt?: string;
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
