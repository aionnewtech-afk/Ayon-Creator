-- Missão 6 — tabela `plans`: números de cada plano (créditos/mês, marcas
-- inclusas, tier incluso, preço) como dado, não código — mesmo padrão de
-- credit_pricing/credit_packages/provider_configs/specialists. Sem esta
-- tabela, o valor de créditos a conceder por plano teria que ser hardcoded
-- tanto no handler de webhook (packages/core, nunca importa de apps/web)
-- quanto na tela de Configurações (apps/web) — duas fontes da verdade
-- arriscando divergir. `plans.plan` é a mesma chave usada em
-- `subscriptions.plan`.
create table public.plans (
  plan text primary key check (plan in ('starter', 'pro', 'business')),
  brands_included integer not null,
  tier_included text not null check (tier_included in ('economico', 'balanceado', 'premium')),
  credits_per_month integer not null,
  price_cents integer not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;

create policy "plans_select_authenticated"
  on public.plans for select
  to authenticated
  using (true);

-- Seed (PRD.md §8, arch. §12.5 — números aprovados pelo dono do produto;
-- price_cents é valor de exemplo, nunca discutido explicitamente, ajustável
-- livremente sem migration nova, só um UPDATE).
insert into public.plans (plan, brands_included, tier_included, credits_per_month, price_cents)
values
  ('starter', 1, 'economico', 100, 9700),
  ('pro', 1, 'balanceado', 500, 29700),
  ('business', 5, 'premium', 1500, 69700);
