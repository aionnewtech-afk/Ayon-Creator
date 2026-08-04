import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPieceFormat, Database } from "@ayon/types";
import { TEXT_ONLY_CONTENT_PIECE_FORMATS, CONTENT_PIECE_FORMATS } from "@ayon/types";
import { ContentPieceRepository } from "../repositories/content-piece.repository";

type ContentPieceRow = Database["public"]["Tables"]["content_pieces"]["Row"];

const PRIMARY_FORMAT: ContentPieceFormat = "script";

/**
 * Cria as `content_pieces` previstas para uma campanha (Fluxo 3, passo 1) —
 * todos os 9 formatos do pacote (PRD §4.3), cada um já com o
 * `production_mode` do MVP da Missão 7: `text_only` para os 5 formatos
 * textuais, `own_media` para os 4 visuais (upload manual — architecture.md
 * §3.5). `script` é a peça principal (`is_primary`), reaproveitando o
 * `consolidated_result` já existente da campanha, sem nova sessão do
 * Intelligence Hub (Fluxo 3, §3.1).
 */
export async function initializeCampaignContentPieces(
  db: SupabaseClient<Database>,
  campaignId: string,
  intelligenceHubSessionId: string,
): Promise<ContentPieceRow[]> {
  const contentPieceRepository = new ContentPieceRepository(db);

  const pieces = await Promise.all(
    CONTENT_PIECE_FORMATS.map((format) => {
      const isTextOnly = (TEXT_ONLY_CONTENT_PIECE_FORMATS as readonly string[]).includes(format);
      const isPrimary = format === PRIMARY_FORMAT;

      return contentPieceRepository.create({
        campaign_id: campaignId,
        format,
        production_mode: isTextOnly ? "text_only" : "own_media",
        is_primary: isPrimary,
        intelligence_hub_session_id: isPrimary ? intelligenceHubSessionId : null,
      });
    }),
  );

  return pieces;
}
