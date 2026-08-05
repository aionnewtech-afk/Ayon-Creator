-- Missão 12 — Super Admin (plataforma administrativa completa). Ver
-- docs/database.md §9.4/§9.5/§9.6, docs/architecture.md §15, docs/flows.md
-- Fluxo 16. Migration incremental — não recria nada de 0001-0019.

-- ---------------------------------------------------------------------------
-- platform_admins — identidade dos papéis administrativos (super_admin /
-- support_admin), desacoplada de organization_members/user_profiles (arch.
-- §15.1). Concessão do primeiro admin é manual, fora da aplicação.
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id),
  role text not null check (role in ('super_admin', 'support_admin')),
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.platform_admins enable row level security;

-- Sem policy para authenticated/anon de propósito — mesmo padrão de
-- provider_configs/specialists (database.md §8): leitura/escrita só via
-- service role.

-- ---------------------------------------------------------------------------
-- is_platform_admin / is_super_admin — funções de RLS (arch. §15.1).
-- is_platform_admin cobre os 2 papéis (usada para estender is_org_member/
-- is_org_admin/is_org_editor abaixo, e pelo portão de crédito); is_super_admin
-- cobre só o papel mais privilegiado (ações administrativas exclusivas).
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = p_user_id
      and pa.deleted_at is null
  );
$$;

create or replace function public.is_super_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = p_user_id
      and pa.role = 'super_admin'
      and pa.deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Extensão centralizada de RLS (arch. §15.2) — is_org_member/is_org_admin/
-- is_org_editor passam a conceder acesso também a qualquer platform_admin,
-- sem tocar em nenhuma policy individual que já usa essas 3 funções.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.deleted_at is null
  ) or public.is_platform_admin(auth.uid());
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.deleted_at is null
  ) or public.is_platform_admin(auth.uid());
$$;

create or replace function public.is_org_editor(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'editor')
      and m.deleted_at is null
  ) or public.is_platform_admin(auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- admin_audit_logs — auditoria dedicada de ações administrativas (arch.
-- §15.6). audit_logs (0001_init.sql) não muda. Append-only.
-- ---------------------------------------------------------------------------
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users (id),
  actor_role text not null check (actor_role in ('super_admin', 'support_admin')),
  organization_id uuid references public.organizations (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

-- Sem policy para authenticated/anon — leitura/escrita só via service role
-- (tela Auditoria, disponível aos 2 papéis via requirePlatformAdmin()).

create index admin_audit_logs_organization_id_idx on public.admin_audit_logs (organization_id);
create index admin_audit_logs_actor_user_id_idx on public.admin_audit_logs (actor_user_id);

-- ---------------------------------------------------------------------------
-- provider_call_logs — instrumentação real de latência/custo/erro por
-- chamada aos 4 providers reais (arch. §15.7). Append-only, alto volume.
-- ---------------------------------------------------------------------------
create table public.provider_call_logs (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  model text,
  endpoint text,
  capability text not null,
  organization_id uuid references public.organizations (id),
  request_id text,
  started_at timestamptz not null,
  finished_at timestamptz,
  latency_ms integer,
  status text not null check (status in ('success', 'error')),
  error_message text,
  tokens_input integer,
  tokens_output integer,
  cost_estimate_credits integer,
  created_at timestamptz not null default now()
);

alter table public.provider_call_logs enable row level security;

-- Sem policy para authenticated/anon — escrita pelos 4 adapters (service
-- role, mesmo client do Provider Gateway), leitura só pela tela Providers.

create index provider_call_logs_provider_key_idx on public.provider_call_logs (provider_key);
create index provider_call_logs_organization_id_idx on public.provider_call_logs (organization_id);
create index provider_call_logs_created_at_idx on public.provider_call_logs (created_at);

-- ---------------------------------------------------------------------------
-- organizations — bloqueio (status) e sinalização da organização "casa" do
-- Super Admin (arch. §15.3), sem excluir/afetar organizações existentes.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column status text not null default 'active' check (status in ('active', 'blocked')),
  add column is_platform_account boolean not null default false;

-- ---------------------------------------------------------------------------
-- user_profiles — bloqueio de usuário (arch. §15.8, tela Usuários).
-- ---------------------------------------------------------------------------
alter table public.user_profiles
  add column status text not null default 'active' check (status in ('active', 'blocked'));

-- ---------------------------------------------------------------------------
-- subscriptions — trial (arch. §15.8, tela Trials). "trialing" tratado como
-- assinatura ativa pelo portão de crédito (Fluxo 6, passo 1).
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  drop constraint subscriptions_status_check,
  add constraint subscriptions_status_check check (status in ('active', 'past_due', 'canceled', 'trialing')),
  add column trial_ends_at timestamptz;

-- ---------------------------------------------------------------------------
-- plans — conjunto ampliado de colunas (arch. §15.10): 2 renomeações (mesmo
-- dado, nome consistente com a família max_* nova) + limites/capacidade/
-- flags de recurso, preparando o modelo de negócio para "crédito + limite
-- por recurso" sem migration nova em poucos meses. Nenhum ponto de criação
-- existente valida nenhum desses campos nesta missão (decisão do dono do
-- produto) — só a tela Planos os edita.
-- ---------------------------------------------------------------------------
alter table public.plans
  rename column brands_included to max_brands;

alter table public.plans
  rename column credits_per_month to monthly_credits;

alter table public.plans
  add column max_users integer,
  add column max_campaigns integer,
  add column max_monthly_videos integer,
  add column max_monthly_images integer,
  add column storage_gb integer,
  add column priority_queue boolean not null default false,
  add column allow_ai_video boolean not null default true,
  add column allow_api boolean not null default false,
  add column allow_brand_customization boolean not null default true,
  add column allow_team boolean not null default false,
  add column allow_white_label boolean not null default false;

update public.plans set allow_team = true where plan = 'business';

-- ---------------------------------------------------------------------------
-- user_feedback — CRM interno (arch. §15.8, tela Feedbacks): arquivar,
-- resposta interna (nunca enviada ao usuário), marcar como resolvido,
-- excluir. Missão 10 não previa nenhuma interface administrativa (PRD §9.3);
-- esta é a primeira.
-- ---------------------------------------------------------------------------
alter table public.user_feedback
  add column status text not null default 'open' check (status in ('open', 'resolved')),
  add column internal_response text,
  add column archived_at timestamptz,
  add column deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- provider_configs — gestão real pelo admin (arch. §15.11): credencial de
-- verdade no banco (sem alterar .env), status "maintenance".
-- credentials_ref permanece — credential_value tem precedência quando
-- presente.
-- ---------------------------------------------------------------------------
alter table public.provider_configs
  add column credential_value text,
  drop constraint provider_configs_status_check,
  add constraint provider_configs_status_check check (status in ('active', 'inactive', 'error', 'maintenance'));
