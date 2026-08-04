import type { MediaCandidate, MediaProvider, MediaSearchRequest, MediaSearchResult } from "./media-provider";

/**
 * Adapter concreto do Media Provider (architecture.md §5, §3.5.1) para o
 * Pexels — Missão 9, Etapa 1. Único arquivo do monorepo que importa a API do
 * Pexels; trocar de fornecedor (ex.: Storyblocks) nunca exige mudar quem
 * chama `MediaProvider`, só o resultado da resolução em provider-gateway.ts.
 */
export class PexelsMediaProvider implements MediaProvider {
  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
  ) {}

  async searchMedia(request: MediaSearchRequest): Promise<MediaSearchResult> {
    const params = new URLSearchParams({
      query: request.query,
      orientation: request.orientation ?? "portrait",
      per_page: String(request.perPage ?? 5),
    });

    const response = await fetch(`${PEXELS_API_BASE}/search?${params.toString()}`, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Pexels searchMedia falhou (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as PexelsSearchResponse;

    return {
      candidates: payload.videos.map((video) => toMediaCandidate(video, this.providerKey)),
      providerKey: this.providerKey,
    };
  }

  async fetchMedia(id: string): Promise<MediaCandidate> {
    const response = await fetch(`${PEXELS_API_BASE}/videos/${id}`, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Pexels fetchMedia falhou (${response.status}): ${errorBody}`);
    }

    const video = (await response.json()) as PexelsVideo;
    return toMediaCandidate(video, this.providerKey);
  }
}

const PEXELS_API_BASE = "https://api.pexels.com/videos";

interface PexelsVideoFile {
  link: string;
  quality: string;
  file_type: string;
  width: number;
  height: number;
}

interface PexelsVideo {
  id: number;
  duration: number;
  image: string;
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

/** Prioriza HD mp4; cai para o primeiro mp4 disponível, depois para qualquer arquivo. */
function pickBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile {
  const hdMp4 = files.find((file) => file.quality === "hd" && file.file_type === "video/mp4");
  const anyMp4 = files.find((file) => file.file_type === "video/mp4");
  const chosen = hdMp4 ?? anyMp4 ?? files[0];
  if (!chosen) throw new Error("Pexels retornou um vídeo sem nenhum video_files utilizável.");
  return chosen;
}

function toMediaCandidate(video: PexelsVideo, providerKey: string): MediaCandidate {
  const file = pickBestVideoFile(video.video_files);
  return {
    id: String(video.id),
    previewUrl: video.image,
    downloadUrl: file.link,
    width: file.width,
    height: file.height,
    durationSeconds: video.duration,
    providerKey,
  };
}
