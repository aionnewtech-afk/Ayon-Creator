import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { ContentVersionRepository } from "../repositories/content-version.repository";
import { ContentPackageRepository } from "../repositories/content-package.repository";
import { logger } from "../logger";

const CONTENT_OUTPUT_BUCKET = "content-output";

export class PackageNotReadyError extends Error {
  constructor() {
    super("Nem todas as peças da campanha foram aprovadas ainda.");
    this.name = "PackageNotReadyError";
  }
}

/**
 * Monta o Pacote de Conteúdo final (Fluxo 3, §3.3) — só depois que todas as
 * peças estão `approved`. Formatos textuais entram como `.txt` (a partir de
 * `content_pieces.script`); formatos visuais (`own_media`) entram como o
 * arquivo que o cliente enviou (última `content_versions`).
 */
export async function buildContentPackage(params: {
  /** Client de sessão (RLS) — grava content_packages, lê/baixa do Storage. */
  db: SupabaseClient<Database>;
  organizationId: string;
  campaignId: string;
}): Promise<{ storagePath: string }> {
  const contentPieceRepository = new ContentPieceRepository(params.db);
  const contentVersionRepository = new ContentVersionRepository(params.db);
  const contentPackageRepository = new ContentPackageRepository(params.db);

  const pieces = await contentPieceRepository.findByCampaignId(params.campaignId);

  if (pieces.length === 0 || pieces.some((piece) => piece.status !== "approved")) {
    throw new PackageNotReadyError();
  }

  await contentPackageRepository.upsertByCampaignId(params.campaignId, { status: "building" });

  try {
    const zip = new JSZip();

    for (const piece of pieces) {
      if (piece.production_mode === "text_only") {
        zip.file(`${piece.format}.txt`, piece.script ?? "");
        continue;
      }

      const latestVersion = await contentVersionRepository.findLatestByContentPieceId(piece.id);
      if (!latestVersion?.output_storage_path) {
        logger.warn("asset_engine.package_missing_media", { contentPieceId: piece.id, format: piece.format });
        continue;
      }

      // ★ Achado real (pedido direto do usuário — "o carrossel só gera um e é
      // mal feito") — `output_storage_path` sozinho é só a capa de um
      // carrossel real; todas as lâminas vivem em
      // `generation_metadata.slide_storage_paths` (photo-pipeline-complete.ts).
      const slidePaths = (latestVersion.generation_metadata as { slide_storage_paths?: string[] } | null)?.slide_storage_paths;
      const storagePaths = slidePaths?.length ? slidePaths : [latestVersion.output_storage_path];

      for (const storagePath of storagePaths) {
        const { data, error } = await params.db.storage.from(CONTENT_OUTPUT_BUCKET).download(storagePath);
        if (error || !data) {
          logger.warn("asset_engine.package_download_failed", { contentPieceId: piece.id, format: piece.format });
          continue;
        }

        const rawFileName = storagePath.split("/").pop() ?? piece.format;
        const idPrefix = `${piece.id}-`;
        const fileName = rawFileName.startsWith(idPrefix) ? rawFileName.slice(idPrefix.length) : rawFileName;
        zip.file(fileName, await data.arrayBuffer());
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const storagePath = `${params.organizationId}/${params.campaignId}/pacote.zip`;

    const { error: uploadError } = await params.db.storage
      .from(CONTENT_OUTPUT_BUCKET)
      .upload(storagePath, zipBuffer, { contentType: "application/zip", upsert: true });
    if (uploadError) throw uploadError;

    await contentPackageRepository.upsertByCampaignId(params.campaignId, {
      status: "ready",
      storage_path: storagePath,
      generated_at: new Date().toISOString(),
    });

    return { storagePath };
  } catch (error) {
    await contentPackageRepository.upsertByCampaignId(params.campaignId, { status: "failed" }).catch(() => undefined);
    throw error;
  }
}
