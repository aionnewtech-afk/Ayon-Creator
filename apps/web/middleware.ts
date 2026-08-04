import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/cadastro", "/recuperar-senha", "/auth/callback"];

/**
 * ★ Achado real (Missão 9, preparação do Fluxo 13): rotas de webhook/rota
 * interna servidor-a-servidor (Mercado Pago, e agora n8n/pipeline de vídeo)
 * nunca carregam cookie de sessão — o `matcher` abaixo cobre `/api/**`
 * inteiro, então toda chamada sem sessão caía no redirect para `/login`
 * (307), inclusive `/api/webhooks/mercado-pago`, que tem autenticação
 * própria por assinatura/segredo compartilhado e nunca deveria passar pelo
 * gate de sessão do Supabase Auth. Bug pré-existente, nunca pego porque
 * nenhum teste automatizado exercita o webhook do Mercado Pago via HTTP real
 * (só validação manual, que aparentemente nunca reproduziu esse caminho
 * exato). Confirmado agora com `curl` direto contra `/api/webhooks/
 * mercado-pago` antes desta correção.
 */
const WEBHOOK_PATH_PREFIXES = ["/api/webhooks/", "/api/pipeline/"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isWebhookPath(pathname: string): boolean {
  return WEBHOOK_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  if (isWebhookPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/cadastro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
