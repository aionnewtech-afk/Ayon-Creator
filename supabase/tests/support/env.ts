/**
 * Testes de RLS/concorrência (Missão H2, CONVENTIONS.md §10) rodam contra
 * um Postgres local efêmero (`supabase start`), nunca contra o projeto
 * remoto — por isso as credenciais vêm sempre de variáveis de ambiente
 * explícitas, sem nenhum valor hardcoded aqui (nem o par
 * anon/service_role "demo" padrão do Supabase CLI, para não arriscar ficar
 * desatualizado se o projeto algum dia customizar `auth.jwt_secret`).
 *
 * Como popular localmente: `supabase start` imprime os 3 valores; em CI,
 * `.github/workflows/ci.yml` lê de `supabase status -o json` depois de
 * subir o stack e exporta como env vars antes de rodar a suíte.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} não configurada — os testes de supabase/tests/ precisam de um Supabase local rodando ` +
        `(\`supabase start\`) com SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY exportadas ` +
        `(\`supabase status -o json\` imprime os 3 valores).`,
    );
  }
  return value;
}

export function getTestSupabaseConfig() {
  return {
    url: requireEnv("SUPABASE_URL"),
    anonKey: requireEnv("SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
