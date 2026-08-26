import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import type { PendingVideoScenePlan } from "./video-pipeline-plan";
import { MissingScenePlanError } from "./video-pipeline-plan";

const CONTENT_OUTPUT_BUCKET = "content-output";
const PACKAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

/**
 * ★ Achado real (pedido direto do usuário — "baixar todas as cenas e ela
 * fazer a edição, de acordo com as transições que ela quer, ou baixar o
 * vídeo todo de uma vez, já com as transições internas que a gente vai
 * colocar"): alternativa a aprovar o plano (`approveVideoScenePlan`, que
 * compõe tudo com nossas transições via Shotstack) — empacota cada cena do
 * plano pendente (os MESMOS arquivos reais já escolhidos: Pexels, Veo,
 * Gemini, avatar ou upload) + a narração, num .zip numerado na ordem do
 * vídeo, pro usuário editar do jeito dele em qualquer editor. Nunca altera
 * o plano nem o status da peça — puramente um export, a peça continua em
 * `scenes_ready_for_review` do mesmo jeito depois.
 */
export async function buildScenePackage(params: {
  db: SupabaseClient<Database>;
  organizationId: string;
  campaignId: string;
  contentPieceId: string;
}): Promise<{ downloadUrl: string }> {
  const piece = await new ContentPieceRepository(params.db).findById(params.contentPieceId);
  const plan = piece?.pending_scene_plan as unknown as PendingVideoScenePlan | null;
  if (piece?.status !== "scenes_ready_for_review" || !plan) throw new MissingScenePlanError();

  const zip = new JSZip();
  const ordered = [...plan.videoSources].sort((a, b) => a.startSeconds - b.startSeconds);

  for (let index = 0; index < ordered.length; index++) {
    const scene = ordered[index]!;
    const response = await fetch(scene.url);
    if (!response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = scene.assetType === "image" ? "jpg" : "mp4";
    zip.file(`${String(index + 1).padStart(2, "0")}-cena.${extension}`, buffer);
  }

  const audioResponse = await fetch(plan.audioUrl);
  if (audioResponse.ok) {
    zip.file("narracao.mp3", await audioResponse.arrayBuffer());
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const storagePath = `${params.organizationId}/${params.campaignId}/${params.contentPieceId}-cenas.zip`;

  const { error: uploadError } = await params.db.storage
    .from(CONTENT_OUTPUT_BUCKET)
    .upload(storagePath, zipBuffer, { contentType: "application/zip", upsert: true });
  if (uploadError) throw uploadError;

  const { data: signed, error: signError } = await params.db.storage
    .from(CONTENT_OUTPUT_BUCKET)
    .createSignedUrl(storagePath, PACKAGE_SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) throw signError ?? new Error("Não consegui gerar o link do pacote de cenas.");

  return { downloadUrl: signed.signedUrl };
}
