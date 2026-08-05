import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session || !session.organization || !session.membership) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {session.isImpersonating ? <ImpersonationBanner organizationName={session.organization.name} /> : null}
      <div className="flex flex-1">
        <Sidebar role={session.membership.role} />
        <div className="flex flex-1 flex-col">
          <Topbar organizationName={session.organization.name} userEmail={session.user.email ?? null} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
