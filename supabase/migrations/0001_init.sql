-- Sprint 1 — fundação: organizations, organization_members, brands, user_profiles,
-- audit_logs, feature_flags. Ver docs/database.md (revisão 5) e CONVENTIONS.md.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Função utilitária: mantém updated_at em toda escrita (CONVENTIONS.md §3)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'business')),
  provider_tier text not null default 'economico' check (provider_tier in ('economico', 'balanceado', 'premium')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references auth.users (id),
  role text not null default 'owner' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, user_id)
);

create trigger set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

alter table public.organization_members enable row level security;

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  niche text,
  provider_tier text check (provider_tier in ('economico', 'balanceado', 'premium')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id),
  full_name text,
  avatar_url text,
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- audit_logs (imutável — sem updated_at/deleted_at, ver CONVENTIONS.md §3)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  actor_user_id uuid references auth.users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- feature_flags (global, não multi-tenant)
-- ---------------------------------------------------------------------------
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: pertence à organização? (evita recursão de RLS entre tabelas)
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
  );
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
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — organizations
-- ---------------------------------------------------------------------------
create policy "organizations_select_members"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "organizations_insert_self"
  on public.organizations for insert
  with check (created_by = auth.uid());

create policy "organizations_update_admins"
  on public.organizations for update
  using (public.is_org_admin(id));

-- ---------------------------------------------------------------------------
-- RLS — organization_members
-- ---------------------------------------------------------------------------
create policy "organization_members_select_self_org"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- Permite duas situações: (1) o próprio criador da organização se auto-adiciona
-- como owner logo após criá-la (bootstrap do cadastro); (2) um admin/owner
-- existente adiciona outro membro (convite de time — Fluxo 7, sprint futura).
create policy "organization_members_insert_self"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and (
      public.is_org_admin(organization_id)
      or exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.created_by = auth.uid()
      )
    )
  );

create policy "organization_members_update_admins"
  on public.organization_members for update
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- RLS — brands
-- ---------------------------------------------------------------------------
create policy "brands_select_members"
  on public.brands for select
  using (public.is_org_member(organization_id));

create policy "brands_insert_members"
  on public.brands for insert
  with check (public.is_org_member(organization_id));

create policy "brands_update_admins"
  on public.brands for update
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- RLS — user_profiles (só o próprio usuário)
-- ---------------------------------------------------------------------------
create policy "user_profiles_select_self"
  on public.user_profiles for select
  using (user_id = auth.uid());

create policy "user_profiles_insert_self"
  on public.user_profiles for insert
  with check (user_id = auth.uid());

create policy "user_profiles_update_self"
  on public.user_profiles for update
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS — audit_logs (select: admin/owner da org; insert: qualquer membro,
-- só para registrar suas próprias ações — nunca em nome de terceiros)
-- ---------------------------------------------------------------------------
create policy "audit_logs_select_admins"
  on public.audit_logs for select
  using (public.is_org_admin(organization_id));

create policy "audit_logs_insert_members"
  on public.audit_logs for insert
  with check (
    public.is_org_member(organization_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS — feature_flags (leitura global para autenticados; escrita só service role)
-- ---------------------------------------------------------------------------
create policy "feature_flags_select_authenticated"
  on public.feature_flags for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Storage buckets (arquitetura §9.1) — privados, sem upload nesta sprint
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('brand-media', 'brand-media', false),
  ('knowledge-base', 'knowledge-base', false),
  ('content-output', 'content-output', false)
on conflict (id) do nothing;

create policy "brand_media_org_access"
  on storage.objects for all
  using (
    bucket_id = 'brand-media'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'brand-media'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "knowledge_base_org_access"
  on storage.objects for all
  using (
    bucket_id = 'knowledge-base'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'knowledge-base'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "content_output_org_access"
  on storage.objects for all
  using (
    bucket_id = 'content-output'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'content-output'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );
