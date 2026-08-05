import { getBrandsOverview } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { BrandingTable } from "./branding-table";

const BRAND_MEDIA_BUCKET = "brand-media";

export default async function AdminBrandingPage() {
  const sessionDb = await createClient();
  const rows = await getBrandsOverview(sessionDb);

  const rowsWithLogoUrl = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      logoUrl: row.logoStoragePath
        ? ((await sessionDb.storage.from(BRAND_MEDIA_BUCKET).createSignedUrl(row.logoStoragePath, 3600)).data?.signedUrl ?? null)
        : null,
    })),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Branding</h1>
        <p className="text-sm text-muted-foreground">{rows.length} marcas — logo, cores, fonte e estilo visual, todas as organizações.</p>
      </div>

      <BrandingTable rows={rowsWithLogoUrl} />
    </div>
  );
}
