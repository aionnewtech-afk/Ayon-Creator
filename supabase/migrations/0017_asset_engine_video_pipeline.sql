-- Missão 9, Etapa 1 — Asset Engine ganha geração automática de vídeo
-- (licensed_stock_video: ElevenLabs + Pexels + Shotstack, orquestrado pelo
-- n8n). Ver docs/architecture.md §3.5.1/§5/§8, docs/database.md §4.6/§4.8/
-- §7.2/§7.3, docs/flows.md Fluxo 13. Migration incremental — não recria nada
-- de 0001-0016.

-- ---------------------------------------------------------------------------
-- provider_configs.capability ganha `video_render` — capacidade nova da
-- Provider Layer (composição final de vídeo). Extensão aditiva, mesmo padrão
-- já usado em 0012 para intelligence_hub_sessions.related_entity_type.
-- ---------------------------------------------------------------------------
alter table public.provider_configs
  drop constraint provider_configs_capability_check;

alter table public.provider_configs
  add constraint provider_configs_capability_check
  check (capability in ('llm', 'avatar', 'voice', 'media', 'trend_source', 'video_render'));

-- ---------------------------------------------------------------------------
-- content_pieces.status ganha `failed` — primeira peça que pode falhar
-- depois de `generating` sem intervenção humana no meio (pipeline
-- assíncrono de vídeo via n8n, Fluxo 13). Extensão aditiva, não afeta
-- nenhuma peça existente (todas continuam nos status já aceitos).
-- ---------------------------------------------------------------------------
alter table public.content_pieces
  drop constraint content_pieces_status_check;

alter table public.content_pieces
  add constraint content_pieces_status_check
  check (status in ('draft', 'generating', 'ready_for_review', 'approved', 'rejected', 'failed'));

-- ---------------------------------------------------------------------------
-- pipeline_runs — achado durante a implementação da Missão 9: esta tabela
-- estava documentada em database.md §4.8 desde revisões antigas como já
-- existente, mas nenhuma migration jamais a criou (nenhuma missão até a 8
-- precisou de fato de execução assíncrona via n8n). Primeira `create table`
-- real. Helper `pipeline_run_organization_id` cobre `entity_type =
-- 'content_piece'` (único tipo escrito por código até agora); os demais
-- valores do enum documentado (`trend_research`, `campaign`,
-- `intelligence_hub_session`) retornam null por enquanto — extensível sem
-- quebrar nada quando/se algum desses tipos passar a gravar linhas aqui.
-- ---------------------------------------------------------------------------
create table public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('trend_research', 'campaign', 'content_piece', 'intelligence_hub_session')),
  entity_id uuid not null,
  engine text not null check (engine in ('trend_engine', 'intelligence_hub', 'asset_engine', 'brand_brain', 'learning_engine')),
  n8n_execution_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create or replace function public.pipeline_run_organization_id(p_entity_type text, p_entity_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select case p_entity_type
    when 'content_piece' then public.content_piece_organization_id(p_entity_id)
    else null
  end;
$$;

alter table public.pipeline_runs enable row level security;

create policy "pipeline_runs_select_members"
  on public.pipeline_runs for select
  using (public.is_org_member(public.pipeline_run_organization_id(entity_type, entity_id)));

create policy "pipeline_runs_insert_editors"
  on public.pipeline_runs for insert
  with check (public.is_org_editor(public.pipeline_run_organization_id(entity_type, entity_id)));

create policy "pipeline_runs_update_editors"
  on public.pipeline_runs for update
  using (public.is_org_editor(public.pipeline_run_organization_id(entity_type, entity_id)));

create index pipeline_runs_entity_idx on public.pipeline_runs (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- credit_ledger: nova coluna de idempotência para o débito assíncrono do
-- pipeline de vídeo (arch. §12.3) — o webhook de conclusão do n8n registra o
-- consumo, não a Server Action original; `unique` garante que uma reentrega
-- do mesmo webhook não debite duas vezes, mesmo princípio de
-- external_payment_id para o Mercado Pago.
-- ---------------------------------------------------------------------------
alter table public.credit_ledger
  add column related_pipeline_run_id uuid unique references public.pipeline_runs (id);

-- ---------------------------------------------------------------------------
-- credit_pricing — novo trigger_reason `video_generation`, deliberadamente
-- separado de `asset_generation` (decisão do dono do produto, Missão 9):
-- geração de vídeo consome múltiplos fornecedores pagos externos (voz,
-- mídia, renderização), custo real maior e mais variável que uma única
-- chamada de LLM. VALORES PLACEHOLDER — precificação exata é decisão em
-- aberto (PRD §13, item 11); ajustar por UPDATE numa migration futura,
-- nunca editando esta.
-- ---------------------------------------------------------------------------
insert into public.credit_pricing (trigger_reason, tier, credits)
values
  ('video_generation', 'economico', 15),
  ('video_generation', 'balanceado', 30),
  ('video_generation', 'premium', 50);

-- ---------------------------------------------------------------------------
-- provider_configs — seed inicial das 3 capacidades novas da Etapa 1. Um
-- único fornecedor por capability, o mesmo em todos os tiers (decisão do
-- dono do produto para o MVP — PRD §13, item 2, resolvido nesta missão).
-- `provider_key` é o identificador lógico usado pelo Provider Gateway para
-- resolver o adapter concreto — a credencial real vem de env var
-- (ELEVENLABS_API_KEY/PEXELS_API_KEY/SHOTSTACK_API_KEY), nunca desta tabela
-- (credentials_ref permanece null, mesmo padrão do LLM Provider).
-- ---------------------------------------------------------------------------
insert into public.provider_configs (capability, tier, provider_key, status)
values
  ('voice', 'economico', 'elevenlabs', 'active'),
  ('voice', 'balanceado', 'elevenlabs', 'active'),
  ('voice', 'premium', 'elevenlabs', 'active'),
  ('media', 'economico', 'pexels', 'active'),
  ('media', 'balanceado', 'pexels', 'active'),
  ('media', 'premium', 'pexels', 'active'),
  ('video_render', 'economico', 'shotstack', 'active'),
  ('video_render', 'balanceado', 'shotstack', 'active'),
  ('video_render', 'premium', 'shotstack', 'active');
