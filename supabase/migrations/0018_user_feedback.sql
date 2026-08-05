-- Missão 10 — Feedback do Usuário (utilitário transversal, arch. §13). Ver
-- docs/database.md §9.3, docs/flows.md Fluxo 14. Migration incremental —
-- não recria nada de 0001-0017.

-- ---------------------------------------------------------------------------
-- user_feedback — captura simples de sugestões/bugs/dificuldades/outros
-- enviados pelo botão global "Enviar feedback". Append-only: sem update_at,
-- cada envio é uma linha nova e definitiva. Contexto (pathname/app_version/
-- user_agent) é sempre capturado pela aplicação, nunca preenchido
-- manualmente pelo usuário (arch. §13.1.1).
-- ---------------------------------------------------------------------------
create table public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references auth.users (id),
  category text not null check (category in ('suggestion', 'bug', 'difficulty', 'other')),
  description text not null,
  pathname text,
  app_version text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.user_feedback enable row level security;

-- Insert liberado a membros da organização, mas sempre em nome do próprio
-- usuário — nunca em nome de outro membro (mesmo padrão de defesa já usado
-- em toda tabela do produto que grava `user_id`/`created_by`).
create policy "user_feedback_insert_members"
  on public.user_feedback for insert
  with check (public.is_org_member(organization_id) and user_id = auth.uid());

-- Sem policy de select/update/delete para authenticated/anon de propósito —
-- mesmo padrão de provider_configs/specialists (database.md §8): leitura só
-- via service role, sem interface administrativa nesta missão (PRD §9.3).

create index user_feedback_organization_id_idx on public.user_feedback (organization_id);
