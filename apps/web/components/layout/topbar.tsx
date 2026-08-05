import { Button, ThemeToggle } from "@ayon/ui";
import { signOutAction } from "@/app/(platform)/actions";
import { FeedbackButton } from "./feedback-button";

export interface TopbarProps {
  organizationName: string;
  userEmail: string | null;
}

export function Topbar({ organizationName, userEmail }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
      <span className="text-sm font-medium text-foreground">{organizationName}</span>
      <div className="flex items-center gap-3">
        {userEmail ? <span className="hidden text-sm text-muted-foreground sm:inline">{userEmail}</span> : null}
        <FeedbackButton />
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
