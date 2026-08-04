import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@ayon/types";

/**
 * Client Supabase para uso em Server Components, Server Actions e Route Handlers.
 * Nunca importar isto de um Client Component — camada exclusiva do servidor.
 *
 * ★ Hardening (Missão H1, docs/hardening-plan.md item 5.2 — migração para
 * Next.js 15): `cookies()` virou assíncrono. `createClient()` agora
 * `async`/`await`s `cookies()` diretamente — decisão deliberada de não usar
 * o atalho `UnsafeUnwrappedCookies` do codemod oficial (documentado pelo
 * próprio Next.js como temporário, com remoção planejada numa versão
 * futura). Todo chamador precisa de `await createClient()`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // chamado a partir de um Server Component sem permissão de escrita
            // de cookies — o middleware garante que a sessão é atualizada.
          }
        },
      },
    },
  );
}
