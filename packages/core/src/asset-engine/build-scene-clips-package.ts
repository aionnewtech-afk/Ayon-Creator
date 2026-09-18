import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { ContentPieceRepository } from "../repositories/content-piece.repository";
import { fetchWithRetry } from "../shared/fetch-with-retry";
import { logger } from "../logger";
import type { PendingVideoScenePlan } from "./video-pipeline-plan";
import { MissingScenePlanError } from "./video-pipeline-plan";

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
 *
 * ★ Achado real #2 (pedido direto do usuário — "The object exceeded the
 * maximum allowed size"): a versão anterior fazia upload do .zip pro
 * Supabase Storage pra depois gerar uma signed URL — Storage recusa
 * qualquer objeto acima do limite do plano (50MB no gratuito), e um vídeo
 * de várias cenas de banco (Pexels) facilmente passa disso. O .zip nunca
 * precisava viver no Storage pra começo de conversa (é um export pontual,
 * nunca reaproveitado depois) — devolve o Buffer direto pra quem chamou
 * (a rota `app/api/scene-package/[contentPieceId]/route.ts`) transmitir
 * pro navegador na hora, sem limite de tamanho de objeto nenhum no meio.
 */
export async function buildScenePackage(params: {
  db: SupabaseClient<Database>;
  contentPieceId: string;
}): Promise<{ buffer: Buffer }> {
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

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer };
}
