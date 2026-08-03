-- Provider Layer — provider_configs (database.md §5.1, architecture.md §5).
-- Mapeamento interno (capability, tier) → fornecedor concreto. Necessário para
-- a Missão 2 poder resolver o LLM Provider da conversa "Conheça sua empresa"
-- sem acoplar o Core Engine a um fornecedor específico (PRD §1.1, item 7).
--
-- Acesso: nenhuma policy de select/insert/update é criada para `authenticated`
-- de propósito — a tabela é "acessível apenas por papel administrativo interno"
-- (database.md §8). O Provider Gateway lê esta tabela usando o service role
-- (que ignora RLS), nunca a sessão do usuário final.

create table public.provider_configs (
  id uuid primary key default gen_random_uuid(),
  capability text not null check (capability in ('llm', 'avatar', 'voice', 'media', 'trend_source')),
  tier text not null check (tier in ('economico', 'balanceado', 'premium')),
  specialist_type text check (specialist_type in (
    'marketing', 'copywriting', 'branding', 'niche', 'seo', 'social_media', 'data', 'coordinator'
  )),
  provider_key text not null,
  credentials_ref text,
  priority int not null default 0,
  fallback_provider_key text,
  status text not null default 'active' check (status in ('active', 'inactive', 'error')),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.provider_configs
  for each row execute function public.set_updated_at();

alter table public.provider_configs enable row level security;

-- Sem policies para authenticated/anon — leitura só via service role
-- (Provider Gateway). Ver nota acima.

-- Seed mínimo para a Missão 2: LLM Provider único por enquanto para todos os
-- tiers (mapeamento tier→fornecedor específico é decisão em aberto PRD §13.2 —
-- este seed é só o suficiente para a conversa "Conheça sua empresa" funcionar,
-- não resolve a decisão de produto).
insert into public.provider_configs (capability, tier, provider_key, status)
values
  ('llm', 'economico', 'claude-sonnet-4-5', 'active'),
  ('llm', 'balanceado', 'claude-sonnet-4-5', 'active'),
  ('llm', 'premium', 'claude-sonnet-4-5', 'active');
