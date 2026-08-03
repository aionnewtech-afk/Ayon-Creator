# Banco de Dados — Ayon Creator

> **Status:** v1.0 (revisão 16 — preparação doc-first da Missão 6, Billing) — **aguardando confirmação final do dono do produto antes do código**
> **Última atualização:** 2026-08-03
> **Mudança desta revisão (16 — preparação Missão 6, Billing):** §7 (Billing) finalizada — `subscriptions`/`credit_ledger` com colunas ajustadas (`related_intelligence_hub_session_id` no lugar de `related_content_piece_id`, que não existe; `external_payment_id` único para idempotência de webhook); `credit_pricing` com chave `trigger_reason` + `tier` e seed concreto; nova tabela `credit_packages` (catálogo de créditos avulsos). §8 ganha notas de RLS para as 4 tabelas de billing. §10, item 1, resolvido.
> **Mudança desta revisão (15 — Missão 5 implementada):** `trend_research` (§4.3) criada por `0006_trend_engine.sql` — schema idêntico ao já especificado desde a revisão 2, sem mudança de colunas; `provider_key`/`summary` documentados como nullable (preenchidos só na conclusão). `campaigns.trend_research_id` ganha FK real. Novo capability `trend_source` em `provider_configs`. `specialists.applies_to` de `marketing_strategy`/`branding` amplia para incluir `trend_ranking` (migration `0006`); `system_prompt` do Coordinator generalizado para ser independente de tipo de decisão (migration `0007_coordinator_decision_agnostic.sql` — achado durante a implementação, ver [docs/changelog.md](changelog.md)).
> **Mudança desta revisão (14 — Missão 4 implementada):** `knowledge_base_items` validada em produção com upload real de PDF/DOCX/TXT e nota manual — nenhuma migration nova foi necessária, confirmando a previsão da revisão 13. `content_text`/`storage_path`/`tags` todos populados corretamente pelos três tipos de arquivo testados.
> **Mudança desta revisão (13 — preparação da Missão 4):** nota de `knowledge_base_items.embedding` (§4.2) atualizada — recomendação é adiar `pgvector`, MVP da Knowledge Base usa retrieval por recência + tags. Nenhuma mudança de schema necessária para a Missão 4: a tabela já existe desde a Missão 2.
> **Mudança desta revisão (11 — Missão 3 implementada):** migration `0004_intelligence_hub.sql` aplicada em produção — `specialists`, `intelligence_hub_sessions`, `specialist_opinions` e `campaigns` (§4.4/§4.5) existem de fato; `provider_configs.specialist_type` (enum) foi removida e substituída por `provider_configs.specialist_id` (FK → `specialists`, nullable). `campaigns.trend_research_id` existe como `uuid` **sem FK real** — `trend_research` ainda não tem migration própria, então a referência é só de convenção até essa tabela ser criada. Seed inicial do registry: 3 especialistas (`marketing_strategy`, `branding`, `copywriting`, todos com `applies_to = ['campaign_strategy']`) + 1 `coordinator`.
> **Mudança desta revisão (10 — infraestrutura de especialistas plugáveis, Missão 3 redefinida):** nova tabela `specialists` (§4.4) — especialistas do Intelligence Hub (e o Coordinator) deixam de ser um enum fixo e passam a ser dados. `provider_configs.specialist_type` (enum) é substituído por `provider_configs.specialist_id` (FK → `specialists`); `specialist_opinions.specialist_type` (enum) idem. Ver [architecture.md §4.1](architecture.md#41-specialist-registry-especialistas-plugáveis-★-novo-revisão-10).
> Banco: Supabase (Postgres). Este documento descreve o modelo de dados correspondente ao escopo do [PRD.md](../PRD.md) e da [architecture.md](architecture.md). Tipos de coluna são indicativos (refinar em fase de implementação aprovada).
> **Mudança desta revisão (7 — Princípio do Consultor Permanente):** nova coluna `content_pieces.brand_rationale`; `specialist_opinions.opinion` e `intelligence_hub_sessions.consolidated_result` passam a exigir uma chave `rationale` (ver [architecture.md §1.1](architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7)); enum `knowledge_base_items.source_type` renomeia `onboarding_interview` → `onboarding_conversation`.
> **Mudança desta revisão (8 — consolidação final antes da Missão 2):** nenhuma tabela/coluna nova além das já existentes — apenas notas explícitas em §4.4/§4.5 esclarecendo que o contexto de entrada do Intelligence Hub inclui histórico de `campaigns`/`learning_insights` (memória de longo prazo) e que `brand_rationale`/`rationale` são a base de dados do bloco "Por que fiz assim?" (ver [architecture.md §1.1](architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7)).
> **Mudança da revisão 3:** `brand_brain_profiles` ganha campos da entrevista de onboarding; nova tabela `brand_onboarding_answers`; novas tabelas `intelligence_hub_sessions`/`specialist_opinions`; `provider_configs` ganha `tier` e passa a ser resolvida por (capability, tier) em vez de escolha direta do cliente; `content_pieces.format` expandido para os formatos do pacote de conteúdo; nova tabela `content_packages`; `publishing_channels`/`publications` marcadas como fora do MVP.
> **Mudança desta revisão (5 — fundação técnica, sem mudança de escopo de produto):** `organizations` ganha `slug`; `brands` passa a ter uma linha padrão criada automaticamente no cadastro (ver [flows.md — Fluxo 1](flows.md#fluxo-1--conheça-sua-empresa-onboarding-conversacional)); novas tabelas de plataforma `user_profiles`, `audit_logs`, `feature_flags`; convenção de colunas de auditoria (`created_by`, `updated_at`, `deleted_at` — ver [CONVENTIONS.md](../CONVENTIONS.md)) aplicada a `organizations`, `organization_members`, `brands`, `user_profiles`, `feature_flags` desde já — demais tabelas adotam a convenção quando forem implementadas.

---

## 1. Diagrama de Entidades (visão lógica)

```
organizations 1───N brands (1 brand padrão criada automaticamente no cadastro)
organizations 1───N organization_members ───N users (auth.users)
auth.users    1───1 user_profiles
organizations 1───N audit_logs
(global)      feature_flags (sem FK — configuração global, não multi-tenant)
organizations 1───N provider_configs (por capability + tier [+ specialist_id])
(global)      specialists (Specialist Registry — sem organization_id, administração interna)
brands        1───1 brand_brain_profiles
brands        1───N brand_onboarding_answers
brands        1───N knowledge_base_items
brands        1───N brand_media_assets
brands        1───N campaigns
brands        1───N learning_signals ──N learning_insights
brands        1───N intelligence_hub_sessions ──N specialist_opinions ──1 specialists
campaigns     1───N content_pieces
campaigns     1───1 content_packages (quando concluída)
content_pieces 1───N content_versions
content_pieces 1───N pipeline_runs
organizations 1───1 subscriptions
organizations 1───N credit_ledger ──1 intelligence_hub_sessions (consumption, nullable)
(global)      credit_pricing (por trigger_reason + tier — sem organization_id)
(global)      credit_packages (catálogo de pacotes avulsos — sem organization_id)
brands        1───N publishing_channels (fora do MVP)
content_pieces N───N publishing_channels via publications (fora do MVP)
```

## 2. Núcleo (organizações, marcas, acesso)

### 2.1 `organizations`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | |
| slug | text (unique) | gerado do `name` no cadastro; usado para URLs/contexto futuro |
| plan | enum(`starter`,`pro`,`business`) | |
| provider_tier | enum(`economico`,`balanceado`,`premium`) | tier padrão da organização — único controle de fornecedor exposto ao cliente |
| created_by | uuid FK → auth.users (nullable) | usuário que criou a organização (cadastro) |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | soft delete — ver [CONVENTIONS.md](../CONVENTIONS.md) |

### 2.2 `organization_members`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations | |
| user_id | uuid FK → auth.users | |
| role | enum(`owner`,`admin`,`editor`,`viewer`) | |
| created_by | uuid FK → auth.users (nullable) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | soft delete |

### 2.3 `brands`

> **Criação automática (revisão 5):** no cadastro (`Fluxo 1`, passo 1), uma brand padrão é criada junto com a organização — `name` = nome da organização, `niche` nulo (preenchido depois, na conversa "Conheça sua empresa", fora de escopo da Sprint 1 de implementação). Isso garante que toda organização já tem um `brand_id` válido antes do onboarding conversacional existir.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations | |
| name | text | |
| niche | text (nullable) | usado pelo Trend Engine e pelo Especialista de Nicho; nulo até a conversa de onboarding |
| provider_tier | enum(`economico`,`balanceado`,`premium`) (nullable) | override do tier da organização para esta marca (plano Business) |
| status | enum(`active`,`archived`) | |
| created_by | uuid FK → auth.users (nullable) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | soft delete |

### 2.4 `brand_members` (plano Business, multi-marca)

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| user_id | uuid FK → auth.users | |
| role | enum(`admin`,`editor`,`viewer`) | |

### 2.5 `user_profiles` ★ novo (revisão 5)

Perfil de aplicação por usuário, separado de `auth.users` (gerida pelo Supabase Auth) — evita acoplar dados de produto ao schema interno de autenticação.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users (unique) | |
| full_name | text (nullable) | |
| avatar_url | text (nullable) | |
| locale | text | default `pt-BR` |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | soft delete |

## 3. Onboarding Conversacional

### 3.1 `brand_onboarding_answers`

Registro histórico do que foi dito na conversa "Conheça sua empresa" — fonte de verdade do que foi tratado/respondido.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| question_key | enum(`company_history`,`products`,`customers`,`tone_of_voice`,`competitors`,`objectives`,`differentiators`,`forbidden_words`,`favorite_words`) | |
| answer_text | text | resposta literal do cliente |
| created_at | timestamptz | |

> Ao ser respondida, cada pergunta atualiza também o campo correspondente em `brand_brain_profiles` (visão sintetizada/atual) e gera um item em `knowledge_base_items` com a transcrição bruta (contexto adicional para retrieval).

## 4. Core Engines — Armazenamento

### 4.1 `brand_brain_profiles`

Estado atual do Brand Brain de cada marca — identidade + preferências aprendidas.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands (unique) | |
| company_history | text | da conversa de onboarding |
| products_summary | text | idem |
| target_audience | text | "clientes", da conversa de onboarding |
| tone_of_voice | text | idem |
| competitors | text[] | idem |
| objectives | text | idem |
| differentiators | text | idem |
| forbidden_words | text[] | idem |
| favorite_words | text[] | idem |
| visual_guidelines | jsonb | cores, fontes, referências |
| default_avatar_ref | text | referência lógica ao avatar padrão (resolvida via Provider Layer) |
| default_voice_ref | text | referência lógica à voz padrão (idem) |
| learned_preferences | jsonb | ajustes aceitos via "O que funcionou" (Learning Engine) |
| last_learning_update_at | timestamptz (nullable) | |
| onboarding_completed_at | timestamptz (nullable) | necessidade descoberta na implementação da Missão 2: marca quando os 5 temas da conversa foram cobertos e a síntese (ONB-3) está pronta para revisão |
| onboarding_confirmed_at | timestamptz (nullable) | marca quando o usuário confirma a síntese ("Isso mesmo, pode seguir") — distingue "conversa concluída" de "conversa confirmada" para fins de retomada/roteamento |
| onboarding_synthesis | jsonb (nullable) | síntese computada (sem chamada de IA extra) a partir dos campos de `brand_brain_profiles` + citações de `brand_onboarding_answers`, usada para renderizar ONB-3 |
| created_by | uuid FK → auth.users (nullable) | ausente até a implementação da Missão 2 (revisão 9); sem `deleted_at` de propósito — o perfil vive/morre com o `brand` |
| created_at | timestamptz | idem |
| updated_at | timestamptz | |

### 4.2 `knowledge_base_items`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| source_type | enum(`document`,`past_content`,`faq`,`performance_note`,`manual_note`,`onboarding_conversation`) | |
| title | text | |
| content_text | text | |
| storage_path | text (nullable) | |
| embedding | vector (nullable) | **ainda não criada** — recomendação da revisão 13 é adiar (architecture.md §10, item 3): MVP da Missão 4 usa retrieval por recência + `tags`/`source_type`, sem embeddings; coluna reservada para quando essa decisão for confirmada, sem migration destrutiva |
| tags | text[] | |
| created_by | uuid FK → auth.users (nullable) | |
| created_at | timestamptz | |
| updated_at | timestamptz | ausente até a Missão 2 (revisão 9) — necessário porque KB-3 permite editar tags/remover item |
| deleted_at | timestamptz (nullable) | soft delete — KB-3 "remover item" |

### 4.3 `trend_research`

Implementada e validada na Missão 5 (migration `0006_trend_engine.sql`) — schema idêntico ao já especificado desde a revisão 2, sem mudança.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| provider_key | text (nullable) | qual Trend Source Provider gerou este resultado — nullable porque só é preenchido quando a busca termina (mesmo padrão de `intelligence_hub_sessions.coordinator_provider_key`); linha nasce em `pending` sem esse valor |
| summary | jsonb (nullable) | `{"rankings": [{"title", "summary", "rationale", "source_url"}], "overall_rationale"}` — ranqueamento final consolidado pelo Intelligence Hub, nunca os candidatos brutos do Trend Source Provider |
| intelligence_hub_session_id | uuid FK → intelligence_hub_sessions (nullable) | sessão que produziu o ranqueamento estratégico |
| status | enum(`pending`,`completed`,`failed`) | |
| created_by | uuid FK → auth.users (nullable) | |
| created_at | timestamptz | |

`campaigns.trend_research_id` ganhou FK real para esta tabela na mesma migration (antes era `uuid` sem constraint, já que `trend_research` não existia — ver revisão 11).

### 4.4 `intelligence_hub_sessions` / `specialist_opinions` / `specialists`

**`intelligence_hub_sessions`** — uma execução do painel de especialistas + Coordinator para uma decisão específica.

> **Memória de longo prazo (Princípio do Consultor Permanente, [architecture.md §1.1](architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7)):** ao montar o contexto de entrada para especialistas e Coordinator, o Intelligence Hub consulta também `campaigns` (histórico recente da marca) e `learning_insights` já `applied` — não apenas o snapshot atual de `brand_brain_profiles`. Nenhuma sessão decide como se fosse a primeira campanha da marca.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| related_entity_type | enum(`trend_research`,`campaign`,`content_piece`) | |
| related_entity_id | uuid | polimórfico |
| trigger_reason | text | ex: "estratégia de campanha", "roteiro da peça principal" |
| status | enum(`running`,`completed`,`failed`) | |
| consolidated_result | jsonb | saída final do Coordinator AI — **deve incluir a chave `rationale`** (texto em linguagem de negócio, ancorado no Brand Brain, explicando o porquê da estratégia — Princípio do Consultor Permanente, [architecture.md §1.1](architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7)) além do conteúdo estruturado da estratégia |
| coordinator_provider_key | text | qual `provider_key` de LLM Provider atuou como Coordinator nesta sessão |
| created_at | timestamptz | |
| completed_at | timestamptz (nullable) | |

**`specialist_opinions`** — opinião individual de cada especialista dentro de uma sessão.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → intelligence_hub_sessions | |
| specialist_id | uuid FK → specialists | **substitui o antigo enum fixo** `specialist_type` (revisão 10) — qual especialista do registry gerou esta opinião |
| opinion | jsonb | opinião estruturada do especialista — **deve incluir a chave `rationale`** (justificativa em linguagem de negócio, ancorada no Brand Brain — Princípio do Consultor Permanente, architecture.md §1.1) além da recomendação |
| llm_provider_key | text | `provider_key` usado para gerar esta opinião |
| created_at | timestamptz | |

**`specialists`** ★ novo (revisão 10) — o **Specialist Registry** (architecture.md §4.1): cada especialista do Intelligence Hub, incluindo o Coordinator, é uma linha aqui — nunca um papel hardcoded no código. Sem policy de RLS para usuário final (mesmo padrão de `provider_configs` — administração interna da Ayon, service role).

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| key | text (unique) | slug estável usado internamente (ex.: `marketing`, `copywriting`, `coordinator`) — nunca exposto ao cliente |
| role | enum(`specialist`,`coordinator`) | um único registro com `role = coordinator` por painel; os demais são `specialist` |
| name | text | identidade de negócio (ex.: "Especialista em Marketing") |
| objective | text | o que este especialista avalia/produz |
| system_prompt | text | prompt que conduz a chamada ao LLM Provider para este especialista — ver [docs/engine-behavior.md](engine-behavior.md) |
| provider_capability | text | capacidade do Provider Layer consumida — hoje sempre `llm` (ver architecture.md §4.1); **nunca** um fornecedor específico |
| applies_to | text[] | tipos de decisão em que este especialista participa (ex.: `campaign_strategy`, `trend_ranking`, `content_piece_review`) — resolve PRD §13.1 |
| priority | int | peso/ordem na consolidação do Coordinator e na exibição do Painel de Especialistas |
| parameters | jsonb | ajustes finos por especialista (ex.: `temperature`, `max_tokens`) — default `{}` |
| status | enum(`active`,`inactive`) | especialista desativado não é convocado, mas seu histórico em `specialist_opinions` permanece |
| created_by | uuid FK → auth.users (nullable) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

> **Implementado (revisão 11):** migration `0004_intelligence_hub.sql` — tabela criada, sem policy de RLS (service role only), seed inicial com 3 especialistas + 1 coordinator (ver nota de revisão 11 no topo do documento).

### 4.5 `campaigns`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| trend_research_id | uuid (nullable, **sem FK real**) | referência de convenção a `trend_research`, que ainda não existe como migration — vira FK de verdade quando essa tabela for criada |
| intelligence_hub_session_id | uuid FK → intelligence_hub_sessions | sessão que gerou a estratégia desta campanha — **NOT NULL de propósito**: nenhuma campanha existe sem ter passado pelo Brand Brain via Intelligence Hub (regra inegociável, Princípio do Consultor Permanente, [architecture.md §1.1](architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7)) |
| title | text | |
| strategy_summary | jsonb | = `intelligence_hub_sessions.consolidated_result` desta sessão, desnormalizado para leitura rápida |
| status | enum(`draft`,`generating`,`ready_for_review`,`approved`,`package_ready`,`failed`) | substituído `published` por `package_ready` — MVP não publica |
| created_by | uuid FK → auth.users | |
| created_at | timestamptz | |

### 4.6 `content_pieces` / `content_versions` / `content_packages`

**`content_pieces`**

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK → campaigns | |
| format | enum(`video`,`caption`,`stories`,`carousel`,`thumbnail`,`blog_post`,`email`,`script`,`teleprompter`) | formatos do pacote de conteúdo (PRD §4.3) |
| production_mode | enum(`ai_avatar`,`licensed_stock_video`,`own_media`,`hybrid`,`text_only`) (nullable) | aplica-se principalmente a `video`/`stories`/`carousel`/`thumbnail`; formatos puramente textuais (`caption`,`blog_post`,`email`,`script`,`teleprompter`) usam `text_only` ou deixam nulo |
| is_primary | boolean | `true` para a peça "principal" da campanha (passa pelo Intelligence Hub completo — architecture.md §3.4) |
| intelligence_hub_session_id | uuid FK → intelligence_hub_sessions (nullable) | preenchido quando a peça é principal |
| script | text | |
| brand_rationale | text | justificativa curta em linguagem de negócio de por que esta peça reflete a marca (Princípio do Consultor Permanente, [architecture.md §1.1](architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7)); dado-fonte do bloco **"Por que fiz assim?"** no Cartão de Revisão de Peça ([ux-design.md §4.6](ux-design.md#46-cartão-de-revisão-de-peça)) |
| status | enum(`draft`,`generating`,`ready_for_review`,`approved`,`rejected`) | sem status `published` no MVP |
| approved_by | uuid FK → auth.users (nullable) | |
| approved_at | timestamptz (nullable) | |
| created_at | timestamptz | |

**`content_versions`**

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| content_piece_id | uuid FK → content_pieces | |
| version_number | int | |
| output_storage_path | text | |
| generation_metadata | jsonb | inclui `llm_provider_key`, `avatar_provider_key`, `voice_provider_key`, `media_provider_key` + tier ativo no momento da geração + custo em créditos |
| created_at | timestamptz | |

**`content_packages`** (novo — entrega final do MVP)

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK → campaigns (unique) | |
| storage_path | text | pacote compactado (zip) com todas as peças aprovadas |
| status | enum(`building`,`ready`,`failed`) | |
| generated_at | timestamptz (nullable) | |

### 4.7 `learning_signals` / `learning_insights`

**`learning_signals`**

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| content_piece_id | uuid FK → content_pieces (nullable) | |
| signal_type | enum(`approved`,`rejected`,`edited`,`engagement_metric`) | |
| payload | jsonb | |
| created_at | timestamptz | |

**`learning_insights`**

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| insight_type | text | |
| summary | jsonb | inclui o texto exibido ao usuário (ex: "Percebemos que vídeos de até 35 segundos performam melhor...") |
| applied_to | enum(`brand_brain`,`trend_engine`,`intelligence_hub`,`asset_engine`) | |
| status | enum(`pending_review`,`applied`,`dismissed`) | **nunca** pula `pending_review` — aplicação automática não existe em nenhum plano |
| reviewed_by | uuid FK → auth.users (nullable) | |
| created_at | timestamptz | |

### 4.8 `pipeline_runs`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| entity_type | enum(`trend_research`,`campaign`,`content_piece`,`intelligence_hub_session`) | |
| entity_id | uuid | polimórfico |
| engine | enum(`trend_engine`,`intelligence_hub`,`asset_engine`,`brand_brain`,`learning_engine`) | |
| n8n_execution_id | text | |
| status | enum(`queued`,`running`,`completed`,`failed`) | |
| error | text (nullable) | |
| started_at | timestamptz | |
| finished_at | timestamptz (nullable) | |

## 5. Provider Layer — Armazenamento

### 5.1 `provider_configs`

Mapeamento interno **(capability, tier) → fornecedor concreto**. Nunca exposto/editável pelo cliente final — apenas por um painel administrativo interno.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| capability | enum(`llm`,`avatar`,`voice`,`media`,`trend_source`) | |
| tier | enum(`economico`,`balanceado`,`premium`) | |
| specialist_id | uuid FK → specialists (nullable) | **substitui o antigo enum fixo** (revisão 10) — usado só quando `capability = llm` e a resolução precisa variar por especialista dentro do Intelligence Hub (tier Premium — architecture.md §10, item 5) |
| provider_key | text | ex: `openai-mini`, `openai-gpt5`, `claude-sonnet`, `claude-opus`, `heygen`, `elevenlabs` |
| credentials_ref | text | referência a segredo — nunca credencial em texto puro |
| priority | int | |
| fallback_provider_key | text (nullable) | |
| status | enum(`active`,`inactive`,`error`) | |
| updated_at | timestamptz | |

> Trocar de fornecedor dentro de um tier = nova linha + `status = active` na antiga → `inactive`. Redesenhar o que compõe cada tier = mudança de dados aqui, nunca de código.

### 5.2 `brand_media_assets`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| storage_path | text | |
| type | enum(`image`,`video`,`audio`) | |
| tags | text[] | |
| created_at | timestamptz | |

## 6. Publicação (fora do MVP)

Mantidas no modelo para evolução futura — **nenhum fluxo do MVP as utiliza** (ver [flows.md](flows.md) e architecture.md §7).

### 6.1 `publishing_channels`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| channel_type | enum(`instagram`,`tiktok`,`youtube`,`linkedin`,`blog`,`newsletter`) | |
| credentials_ref | text | |
| status | enum(`connected`,`disconnected`,`error`) | |

### 6.2 `publications`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| content_piece_id | uuid FK → content_pieces | |
| publishing_channel_id | uuid FK → publishing_channels | |
| published_at | timestamptz (nullable) | |
| status | enum(`scheduled`,`published`,`failed`) | |
| external_post_id | text (nullable) | |

## 7. Billing ★ implementada na Missão 6 (integração: Mercado Pago — [architecture.md §12](architecture.md#12-billing-módulo-dedicado-★-novo-missão-6))

### 7.1 `subscriptions`

Uma linha por organização — billing é sempre no nível da organização, nunca por marca (Fluxo 7, passo 3: marcas de uma mesma organização compartilham o billing).

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations (unique) | |
| plan | enum(`starter`,`pro`,`business`) | |
| status | enum(`active`,`past_due`,`canceled`) | sincronizado via webhook do Mercado Pago (Preapproval) |
| current_period_start | timestamptz | |
| current_period_end | timestamptz | |
| billing_provider_ref | text (nullable) | `preapproval_id` do Mercado Pago — nullable até a primeira assinatura ser criada |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 7.2 `credit_ledger`

Livro-razão append-only — saldo é sempre `SUM(amount)` por `organization_id`, nunca uma coluna de saldo cacheada (evita divergência entre saldo e histórico).

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations | |
| type | enum(`grant_plan`,`purchase`,`consumption`,`adjustment`) | |
| amount | integer | positivo em `grant_plan`/`purchase`, negativo em `consumption`; `adjustment` pode ser qualquer sinal |
| related_intelligence_hub_session_id | uuid FK → intelligence_hub_sessions (nullable) | substitui o antigo `related_content_piece_id` — `content_pieces` não existe ainda (Asset Engine não implementado); todo `consumption` até aqui vem de uma sessão do Intelligence Hub. Passa a incluir `content_pieces`/`content_versions` quando o Asset Engine for implementado (nova coluna nesse momento, não reaproveitar esta) |
| external_payment_id | text (nullable, **unique**) | id do pagamento do Mercado Pago em lançamentos `purchase` — garante idempotência de webhook (arch. §12.2): uma segunda entrega do mesmo evento falha por constraint em vez de duplicar crédito |
| description | text | |
| created_by | uuid FK → auth.users (nullable) | nulo em lançamentos automáticos (`grant_plan`, `consumption`, webhook de `purchase`); preenchido só em `adjustment` manual feito por um admin |
| created_at | timestamptz | |

### 7.3 `credit_pricing`

Preço em créditos por tipo de operação — chave é `trigger_reason` (mesmo valor usado em `intelligence_hub_sessions.trigger_reason`) + `tier`, não `capability` + `tier`: `campaign_strategy` e `trend_ranking` usam a mesma capability (`llm`) mas custam diferente, porque o custo real (nº de especialistas acionados, tamanho do contexto) é diferente. Sem policy de RLS para usuário final — mesmo padrão de `provider_configs`/`specialists`, lido só via service role pela checagem de crédito.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| trigger_reason | text | ex.: `campaign_strategy`, `trend_ranking` — novos tipos de operação (Asset Engine) entram como novas linhas, nunca mudança de código |
| tier | enum(`economico`,`balanceado`,`premium`) | |
| credits | integer | |
| status | enum(`active`,`inactive`) | |
| updated_at | timestamptz | |

**Seed inicial (Missão 6, decisão de produto — arch. §12.4):**

| trigger_reason | economico | balanceado | premium |
|---|---|---|---|
| `trend_ranking` | 1 | 2 | 4 |
| `campaign_strategy` | 5 | 10 | 20 |

### 7.4 `credit_packages` ★ novo (Missão 6)

Catálogo de pacotes de créditos avulsos disponíveis para compra via Checkout Pro — dado, não hardcoded no código, mesmo raciocínio de `provider_configs`/`specialists`: mudar o catálogo é uma mudança de linha, nunca de código. Sem `organization_id` (catálogo global, mesmo para todos os clientes). Sem policy de RLS para usuário final na escrita — leitura pública (`authenticated`) para popular CFG-4.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | ex.: "Pacote Pequeno" |
| credits | integer | |
| price_cents | integer | preço em centavos (BRL) |
| status | enum(`active`,`inactive`) | pacotes descontinuados ficam `inactive`, nunca são apagados (histórico de compras referenciando o pacote continua válido) |
| created_at | timestamptz | |

## 8. Multi-tenancy e RLS

- Toda tabela com `organization_id` (direto ou via `brand_id`) restringe leitura/escrita a usuários membros da organização e, quando aplicável, membros da marca.
- `provider_configs.credentials_ref` e `publishing_channels.credentials_ref` **nunca** são lidos por RLS de usuário final — só via service role usada pelo Provider Gateway/backend/n8n.
- `provider_configs` inteira (não só credenciais) é acessível apenas por papel administrativo interno — nenhum usuário de organização/marca tem select nela, mesmo sem credenciais, pois o mapeamento tier→fornecedor não deve vazar.
- `specialists` (Specialist Registry, revisão 10) segue o mesmo padrão de `provider_configs`: sem policy para `authenticated`/`anon`, leitura e escrita só via service role — nenhuma organização/marca administra ou vê o registry diretamente.
- `brand_brain_profiles`, `brand_onboarding_answers`, `knowledge_base_items`, `intelligence_hub_sessions`, `specialist_opinions` seguem isolamento por `brand_id`.
- `user_profiles`: select/update restritos ao próprio `user_id` (`auth.uid() = user_id`).
- `audit_logs`: select restrito a `admin`/`owner` da `organization_id`; insert só via service role (Repository, nunca client).
- `feature_flags`: select liberado a qualquer usuário autenticado (tabela global, sem dado sensível); insert/update/delete só via service role.
- `subscriptions`/`credit_ledger` (Missão 6): select restrito a membros da organização (CFG-2/CFG-4 precisam ler); insert/update **só via service role** — nunca o client grava diretamente (grants/consumo vêm do portão de crédito no Server Action, compras/mudanças de assinatura vêm de webhook do Mercado Pago, ambos rodando com service role). Nenhum usuário, nem admin, altera saldo diretamente pela aplicação.
- `credit_pricing`/`credit_packages` (Missão 6): mesmo padrão de `feature_flags` — select liberado a qualquer `authenticated` (preço deve ser visível, ex. CFG-4 mostrando quanto custa cada geração), insert/update/delete só via service role.

## 9. Plataforma — Auditoria e Feature Flags ★ novo (revisão 5)

### 9.1 `audit_logs`

Registro genérico de ações sensíveis (criação de organização/brand, mudanças de papel, decisões de billing futuras). Escrita feita pela camada de Repository/Server Action — nunca diretamente pelo client.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations | |
| actor_user_id | uuid FK → auth.users (nullable) | nulo para ações de sistema |
| action | text | ex.: `organization.created`, `brand.created` |
| entity_type | text | |
| entity_id | uuid (nullable) | |
| metadata | jsonb | default `{}` |
| created_at | timestamptz | |

### 9.2 `feature_flags`

Tabela global (não multi-tenant) de toggles de funcionalidade, administrada internamente. Não tem `organization_id` — override por organização é decisão em aberto (ver §10.6) e só será modelado se/quando houver caso de uso real.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| key | text (unique) | ex.: `intelligence_hub_enabled` |
| description | text | |
| enabled | boolean | default `false` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## 10. Decisões em Aberto (banco de dados)

1. ~~`credit_pricing`: desenhar tabela de conversão custo→crédito por `capability` + `tier`.~~ **Resolvido (Missão 6):** chave é `trigger_reason` + `tier` (não `capability` + `tier` — ver §7.3), com valores seedados (`trend_ranking` 1/2/4, `campaign_strategy` 5/10/20 por tier).
2. Estrutura exata de `visual_guidelines`, `specialist_opinions.opinion`, `intelligence_hub_sessions.consolidated_result` e `learning_insights.summary` (jsonb) — fixar após prototipagem dos prompts de cada Core Engine. **Já decidido (revisão 7):** `specialist_opinions.opinion` e `intelligence_hub_sessions.consolidated_result` incluem obrigatoriamente uma chave `rationale`; o restante da estrutura permanece em aberto.
3. Confirmar uso de `pgvector` para `knowledge_base_items.embedding`.
4. `provider_configs.specialist_id`: confirmar se, no MVP, todo tier usa o mesmo modelo para todos os especialistas (campo fica nulo/irrelevante) ou se o tier Premium já precisa de granularidade por especialista desde o início.
5. Se `content_packages` deve versionar (permitir gerar o pacote mais de uma vez após reaprovações) ou é sempre 1:1 com a campanha.
6. `feature_flags`: manter global por enquanto, ou já modelar override por organização (`organization_feature_overrides`) desde a Sprint 1? Adiado até haver um caso de uso real.
