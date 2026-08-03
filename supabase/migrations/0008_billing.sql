-- Missão 6 — Billing. Ver docs/architecture.md §12 e docs/database.md §7
-- (revisão 16). Migration incremental — não recria nada de 0001–0007.

-- ---------------------------------------------------------------------------
-- subscriptions — uma linha por organização, billing é sempre no nível da
-- organização (Fluxo 7, passo 3). Sincronizada via webhook do Mercado Pago
-- (Preapproval) — nunca escrita diretamente pelo client.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id),
  plan text not null check (plan in ('starter', 'pro', 'business')),
  status text not null default 'past_due' check (status in ('active', 'past_due', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  billing_provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_members"
  on public.subscriptions for select
  using (public.is_org_member(organization_id));

-- Sem policy de insert/update para authenticated/anon de propósito — só o
-- portão de crédito (Server Action) e o handler de webhook, ambos rodando
-- com service role, escrevem aqui (arch. §12.3).

-- ---------------------------------------------------------------------------
-- credit_ledger — livro-razão append-only. Saldo é sempre SUM(amount) por
-- organization_id, nunca uma coluna de saldo cacheada.
-- ---------------------------------------------------------------------------
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  type text not null check (type in ('grant_plan', 'purchase', 'consumption', 'adjustment')),
  amount integer not null,
  related_intelligence_hub_session_id uuid references public.intelligence_hub_sessions (id),
  external_payment_id text unique,
  description text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

create policy "credit_ledger_select_members"
  on public.credit_ledger for select
  using (public.is_org_member(organization_id));

-- Sem policy de insert para authenticated/anon de propósito — todo lançamento
-- (grant_plan, consumption, purchase via webhook, adjustment manual) passa
-- pelo módulo de Billing com service role, nunca escrito direto pelo client
-- (arch. §12.1). external_payment_id único garante idempotência de webhook.

create index credit_ledger_organization_id_idx on public.credit_ledger (organization_id);

-- ---------------------------------------------------------------------------
-- credit_pricing — preço em créditos por trigger_reason + tier (não
-- capability + tier: campaign_strategy e trend_ranking usam a mesma
-- capability "llm" mas custam diferente). Mesmo padrão de provider_configs/
-- specialists: sem policy de escrita para usuário final, leitura liberada
-- (preço deve ser visível ao cliente, ex. CFG-4).
-- ---------------------------------------------------------------------------
create table public.credit_pricing (
  id uuid primary key default gen_random_uuid(),
  trigger_reason text not null,
  tier text not null check (tier in ('economico', 'balanceado', 'premium')),
  credits integer not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  updated_at timestamptz not null default now(),
  unique (trigger_reason, tier)
);

create trigger set_updated_at
  before update on public.credit_pricing
  for each row execute function public.set_updated_at();

alter table public.credit_pricing enable row level security;

create policy "credit_pricing_select_authenticated"
  on public.credit_pricing for select
  to authenticated
  using (true);

-- Seed inicial (architecture.md §12.4, decisão de produto da Missão 6):
-- barato no raciocínio (Intelligence Hub), caro na geração de mídia futura
-- (Asset Engine, ainda não implementado, sem linha aqui até existir).
insert into public.credit_pricing (trigger_reason, tier, credits)
values
  ('trend_ranking', 'economico', 1),
  ('trend_ranking', 'balanceado', 2),
  ('trend_ranking', 'premium', 4),
  ('campaign_strategy', 'economico', 5),
  ('campaign_strategy', 'balanceado', 10),
  ('campaign_strategy', 'premium', 20);

-- ---------------------------------------------------------------------------
-- credit_packages — catálogo de pacotes de créditos avulsos (Checkout Pro).
-- Dado, não hardcoded no código — mudar o catálogo é uma mudança de linha.
-- ---------------------------------------------------------------------------
create table public.credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits integer not null,
  price_cents integer not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

alter table public.credit_packages enable row level security;

create policy "credit_packages_select_authenticated"
  on public.credit_packages for select
  to authenticated
  using (true);

insert into public.credit_packages (name, credits, price_cents)
values
  ('Pacote Pequeno', 100, 4990),
  ('Pacote Médio', 350, 14990),
  ('Pacote Grande', 1000, 34990);
