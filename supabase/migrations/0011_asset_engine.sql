-- Missão 7 — Asset Engine (MVP: production_mode text_only/own_media). Ver
-- docs/architecture.md §3.5 e docs/database.md §4.6 (revisão 18). Migration
-- incremental — não recria nada de 0001–0010.

-- ---------------------------------------------------------------------------
-- Helper de RLS: organização a partir de uma campanha (join campaign → brand
-- → organization), mesmo padrão de intelligence_hub_session_organization_id
-- (0004_intelligence_hub.sql).
-- ---------------------------------------------------------------------------
create or replace function public.campaign_organization_id(p_campaign_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select b.organization_id
  from public.campaigns c
  join public.brands b on b.id = c.brand_id
  where c.id = p_campaign_id;
$$;

-- ---------------------------------------------------------------------------
-- content_pieces — uma peça do pacote de conteúdo de uma campanha.
-- ---------------------------------------------------------------------------
create table public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id),
  format text not null check (format in ('video', 'caption', 'stories', 'carousel', 'thumbnail', 'blog_post', 'email', 'script', 'teleprompter')),
  production_mode text check (production_mode in ('ai_avatar', 'licensed_stock_video', 'own_media', 'hybrid', 'text_only')),
  is_primary boolean not null default false,
  intelligence_hub_session_id uuid references public.intelligence_hub_sessions (id),
  script text,
  brand_rationale text,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready_for_review', 'approved', 'rejected')),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.content_pieces enable row level security;

create policy "content_pieces_select_members"
  on public.content_pieces for select
  using (public.is_org_member(public.campaign_organization_id(campaign_id)));

create policy "content_pieces_insert_editors"
  on public.content_pieces for insert
  with check (public.is_org_editor(public.campaign_organization_id(campaign_id)));

create policy "content_pieces_update_editors"
  on public.content_pieces for update
  using (public.is_org_editor(public.campaign_organization_id(campaign_id)));

-- ---------------------------------------------------------------------------
-- Helper de RLS: organização a partir de uma peça (join content_piece →
-- campaign → brand → organization).
-- ---------------------------------------------------------------------------
create or replace function public.content_piece_organization_id(p_content_piece_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select public.campaign_organization_id(cp.campaign_id)
  from public.content_pieces cp
  where cp.id = p_content_piece_id;
$$;

-- ---------------------------------------------------------------------------
-- content_versions — versão gerada (IA) ou enviada (upload manual) de uma peça.
-- ---------------------------------------------------------------------------
create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null references public.content_pieces (id),
  version_number int not null default 1,
  output_storage_path text,
  generation_metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.content_versions enable row level security;

create policy "content_versions_select_members"
  on public.content_versions for select
  using (public.is_org_member(public.content_piece_organization_id(content_piece_id)));

create policy "content_versions_insert_editors"
  on public.content_versions for insert
  with check (public.is_org_editor(public.content_piece_organization_id(content_piece_id)));

-- ---------------------------------------------------------------------------
-- content_packages — entrega final (zip) de uma campanha, 1:1.
-- ---------------------------------------------------------------------------
create table public.content_packages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.campaigns (id),
  storage_path text,
  status text not null default 'building' check (status in ('building', 'ready', 'failed')),
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.content_packages enable row level security;

create policy "content_packages_select_members"
  on public.content_packages for select
  using (public.is_org_member(public.campaign_organization_id(campaign_id)));

create policy "content_packages_insert_editors"
  on public.content_packages for insert
  with check (public.is_org_editor(public.campaign_organization_id(campaign_id)));

create policy "content_packages_update_editors"
  on public.content_packages for update
  using (public.is_org_editor(public.campaign_organization_id(campaign_id)));

-- ---------------------------------------------------------------------------
-- credit_ledger: nova coluna de rastreio de consumo por peça de conteúdo
-- (database.md §7.2, revisão 18 — não reaproveita related_intelligence_hub_
-- session_id porque peça derivada não abre sessão do Intelligence Hub).
-- ---------------------------------------------------------------------------
alter table public.credit_ledger
  add column related_content_piece_id uuid references public.content_pieces (id);

-- ---------------------------------------------------------------------------
-- credit_pricing: reajuste de trend_ranking (1/2/4 → 2/4/8) e nova operação
-- asset_generation (3/6/12) — decisão do dono do produto, Missão 7.
-- ---------------------------------------------------------------------------
update public.credit_pricing set credits = 2 where trigger_reason = 'trend_ranking' and tier = 'economico';
update public.credit_pricing set credits = 4 where trigger_reason = 'trend_ranking' and tier = 'balanceado';
update public.credit_pricing set credits = 8 where trigger_reason = 'trend_ranking' and tier = 'premium';

insert into public.credit_pricing (trigger_reason, tier, credits)
values
  ('asset_generation', 'economico', 3),
  ('asset_generation', 'balanceado', 6),
  ('asset_generation', 'premium', 12);
