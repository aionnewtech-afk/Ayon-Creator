import type { MediaCandidate, MediaProvider, MediaSearchRequest, MediaSearchResult } from "./media-provider";

/**
 * Adapter concreto do Media Provider (architecture.md §5, §3.5.1) para o
 * Pexels — Missão 9, Etapa 1 (vídeo) e Missão 11 (foto, arch. §14.4). Único
 * arquivo do monorepo que importa a API do Pexels; trocar de fornecedor
 * (ex.: Storyblocks) nunca exige mudar quem chama `MediaProvider`, só o
 * resultado da resolução em provider-gateway.ts.
 *
 * ★ Missão 11 — a API de fotos do Pexels vive numa base de host diferente
 * da de vídeos (`api.pexels.com/v1` vs. `api.pexels.com/videos`), mesma
 * credencial (`PEXELS_API_KEY`).
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

    const response = await fetch(`${PEXELS_VIDEO_API_BASE}/search?${params.toString()}`, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Pexels searchMedia falhou (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as PexelsVideoSearchResponse;

    return {
      candidates: payload.videos.map((video) => toVideoCandidate(video, this.providerKey)),
      providerKey: this.providerKey,
    };
  }

  async fetchMedia(id: string): Promise<MediaCandidate> {
    const response = await fetch(`${PEXELS_VIDEO_API_BASE}/videos/${id}`, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Pexels fetchMedia falhou (${response.status}): ${errorBody}`);
    }

    const video = (await response.json()) as PexelsVideo;
    return toVideoCandidate(video, this.providerKey);
  }

  async searchPhotos(request: MediaSearchRequest): Promise<MediaSearchResult> {
    const params = new URLSearchParams({
      query: request.query,
      orientation: request.orientation ?? "portrait",
      per_page: String(request.perPage ?? 5),
    });

    const response = await fetch(`${PEXELS_PHOTO_API_BASE}/search?${params.toString()}`, {
      headers: { Authorization: this.apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Pexels searchPhotos falhou (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as PexelsPhotoSearchResponse;

    return {
      candidates: payload.photos.map((photo) => toPhotoCandidate(photo, this.providerKey)),
      providerKey: this.providerKey,
    };
  }
}

const PEXELS_VIDEO_API_BASE = "https://api.pexels.com/videos";
const PEXELS_PHOTO_API_BASE = "https://api.pexels.com/v1";

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

interface PexelsVideoSearchResponse {
  videos: PexelsVideo[];
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  src: { original: string; large2x: string; large: string; medium: string; portrait: string; landscape: string };
}

interface PexelsPhotoSearchResponse {
  photos: PexelsPhoto[];
}

/** Prioriza HD mp4; cai para o primeiro mp4 disponível, depois para qualquer arquivo. */
function pickBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile {
  const hdMp4 = files.find((file) => file.quality === "hd" && file.file_type === "video/mp4");
  const anyMp4 = files.find((file) => file.file_type === "video/mp4");
  const chosen = hdMp4 ?? anyMp4 ?? files[0];
  if (!chosen) throw new Error("Pexels retornou um vídeo sem nenhum video_files utilizável.");
  return chosen;
}

function toVideoCandidate(video: PexelsVideo, providerKey: string): MediaCandidate {
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

function toPhotoCandidate(photo: PexelsPhoto, providerKey: string): MediaCandidate {
  return {
    id: String(photo.id),
    previewUrl: photo.src.medium,
    downloadUrl: photo.src.large2x,
    width: photo.width,
    height: photo.height,
    providerKey,
  };
}
