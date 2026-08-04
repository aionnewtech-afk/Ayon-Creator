-- Missão 8 — Learning Engine (Brand Evolution / "O que Funcionou"). Ver
-- docs/architecture.md §3.6, docs/database.md §4.7, docs/flows.md Fluxo 8.
-- Migration incremental — não recria nada de 0001-0011.

-- ---------------------------------------------------------------------------
-- intelligence_hub_sessions.related_entity_type ganha 'brand' — extensão
-- aditiva para o novo tipo de decisão `learning_analysis`, que não tem uma
-- campanha/peça/pesquisa de tendência específica como assunto (é uma análise
-- agregada de vários learning_signals da marca). Decisão do dono do produto:
-- Learning Engine é só mais um tipo de decisão do Intelligence Hub, não um
-- fluxo especial — toda sessão continua gerando specialist_opinions e um
-- Coordinator, com a mesma trilha de auditoria de campaign_strategy/
-- trend_ranking. Não afeta nenhuma sessão existente (constraint continua
-- aceitando 'trend_research'/'campaign'/'content_piece' sem mudança).
-- ---------------------------------------------------------------------------
alter table public.intelligence_hub_sessions
  drop constraint intelligence_hub_sessions_related_entity_type_check;

alter table public.intelligence_hub_sessions
  add constraint intelligence_hub_sessions_related_entity_type_check
  check (related_entity_type in ('trend_research', 'campaign', 'content_piece', 'brand'));

-- ---------------------------------------------------------------------------
-- learning_signals — captura eventos de aprovação/rejeição/edição de peça
-- (Fluxo 4). MVP da Missão 8 só emite approved/rejected/edited;
-- engagement_metric fica reservado no schema para uma missão futura (ainda
-- sem mecanismo de captura definido, flows.md Fluxo 5 passo 4).
-- ---------------------------------------------------------------------------
create table public.learning_signals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  content_piece_id uuid references public.content_pieces (id),
  signal_type text not null check (signal_type in ('approved', 'rejected', 'edited', 'engagement_metric')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.learning_signals enable row level security;

create policy "learning_signals_select_members"
  on public.learning_signals for select
  using (public.is_org_member(public.brand_organization_id(brand_id)));

create policy "learning_signals_insert_editors"
  on public.learning_signals for insert
  with check (public.is_org_editor(public.brand_organization_id(brand_id)));

-- ---------------------------------------------------------------------------
-- learning_insights — candidatos gerados pelo Learning Engine via Intelligence
-- Hub (learning_analysis). Sempre pending_review até decisão humana explícita
-- (Fluxo 8, regra inegociável — nenhuma aplicação automática em nenhum plano).
-- ---------------------------------------------------------------------------
create table public.learning_insights (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  insight_type text not null,
  summary jsonb not null,
  applied_to text not null check (applied_to in ('brand_brain', 'trend_engine', 'intelligence_hub', 'asset_engine')),
  status text not null default 'pending_review' check (status in ('pending_review', 'applied', 'dismissed')),
  reviewed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.learning_insights enable row level security;

create policy "learning_insights_select_members"
  on public.learning_insights for select
  using (public.is_org_member(public.brand_organization_id(brand_id)));

create policy "learning_insights_insert_editors"
  on public.learning_insights for insert
  with check (public.is_org_editor(public.brand_organization_id(brand_id)));

create policy "learning_insights_update_editors"
  on public.learning_insights for update
  using (public.is_org_editor(public.brand_organization_id(brand_id)));

-- ---------------------------------------------------------------------------
-- Specialist Registry: Marketing + Branding passam a cobrir também
-- `learning_analysis` — mesmo padrão já usado para habilitar `trend_ranking`
-- (migration 0006), sem criar nem alterar nenhum system_prompt já aprovado.
-- Copywriting fica de fora (mensagem de peça não é decisão de análise de
-- aprendizado). Coordinator já é decision-type-agnostic (migration 0007) —
-- reaproveitado sem mudança.
-- ---------------------------------------------------------------------------
update public.specialists
set applies_to = applies_to || array['learning_analysis']
where key in ('marketing_strategy', 'branding');
