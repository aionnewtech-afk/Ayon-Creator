import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

export interface BrandOverviewRow {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  logoStoragePath: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  fontFamily: string | null;
  visualStyle: string | null;
}

/** Visão de Branding cross-organização (architecture.md §15.8) — brands + organizations, client de sessão (§15.2). */
export async function getBrandsOverview(db: SupabaseClient<Database>): Promise<BrandOverviewRow[]> {
  const [brandsResult, organizationsResult] = await Promise.all([
    db.from("brands").select("*").is("deleted_at", null).order("name", { ascending: true }),
    db.from("organizations").select("id, name"),
  ]);

  if (brandsResult.error) throw brandsResult.error;
  if (organizationsResult.error) throw organizationsResult.error;

  const organizationNameById = new Map((organizationsResult.data ?? []).map((row) => [row.id, row.name]));

  return (brandsResult.data ?? []).map((brand) => ({
    id: brand.id,
    organizationId: brand.organization_id,
    organizationName: organizationNameById.get(brand.organization_id) ?? "—",
    name: brand.name,
    logoStoragePath: brand.logo_storage_path,
    primaryColorHex: brand.primary_color_hex,
    secondaryColorHex: brand.secondary_color_hex,
    fontFamily: brand.font_family,
    visualStyle: brand.visual_style,
  }));
}
