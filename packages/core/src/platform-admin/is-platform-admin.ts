import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlatformAdminRole } from "@ayon/types";

/**
 * Único ponto de checagem de "este usuário é um admin de plataforma?"
 * (architecture.md §15.1) — reutilizado tanto pelo portão de crédito
 * (`billing/credit-gate.ts`, bypass de `super_admin`/`support_admin`) quanto
 * pelos guards de Server Action (`platform-admin/require-platform-admin.ts`),
 * nunca duplicado entre os dois.
 *
 * `isPlatformAdmin` cobre os 2 papéis (leitura/impersonação/uso ilimitado);
 * `isSuperAdmin` cobre só o papel mais privilegiado (ações administrativas
 * exclusivas — matriz completa em architecture.md §15.1.1). Espelham as
 * funções SQL homônimas usadas pela extensão de RLS, mas são consultas TS
 * independentes — nenhuma Server Action depende de RLS para decidir o que
 * mostrar/permitir na UI administrativa.
 */
export async function isPlatformAdmin(db: SupabaseClient<Database>, userId: string): Promise<boolean> {
  // ★ Achado real (validação real do pipeline de foto/vídeo): `pipeline_runs.actor_user_id`
  // é nullable de propósito ("ações de sistema", docs/database.md) —
  // `completePhotoPipelineSuccess`/`completeVideoPipelineSuccess` caem para
  // `""` quando é `null` (o tipo de `actorUserId` no portão de crédito é
  // `string`, não `string | null`). Sem essa guarda, `.eq("user_id", "")`
  // batia numa coluna uuid e o Postgres lançava "invalid input syntax for
  // type uuid" em vez de simplesmente responder "não é admin".
  if (!userId) return false;

  const { data, error } = await db
    .from("platform_admins")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function isSuperAdmin(db: SupabaseClient<Database>, userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await db
    .from("platform_admins")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

/**
 * Papel exato do ator no momento da chamada — usado por `recordAdminAction`
 * para gravar `admin_audit_logs.actor_role` (preservado mesmo que o papel
 * mude/seja revogado depois, arch. §15.6). `null` quando o usuário não é
 * platform_admin — chamadores que já passaram por `requirePlatformAdmin`
 * nunca recebem `null` na prática.
 */
export async function getPlatformAdminRole(db: SupabaseClient<Database>, userId: string): Promise<PlatformAdminRole | null> {
  const { data, error } = await db
    .from("platform_admins")
    .select("role")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data?.role ?? null;
}
