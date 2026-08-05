import { Button, ThemeToggle } from "@ayon/ui";
import type { PlatformAdminRole } from "@ayon/types";
import { signOutAction } from "@/app/(platform)/actions";

const ROLE_LABELS: Record<PlatformAdminRole, string> = {
  super_admin: "Super Admin",
  support_admin: "Support Admin",
};

export interface AdminTopbarProps {
  role: PlatformAdminRole;
  userEmail: string | null;
}

export function AdminTopbar({ role, userEmail }: AdminTopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
      <span className="text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
      <div className="flex items-center gap-3">
        {userEmail ? <span className="hidden text-sm text-muted-foreground sm:inline">{userEmail}</span> : null}
        <ThemeToggle />
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </div>
    </header>
  );
}
