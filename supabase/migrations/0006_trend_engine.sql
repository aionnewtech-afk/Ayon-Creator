-- Missão 5 — Trend Engine ("O que está em alta"). Ver docs/architecture.md
-- §3.3 e docs/database.md §4.3 (schema já especificado desde a revisão 2,
-- sem mudança nesta migration além da FK e da nulabilidade de provider_key
-- explicadas abaixo). Migration incremental — não recria nada de 0001–0005.

-- ---------------------------------------------------------------------------
-- trend_research — uma execução de descoberta de tendências para uma marca.
-- provider_key é nullable e só é preenchido quando a busca termina (mesmo
-- padrão de intelligence_hub_sessions.coordinator_provider_key) — a linha
-- nasce em status 'pending' antes de qualquer chamada ao Trend Source
-- Provider ter concluído (Fluxo 2, passo 2).
-- ---------------------------------------------------------------------------
create table public.trend_research (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  provider_key text,
  summary jsonb,
  intelligence_hub_session_id uuid references public.intelligence_hub_sessions (id),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.trend_research enable row level security;

create policy "trend_research_select_members"
  on public.trend_research for select
  using (public.is_org_member(public.brand_organization_id(brand_id)));

create policy "trend_research_insert_editors"
  on public.trend_research for insert
  with check (public.is_org_editor(public.brand_organization_id(brand_id)));

create policy "trend_research_update_editors"
  on public.trend_research for update
  using (public.is_org_editor(public.brand_organization_id(brand_id)));

-- ---------------------------------------------------------------------------
-- campaigns.trend_research_id: era uuid sem FK real (0004_intelligence_hub.sql,
-- porque trend_research ainda não existia). Agora que a tabela existe, vira
-- FK de verdade — nenhuma linha existente tem trend_research_id preenchido
-- (Missão 3/4 não geraram nenhuma), então não há dado a migrar.
-- ---------------------------------------------------------------------------
alter table public.campaigns
  add constraint campaigns_trend_research_id_fkey
  foreign key (trend_research_id) references public.trend_research (id);

-- ---------------------------------------------------------------------------
-- provider_configs: novo capability 'trend_source' (architecture.md §3.3,
-- revisão 15) — mesmo fornecedor (Anthropic) que já resolve 'llm' hoje, só
-- que com a ferramenta de busca web nativa anexada pelo adapter. O Trend
-- Engine só conhece o contrato `trend_source`, nunca a Anthropic diretamente
-- (arquitetura via Provider Gateway). Mesmo padrão de 0003: os 3 tiers
-- resolvem para o mesmo provider_key por enquanto (decisão de produto
-- PRD §13.2 segue em aberto).
-- ---------------------------------------------------------------------------
insert into public.provider_configs (capability, tier, provider_key, status)
values
  ('trend_source', 'economico', 'claude-sonnet-4-5', 'active'),
  ('trend_source', 'balanceado', 'claude-sonnet-4-5', 'active'),
  ('trend_source', 'premium', 'claude-sonnet-4-5', 'active');

-- ---------------------------------------------------------------------------
-- Specialist Registry: nenhum especialista existente se aplica a
-- 'trend_ranking' ainda (todos os 3 da Missão 3 são só 'campaign_strategy').
-- Regra inegociável da Missão 5 (architecture.md §3.3): nenhuma tendência
-- entra em estratégia sem passar pelo Intelligence Hub — isso exige pelo
-- menos um especialista aplicável. Decisão de implementação (mudança de
-- dado, não de arquitetura — Specialist Registry existe exatamente para
-- isso): amplia Marketing (relevância/público) e Branding (fit de
-- identidade) para também opinarem sobre ranqueamento de tendências, sem
-- criar nem alterar nenhum system_prompt já aprovado. Copywriting fica de
-- fora (mensagem de peça não é decisão de ranqueamento de tendência).
-- Coordinator já é decision-type-agnostic (applies_to = '{}') — reaproveitado
-- sem mudança.
-- ---------------------------------------------------------------------------
update public.specialists
set applies_to = applies_to || array['trend_ranking']
where key in ('marketing_strategy', 'branding');
