import { getUsersOverview } from "@ayon/core";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { UsersTable } from "./users-table";

export default async function AdminUsersPage() {
  const serviceRoleDb = createServiceRoleClient();
  const rows = await getUsersOverview(serviceRoleDb);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Usuários</h1>
        <p className="text-sm text-muted-foreground">{rows.length} vínculos de usuário — papel, status e último acesso.</p>
      </div>

      <UsersTable rows={rows} />
    </div>
  );
}
