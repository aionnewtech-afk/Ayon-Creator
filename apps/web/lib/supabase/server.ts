import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@ayon/types";

/**
 * Client Supabase para uso em Server Components, Server Actions e Route Handlers.
 * Nunca importar isto de um Client Component — camada exclusiva do servidor.
 */
export function createClient() {
  const cookieStore = cookies();

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
