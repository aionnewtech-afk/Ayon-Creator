import "server-only";
import { cookies } from "next/headers";

/**
 * Impersonação (architecture.md §15.4) — cookie `httpOnly`, nunca lido/confiado
 * sozinho: `getCurrentSession()` sempre revalida `is_platform_admin()` do
 * usuário real antes de honrar o valor (`lib/session.ts`).
 */
export const IMPERSONATION_COOKIE_NAME = "impersonating_organization_id";

export async function getImpersonatingOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value ?? null;
}
