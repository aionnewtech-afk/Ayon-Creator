import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";

/**
 * Segmento administrativo (architecture.md §15.9) — `requirePlatformAdmin()`
 * aplicado uma vez aqui via `getCurrentSession()`, mesmo princípio de
 * proteção de layout já usado pelo grupo `(platform)` para exigir sessão
 * autenticada. Nenhum usuário comum consegue acessar nenhuma rota
 * administrativa, mesmo por URL direta.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session || !session.platformAdminRole) {
    redirect("/painel");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={session.platformAdminRole} />
      <div className="flex flex-1 flex-col">
        <AdminTopbar role={session.platformAdminRole} userEmail={session.user.email ?? null} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
