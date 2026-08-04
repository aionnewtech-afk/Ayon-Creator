import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPieceFormat, Database, ProductionMode } from "@ayon/types";
import { TEXT_ONLY_CONTENT_PIECE_FORMATS, CONTENT_PIECE_FORMATS } from "@ayon/types";
import { ContentPieceRepository } from "../repositories/content-piece.repository";

type ContentPieceRow = Database["public"]["Tables"]["content_pieces"]["Row"];

const PRIMARY_FORMAT: ContentPieceFormat = "script";
/** ★ Missão 9, Etapa 1 — `video` sai de `own_media` (upload manual) para geração automática via Fluxo 13. */
const VIDEO_FORMAT: ContentPieceFormat = "video";

function productionModeFor(format: ContentPieceFormat): ProductionMode {
  if ((TEXT_ONLY_CONTENT_PIECE_FORMATS as readonly string[]).includes(format)) return "text_only";
  if (format === VIDEO_FORMAT) return "licensed_stock_video";
  return "own_media";
}

/**
 * Cria as `content_pieces` previstas para uma campanha (Fluxo 3, passo 1) —
 * todos os 9 formatos do pacote (PRD §4.3). `production_mode`: `text_only`
 * para os 5 formatos textuais (Missão 7); `licensed_stock_video` para
 * `video` (★ Missão 9, Etapa 1 — geração automática via Fluxo 13, não mais
 * upload manual); `own_media` para os 3 visuais restantes (`stories`,
 * `carousel`, `thumbnail`, upload manual, fora do escopo da Missão 9). Ver
 * architecture.md §3.5.1. `script` é a peça principal (`is_primary`),
 * reaproveitando o `consolidated_result` já existente da campanha, sem nova
 * sessão do Intelligence Hub (Fluxo 3, §3.1).
 */
export async function initializeCampaignContentPieces(
  db: SupabaseClient<Database>,
  campaignId: string,
  intelligenceHubSessionId: string,
): Promise<ContentPieceRow[]> {
  const contentPieceRepository = new ContentPieceRepository(db);

  const pieces = await Promise.all(
    CONTENT_PIECE_FORMATS.map((format) => {
      const isPrimary = format === PRIMARY_FORMAT;

      return contentPieceRepository.create({
        campaign_id: campaignId,
        format,
        production_mode: productionModeFor(format),
        is_primary: isPrimary,
        intelligence_hub_session_id: isPrimary ? intelligenceHubSessionId : null,
      });
    }),
  );

  return pieces;
}
