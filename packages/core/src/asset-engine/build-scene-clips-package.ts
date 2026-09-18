import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { fetchWithRetry } from "../shared/fetch-with-retry";
import { logger } from "../logger";
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

  // ★ Achado real (pedido direto do usuário — "o zip continua sem baixar"):
  // 2 problemas reais encontrados aqui, nenhum visível no código até se
  // testar com cenas de verdade (Pexels/Veo/Gemini/avatar, não fixtures):
  // (1) fetch em série, um de cada vez — um vídeo de várias cenas levava
  // tempo o bastante pra flertar com timeout de proxy/rede, e qualquer erro
  // de rede transitório num único `fetch` (sem retry, ao contrário de TODO
  // resto do projeto — ver `fetchWithRetry`) derrubava a promise inteira sem
  // nenhuma mensagem clara pro usuário (só "algo deu errado"); (2) uma cena
  // que falhasse era silenciosamente pulada (`continue`) — o .zip "baixava"
  // mesmo faltando cena, o que pareceria com "o zip não funciona" de um jeito
  // diferente, mas igualmente real. Agora busca tudo em PARALELO (rápido) e
  // com retry automático (falha transitória não derruba mais o pacote
  // inteiro); se mesmo assim uma cena falhar, o erro é explícito (nunca um
  // .zip incompleto sem avisar).
  const sceneBuffers = await Promise.all(
    ordered.map(async (scene, index) => {
      try {
        const response = await fetchWithRetry(scene.url);
        if (!response.ok) throw new Error(`status ${response.status}`);
        return { index, buffer: Buffer.from(await response.arrayBuffer()), extension: scene.assetType === "image" ? "jpg" : "mp4" };
      } catch (error) {
        logger.error("asset_engine.scene_package_fetch_failed", {
          contentPieceId: params.contentPieceId,
          sceneIndex: index,
          url: scene.url,
          reason: error instanceof Error ? error.message : String(error),
        });
        throw new Error(`Não consegui baixar a cena ${index + 1} pra montar o pacote — tenta de novo em instantes.`);
      }
    }),
  );
  for (const { index, buffer, extension } of sceneBuffers) {
    zip.file(`${String(index + 1).padStart(2, "0")}-cena.${extension}`, buffer);
  }

  const audioResponse = await fetchWithRetry(plan.audioUrl);
  if (!audioResponse.ok) {
    throw new Error("Não consegui baixar a narração pra montar o pacote — tenta de novo em instantes.");
  }
  zip.file("narracao.mp3", await audioResponse.arrayBuffer());

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
