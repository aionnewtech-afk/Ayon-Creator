import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";

/**
 * Client Supabase de **service role** — ignora RLS. Uso restrito a tabelas
 * sem policy para o usuário final (ex.: `provider_configs`, database.md §8).
 * Nunca usar para ler/escrever dados de organização/marca — para isso, o
 * client de sessão (`./server.ts`) é sempre o correto, porque é ele quem
 * garante isolamento por `organization_id`/`brand_id` via RLS.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
