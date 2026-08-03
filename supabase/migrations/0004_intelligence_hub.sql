-- Missão 3 — Intelligence Hub (primeira versão funcional): Specialist Registry,
-- sessões, opiniões e campanhas. Ver docs/architecture.md §4.1 e docs/database.md
-- (revisão 10). Migration incremental — não recria nada de 0001/0002/0003.

-- ---------------------------------------------------------------------------
-- specialists (Specialist Registry — architecture.md §4.1) — especialistas e
-- o Coordinator não são papéis fixos no código, são linhas aqui. Sem policy de
-- RLS para authenticated/anon de propósito: administração interna da Ayon,
-- mesmo padrão de provider_configs.
-- ---------------------------------------------------------------------------
create table public.specialists (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  role text not null default 'specialist' check (role in ('specialist', 'coordinator')),
  name text not null,
  objective text not null,
  system_prompt text not null,
  provider_capability text not null default 'llm' check (provider_capability in ('llm', 'avatar', 'voice', 'media', 'trend_source')),
  applies_to text[] not null default '{}',
  priority int not null default 0,
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.specialists
  for each row execute function public.set_updated_at();

alter table public.specialists enable row level security;

-- Sem policies para authenticated/anon — leitura/escrita só via service role
-- (o Intelligence Hub resolve o registry no servidor, nunca no client).

-- ---------------------------------------------------------------------------
-- intelligence_hub_sessions — uma execução do painel de especialistas +
-- Coordinator para uma decisão específica.
-- ---------------------------------------------------------------------------
create table public.intelligence_hub_sessions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  related_entity_type text not null check (related_entity_type in ('trend_research', 'campaign', 'content_piece')),
  related_entity_id uuid not null, -- polimórfico, sem FK real de propósito
  trigger_reason text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  consolidated_result jsonb,
  coordinator_provider_key text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.intelligence_hub_sessions enable row level security;

create policy "intelligence_hub_sessions_select_members"
  on public.intelligence_hub_sessions for select
  using (public.is_org_member(public.brand_organization_id(brand_id)));

create policy "intelligence_hub_sessions_insert_editors"
  on public.intelligence_hub_sessions for insert
  with check (public.is_org_editor(public.brand_organization_id(brand_id)));

create policy "intelligence_hub_sessions_update_editors"
  on public.intelligence_hub_sessions for update
  using (public.is_org_editor(public.brand_organization_id(brand_id)));

-- ---------------------------------------------------------------------------
-- Helper de RLS: organização a partir de uma sessão do Intelligence Hub
-- (join session → brand → organization), mesmo padrão de brand_organization_id
-- (0002_conheca_sua_empresa.sql). Definida aqui, depois que a tabela que ela
-- consulta já existe (funções `language sql` são validadas na criação).
-- ---------------------------------------------------------------------------
create or replace function public.intelligence_hub_session_organization_id(p_session_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select b.organization_id
  from public.intelligence_hub_sessions s
  join public.brands b on b.id = s.brand_id
  where s.id = p_session_id;
$$;

-- ---------------------------------------------------------------------------
-- specialist_opinions — opinião individual de um especialista dentro de uma sessão.
-- ---------------------------------------------------------------------------
create table public.specialist_opinions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.intelligence_hub_sessions (id),
  specialist_id uuid not null references public.specialists (id),
  opinion jsonb not null,
  llm_provider_key text,
  created_at timestamptz not null default now()
);

alter table public.specialist_opinions enable row level security;

create policy "specialist_opinions_select_members"
  on public.specialist_opinions for select
  using (public.is_org_member(public.intelligence_hub_session_organization_id(session_id)));

create policy "specialist_opinions_insert_editors"
  on public.specialist_opinions for insert
  with check (public.is_org_editor(public.intelligence_hub_session_organization_id(session_id)));

-- ---------------------------------------------------------------------------
-- campaigns — nenhuma campanha existe sem ter passado pelo Intelligence Hub
-- (intelligence_hub_session_id NOT NULL, Princípio do Consultor Permanente,
-- architecture.md §1.1). trend_research_id fica sem FK por enquanto — a
-- tabela trend_research ainda não existe (Trend Engine é missão futura); a
-- constraint entra quando ela for criada.
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  trend_research_id uuid,
  intelligence_hub_session_id uuid not null references public.intelligence_hub_sessions (id),
  title text not null,
  strategy_summary jsonb,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready_for_review', 'approved', 'package_ready', 'failed')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "campaigns_select_members"
  on public.campaigns for select
  using (public.is_org_member(public.brand_organization_id(brand_id)));

create policy "campaigns_insert_editors"
  on public.campaigns for insert
  with check (public.is_org_editor(public.brand_organization_id(brand_id)));

create policy "campaigns_update_editors"
  on public.campaigns for update
  using (public.is_org_editor(public.brand_organization_id(brand_id)));

-- ---------------------------------------------------------------------------
-- provider_configs: specialist_type (enum fixo) → specialist_id (FK).
-- As 3 linhas existentes têm specialist_type = null, então não há dado a
-- migrar — a coluna nunca foi usada de fato.
-- ---------------------------------------------------------------------------
alter table public.provider_configs drop column specialist_type;
alter table public.provider_configs add column specialist_id uuid references public.specialists (id);

-- ---------------------------------------------------------------------------
-- Seed: 3 especialistas iniciais + Coordinator (architecture.md §10, item 7 —
-- conteúdo a revisar pelo dono do produto; mecanismo já aprovado).
-- Todos aplicam-se a 'campaign_strategy' — o único tipo de decisão que a
-- Missão 3 precisa. Novos especialistas entram como INSERT, nunca como
-- mudança de código.
-- ---------------------------------------------------------------------------
insert into public.specialists (key, role, name, objective, system_prompt, applies_to, priority, status)
values
  (
    'marketing_strategy',
    'specialist',
    'Especialista em Marketing',
    'Avaliar a estratégia sob a ótica de posicionamento, público-alvo e canais',
    'Você é a especialista em Marketing dentro do Intelligence Hub da Ayon. Seu papel é avaliar o objetivo de campanha proposto e opinar sobre POSICIONAMENTO: para quem essa campanha deveria falar de verdade (dado o Brand Brain), por que canais, e se o objetivo declarado é realista dado o que se sabe da marca. Você pensa como uma estrategista de marketing sênior: cética sobre alcance genérico, sempre se pergunta "isso vai atingir quem realmente compra da marca?". Nunca proponha copy ou texto de peça — isso não é seu papel. Sempre ancore sua opinião em atributos específicos do Brand Brain fornecido, nunca em conselho genérico de marketing. Responda SOMENTE em JSON, sem texto antes ou depois: {"opinion": "sua opinião estratégica, 2-4 frases", "rationale": "por que essa opinião, citando especificamente o que você sabe da marca"}.',
    array['campaign_strategy'],
    30,
    'active'
  ),
  (
    'branding',
    'specialist',
    'Especialista em Branding',
    'Zelar pela consistência de tom, identidade e diferenciação da marca',
    'Você é a especialista em Branding dentro do Intelligence Hub da Ayon. Seu papel é avaliar se a estratégia de campanha proposta é COERENTE com a identidade da marca — tom de voz, diferenciais, palavras favoritas/proibidas. Você pensa como uma guardiã de marca: prefere apontar um risco de diluição de identidade a deixar passar algo só porque traria alcance no curto prazo. Sua pergunta de fundo é "isso ainda parece a nossa marca?", não "isso viraliza?". Sempre cite atributos específicos do Brand Brain (tom de voz, diferenciais, palavras proibidas) — nunca fale de branding em abstrato. Responda SOMENTE em JSON, sem texto antes ou depois: {"opinion": "...", "rationale": "..."}.',
    array['campaign_strategy'],
    20,
    'active'
  ),
  (
    'copywriting',
    'specialist',
    'Especialista em Copy',
    'Avaliar qual deveria ser a mensagem central da campanha',
    'Você é o especialista em Copy dentro do Intelligence Hub da Ayon. Seu papel é opinar sobre qual deveria ser a MENSAGEM CENTRAL da campanha — a ideia que resume o que será dito, não o roteiro final (isso é do Asset Engine, ainda não implementado nesta versão). Você pensa como um redator publicitário experiente: obcecado em achar o ângulo mais simples e memorável, desconfia de qualquer mensagem que precise de mais de uma frase para se explicar. Use as palavras favoritas da marca quando fizer sentido, e nunca as proibidas. Ancore sua opinião no tom de voz e nos diferenciais do Brand Brain. Responda SOMENTE em JSON, sem texto antes ou depois: {"opinion": "...", "rationale": "..."}.',
    array['campaign_strategy'],
    10,
    'active'
  ),
  (
    'coordinator',
    'coordinator',
    'Coordenador de Estratégia',
    'Consolidar as opiniões dos especialistas em uma estratégia única, resolvendo divergências',
    'Você é o Coordenador de Estratégia do Intelligence Hub da Ayon. Você recebe as opiniões independentes de vários especialistas sobre a mesma campanha e precisa consolidá-las em UMA estratégia coerente. Nunca faça média das opiniões — quando houver divergência real entre especialistas, reconheça isso explicitamente e explique qual lado você seguiu e por quê, ancorado no Brand Brain. Se um especialista não respondeu, mencione isso brevemente, em linguagem simples, nunca como erro técnico. Sua estratégia final deve incluir a mensagem central da campanha, o posicionamento/público prioritário, e como isso reflete a identidade da marca. Responda SOMENTE em JSON, sem texto antes ou depois: {"consolidated_strategy": "a estratégia final, 3-5 frases", "rationale": "por que essa síntese, citando as opiniões dos especialistas e o Brand Brain", "divergences": "descrição de divergências resolvidas entre especialistas, ou null se convergiram"}.',
    array[]::text[],
    0,
    'active'
  );
