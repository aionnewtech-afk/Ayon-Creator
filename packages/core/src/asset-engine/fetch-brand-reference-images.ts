import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { logger } from "../logger";

const BRAND_MEDIA_BUCKET = "brand-media";

/**
 * ★ Achado real (pedido direto do usuário — "acho que no treino da IA era
 * bom anexar umas artes pra ele entender a identidade visual da empresa"):
 * validado real (curl direto na API do Gemini) que anexar uma imagem de
 * referência junto do prompt de texto faz a geração puxar paleta/tom reais
 * da marca, em vez de só descrever cores em palavras. Máximo baixo
 * (`MAX_REFERENCE_IMAGES_PER_GENERATION`) — o ganho já apareceu com 1
 * imagem no teste real; mais que isso só aumenta custo/latência de
 * input sem benefício visto.
 */
const MAX_REFERENCE_IMAGES_PER_GENERATION = 2;

export interface BrandReferenceImage {
  mimeType: string;
  base64: string;
}

function mimeTypeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

/**
 * Baixa até `MAX_REFERENCE_IMAGES_PER_GENERATION` referências visuais da
 * marca (`brands.reference_image_paths`, migration 0022) já em base64,
 * prontas pra entrar como parte multimodal (`inlineData`) numa chamada de
 * geração de imagem do Gemini. Falha ao baixar 1 referência nunca bloqueia
 * a geração — pula essa e segue com as outras (ou nenhuma).
 */
export async function fetchBrandReferenceImages(
  db: SupabaseClient<Database>,
  brand: { reference_image_paths: string[] } | null,
): Promise<BrandReferenceImage[]> {
  const paths = (brand?.reference_image_paths ?? []).slice(0, MAX_REFERENCE_IMAGES_PER_GENERATION);
  if (paths.length === 0) return [];

  const results: BrandReferenceImage[] = [];
  for (const path of paths) {
    try {
      const { data, error } = await db.storage.from(BRAND_MEDIA_BUCKET).download(path);
      if (error || !data) throw error ?? new Error("download vazio");
      const buffer = Buffer.from(await data.arrayBuffer());
      results.push({ mimeType: mimeTypeFromPath(path), base64: buffer.toString("base64") });
    } catch (error) {
      logger.warn("asset_engine.fetch_brand_reference_images.failed", {
        path,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
