import { getMercadoPagoOverview } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/lib/session";
import { MercadoPagoTable } from "./mercado-pago-table";

export default async function AdminMercadoPagoPage() {
  const sessionDb = await createClient();
  const [rows, session] = await Promise.all([getMercadoPagoOverview(sessionDb), getCurrentSession()]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Mercado Pago</h1>
        <p className="text-sm text-muted-foreground">{rows.length} organizações — assinatura, pagamentos e status de webhook.</p>
      </div>

      <MercadoPagoTable rows={rows} role={session?.platformAdminRole ?? "support_admin"} />
    </div>
  );
}
