import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { VideoBranding } from "../providers/video-render-provider";
import { resolveFontUrl } from "./font-catalog";

const BRAND_MEDIA_BUCKET = "brand-media";
/** Tempo suficiente para o Video Render Provider ainda buscar o arquivo pela URL durante a composição. */
const LOGO_SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Resolve a identidade visual de uma marca (arch. §14.1) em `VideoBranding`
 * — único ponto que converte `brands.logo_storage_path`/`font_family` em
 * URLs prontas para o Video Render Provider consumir. Nunca chamado pelo
 * provider em si (desacoplamento de sempre, §5.1) — só pelo Asset Engine.
 *
 * Marca sem logo/cor/fonte cadastrados devolve campos `null`/`undefined` —
 * nunca lança erro, o comportamento adaptativo (arch. §14.8) trata a
 * ausência no template de composição.
 */
export async function resolveBrandBranding(
  db: SupabaseClient<Database>,
  brand: Database["public"]["Tables"]["brands"]["Row"] | null,
): Promise<VideoBranding> {
  if (!brand) return {};

  let logoUrl: string | null = null;
  if (brand.logo_storage_path) {
    const { data: signed } = await db.storage
      .from(BRAND_MEDIA_BUCKET)
      .createSignedUrl(brand.logo_storage_path, LOGO_SIGNED_URL_TTL_SECONDS);
    logoUrl = signed?.signedUrl ?? null;
  }

  return {
    logoUrl,
    primaryColorHex: brand.primary_color_hex,
    secondaryColorHex: brand.secondary_color_hex,
    fontUrl: resolveFontUrl(brand.font_family) ?? null,
  };
}
