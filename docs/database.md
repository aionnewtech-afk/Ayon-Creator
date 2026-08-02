# Banco de Dados — Ayon Creator

> **Status:** Rascunho v1.0 (revisão 5 — fundação técnica da Sprint 1) — aguardando aprovação
> **Última atualização:** 2026-08-01
> Banco: Supabase (Postgres). Este documento descreve o modelo de dados correspondente ao escopo do [PRD.md](../PRD.md) e da [architecture.md](architecture.md). Tipos de coluna são indicativos (refinar em fase de implementação aprovada).
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
organizations 1───N provider_configs (por capability + tier)
brands        1───1 brand_brain_profiles
brands        1───N brand_onboarding_answers
brands        1───N knowledge_base_items
brands        1───N brand_media_assets
brands        1───N campaigns
brands        1───N learning_signals ──N learning_insights
brands        1───N intelligence_hub_sessions ──N specialist_opinions
campaigns     1───N content_pieces
campaigns     1───1 content_packages (quando concluída)
content_pieces 1───N content_versions
content_pieces 1───N pipeline_runs
organizations 1───1 subscriptions
organizations 1───N credit_ledger
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

> **Criação automática (revisão 5):** no cadastro (`Fluxo 1`, passo 1), uma brand padrão é criada junto com a organização — `name` = nome da organização, `niche` nulo (preenchido depois pela entrevista "Conheça sua empresa", fora de escopo da Sprint 1 de implementação). Isso garante que toda organização já tem um `brand_id` válido antes do onboarding conversacional existir.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations | |
| name | text | |
| niche | text (nullable) | usado pelo Trend Engine e pelo Especialista de Nicho; nulo até a entrevista de onboarding |
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

Registro histórico das respostas dadas na entrevista "Conheça sua empresa" — fonte de verdade do que foi perguntado/respondido.

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
| company_history | text | da entrevista de onboarding |
| products_summary | text | idem |
| target_audience | text | "clientes", da entrevista |
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
| updated_at | timestamptz | |

### 4.2 `knowledge_base_items`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| source_type | enum(`document`,`past_content`,`faq`,`performance_note`,`manual_note`,`onboarding_interview`) | |
| title | text | |
| content_text | text | |
| storage_path | text (nullable) | |
| embedding | vector (nullable) | depende da decisão sobre `pgvector` (architecture.md §10.3) |
| tags | text[] | |
| created_at | timestamptz | |

### 4.3 `trend_research`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| provider_key | text | qual Trend Source Provider gerou este resultado |
| summary | jsonb | tendências identificadas (ranqueamento final vem do Intelligence Hub) |
| intelligence_hub_session_id | uuid FK → intelligence_hub_sessions (nullable) | sessão que produziu o ranqueamento estratégico |
| status | enum(`pending`,`completed`,`failed`) | |
| created_at | timestamptz | |

### 4.4 `intelligence_hub_sessions` / `specialist_opinions`

**`intelligence_hub_sessions`** — uma execução do painel de especialistas + Coordinator para uma decisão específica.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| related_entity_type | enum(`trend_research`,`campaign`,`content_piece`) | |
| related_entity_id | uuid | polimórfico |
| trigger_reason | text | ex: "estratégia de campanha", "roteiro da peça principal" |
| status | enum(`running`,`completed`,`failed`) | |
| consolidated_result | jsonb | saída final do Coordinator AI |
| coordinator_provider_key | text | qual `provider_key` de LLM Provider atuou como Coordinator nesta sessão |
| created_at | timestamptz | |
| completed_at | timestamptz (nullable) | |

**`specialist_opinions`** — opinião individual de cada especialista dentro de uma sessão.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → intelligence_hub_sessions | |
| specialist_type | enum(`marketing`,`copywriting`,`branding`,`niche`,`seo`,`social_media`,`data`) | |
| opinion | jsonb | opinião estruturada do especialista |
| llm_provider_key | text | `provider_key` usado para gerar esta opinião |
| created_at | timestamptz | |

### 4.5 `campaigns`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| trend_research_id | uuid FK → trend_research (nullable) | |
| intelligence_hub_session_id | uuid FK → intelligence_hub_sessions | sessão que gerou a estratégia desta campanha |
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
| specialist_type | enum(`marketing`,`copywriting`,`branding`,`niche`,`seo`,`social_media`,`data`,`coordinator`) (nullable) | usado só quando `capability = llm` e a resolução precisa variar por papel dentro do Intelligence Hub (tier Premium — arquitetura §10.5) |
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

## 7. Billing

### 7.1 `subscriptions`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations (unique) | |
| plan | enum(`starter`,`pro`,`business`) | |
| status | enum(`active`,`past_due`,`canceled`) | |
| current_period_start | timestamptz | |
| current_period_end | timestamptz | |
| billing_provider_ref | text | |

### 7.2 `credit_ledger`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations | |
| type | enum(`grant_plan`,`purchase`,`consumption`,`adjustment`) | |
| amount | integer | |
| related_content_piece_id | uuid FK → content_pieces (nullable) | |
| description | text | |
| created_at | timestamptz | |

### 7.3 `credit_pricing` (a desenhar em detalhe — ver decisões em aberto)

Conversão de custo em créditos por `capability` + `tier` (não por fornecedor, já que o fornecedor é escondido do cliente).

## 8. Multi-tenancy e RLS

- Toda tabela com `organization_id` (direto ou via `brand_id`) restringe leitura/escrita a usuários membros da organização e, quando aplicável, membros da marca.
- `provider_configs.credentials_ref` e `publishing_channels.credentials_ref` **nunca** são lidos por RLS de usuário final — só via service role usada pelo Provider Gateway/backend/n8n.
- `provider_configs` inteira (não só credenciais) é acessível apenas por papel administrativo interno — nenhum usuário de organização/marca tem select nela, mesmo sem credenciais, pois o mapeamento tier→fornecedor não deve vazar.
- `brand_brain_profiles`, `brand_onboarding_answers`, `knowledge_base_items`, `intelligence_hub_sessions`, `specialist_opinions` seguem isolamento por `brand_id`.
- `user_profiles`: select/update restritos ao próprio `user_id` (`auth.uid() = user_id`).
- `audit_logs`: select restrito a `admin`/`owner` da `organization_id`; insert só via service role (Repository, nunca client).
- `feature_flags`: select liberado a qualquer usuário autenticado (tabela global, sem dado sensível); insert/update/delete só via service role.

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

1. `credit_pricing`: desenhar tabela de conversão custo→crédito por `capability` + `tier`, alinhada à decisão de produto PRD §13.2/§8.1.
2. Estrutura exata de `visual_guidelines`, `specialist_opinions.opinion`, `intelligence_hub_sessions.consolidated_result` e `learning_insights.summary` (jsonb) — fixar após prototipagem dos prompts de cada Core Engine.
3. Confirmar uso de `pgvector` para `knowledge_base_items.embedding`.
4. `provider_configs.specialist_type`: confirmar se, no MVP, todo tier usa o mesmo modelo para todos os especialistas (campo fica nulo/irrelevante) ou se o tier Premium já precisa de granularidade por especialista desde o início.
5. Se `content_packages` deve versionar (permitir gerar o pacote mais de uma vez após reaprovações) ou é sempre 1:1 com a campanha.
6. `feature_flags`: manter global por enquanto, ou já modelar override por organização (`organization_feature_overrides`) desde a Sprint 1? Adiado até haver um caso de uso real.
