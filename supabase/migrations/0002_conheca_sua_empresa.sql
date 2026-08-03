-- Missão 2 — "Conheça sua empresa": brand_brain_profiles, brand_onboarding_answers,
-- knowledge_base_items. Ver docs/database.md (revisão 9) e CONVENTIONS.md.
-- Migration incremental sobre 0001_init.sql — não recria nem altera tabelas existentes.

-- ---------------------------------------------------------------------------
-- Helpers de RLS escopados por brand (via organization_id do brand) — mesmo
-- padrão de public.is_org_member/is_org_admin (0001_init.sql), evitando
-- recursão de RLS.
-- ---------------------------------------------------------------------------
create or replace function public.brand_organization_id(p_brand_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.brands where id = p_brand_id;
$$;

-- Papel "editor ou acima" (owner/admin/editor) — usado por knowledge_base_items,
-- cuja permissão documentada (ux-design.md §2.2) é "Todos (editor+)", mais
-- ampla que is_org_admin (usado por brand_brain_profiles/brand_onboarding_answers,
-- cuja permissão documentada é "admin+ edita, demais visualizam").
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
  );
$$;

-- ---------------------------------------------------------------------------
-- brand_brain_profiles (1:1 com brands) — identidade operante da marca.
-- Sem deleted_at de propósito: vive e morre com o brand (que já tem seu
-- próprio soft delete); não faz sentido um perfil "deletado" independente.
-- ---------------------------------------------------------------------------
create table public.brand_brain_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands (id),
  company_history text,
  products_summary text,
  target_audience text,
  tone_of_voice text,
  competitors text[] not null default '{}',
  objectives text,
  differentiators text,
  forbidden_words text[] not null default '{}',
  favorite_words text[] not null default '{}',
  visual_guidelines jsonb not null default '{}'::jsonb,
  default_avatar_ref text,
  default_voice_ref text,
  learned_preferences jsonb not null default '{}'::jsonb,
  last_learning_update_at timestamptz,
  -- Estado da conversa "Conheça sua empresa" (necessidade descoberta na
  -- implementação — não bloqueava a doc, mas é indispensável para resumir/
  -- rotear corretamente): completed = os 5 temas foram cobertos e a síntese
  -- (ONB-3) está pronta para revisão; confirmed = o usuário confirmou a
  -- síntese ("Isso mesmo, pode seguir" — ux-design.md §4.2).
  onboarding_completed_at timestamptz,
  onboarding_confirmed_at timestamptz,
  onboarding_synthesis jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.brand_brain_profiles
  for each row execute function public.set_updated_at();

alter table public.brand_brain_profiles enable row level security;

create policy "brand_brain_profiles_select_members"
  on public.brand_brain_profiles for select
  using (public.is_org_member(public.brand_organization_id(brand_id)));

create policy "brand_brain_profiles_insert_admins"
  on public.brand_brain_profiles for insert
  with check (public.is_org_admin(public.brand_organization_id(brand_id)));

create policy "brand_brain_profiles_update_admins"
  on public.brand_brain_profiles for update
  using (public.is_org_admin(public.brand_organization_id(brand_id)));

-- ---------------------------------------------------------------------------
-- brand_onboarding_answers — histórico bruto da conversa "Conheça sua empresa"
-- (imutável, sem updated_at/deleted_at — CONVENTIONS.md §3, exceção de
-- tabela de log/evento). Uma resposta do usuário pode gerar mais de um
-- registro (um por question_key identificado naquele turno — architecture.md §6).
-- ---------------------------------------------------------------------------
create table public.brand_onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  question_key text not null check (question_key in (
    'company_history', 'products', 'customers', 'tone_of_voice',
    'competitors', 'objectives', 'differentiators',
    'forbidden_words', 'favorite_words'
  )),
  answer_text text not null,
  created_at timestamptz not null default now()
);

alter table public.brand_onboarding_answers enable row level security;

create policy "brand_onboarding_answers_select_members"
  on public.brand_onboarding_answers for select
  using (public.is_org_member(public.brand_organization_id(brand_id)));

create policy "brand_onboarding_answers_insert_admins"
  on public.brand_onboarding_answers for insert
  with check (public.is_org_admin(public.brand_organization_id(brand_id)));

-- ---------------------------------------------------------------------------
-- knowledge_base_items — corpus de conhecimento retrivável da marca.
-- Permissão "editor+" (ux-design.md §2.2), mais ampla que brand_brain_profiles.
-- `embedding` (pgvector) deliberadamente omitido nesta migration — decisão em
-- aberto database.md §10.3; adicionar via migration incremental futura quando
-- resolvida, sem impacto nas colunas aqui.
-- ---------------------------------------------------------------------------
create table public.knowledge_base_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  source_type text not null check (source_type in (
    'document', 'past_content', 'faq', 'performance_note',
    'manual_note', 'onboarding_conversation'
  )),
  title text not null,
  content_text text,
  storage_path text,
  tags text[] not null default '{}',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_updated_at
  before update on public.knowledge_base_items
  for each row execute function public.set_updated_at();

alter table public.knowledge_base_items enable row level security;

create policy "knowledge_base_items_select_members"
  on public.knowledge_base_items for select
  using (public.is_org_member(public.brand_organization_id(brand_id)));

create policy "knowledge_base_items_insert_editors"
  on public.knowledge_base_items for insert
  with check (public.is_org_editor(public.brand_organization_id(brand_id)));

create policy "knowledge_base_items_update_editors"
  on public.knowledge_base_items for update
  using (public.is_org_editor(public.brand_organization_id(brand_id)));
