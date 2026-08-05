# Banco de Dados — Ayon Creator

> **Status:** v1.0 (revisão 31 — Missão 12 aprovada, ajustes incorporados)
> **Última atualização:** 2026-08-05
> **Mudança desta revisão (31 — Missão 12 aprovada, ajustes incorporados):** `platform_admins` ganha `role` (`super_admin`/`support_admin`, §9.4); `admin_audit_logs` ganha `actor_role` (§9.5); `provider_call_logs` ganha `model`/`endpoint`/`tokens_input`/`tokens_output`/`request_id`, `ok` renomeado para `status` (§9.6); `user_feedback` ganha `internal_response`/`status` (CRM interno, §9.3); `provider_configs` ganha `credential_value` e `status` ganha o valor `maintenance` (§5.1); `plans` ganha um conjunto bem maior de colunas — `brands_included`→`max_brands`, `credits_per_month`→`monthly_credits` (renomeações), mais `max_users`/`max_campaigns`/`max_monthly_videos`/`max_monthly_images`/`storage_gb`/`priority_queue`/`allow_ai_video`/`allow_api`/`allow_brand_customization`/`allow_team`/`allow_white_label` (§7.5). Ver [architecture.md §15](architecture.md#15-super-admin--plataforma-administrativa-★-missão-12) e [docs/changelog.md](changelog.md).
> **Mudança desta revisão (30 — Missão 12 em preparação, Super Admin):** 3 tabelas novas — `platform_admins` (§9.4), `admin_audit_logs` (§9.5), `provider_call_logs` (§9.6). `organizations` ganha `is_platform_account` (§2.1). `plans` ganha 4 colunas de limite, só editáveis, sem bloqueio real ([architecture.md §15.10](architecture.md#1510-limites-de-plano--campos-sem-bloqueio-decisão-do-dono-do-produto)) — chave `business` mantida (decisão do dono do produto). `subscriptions.status` ganha o valor `trialing`; `subscriptions` ganha `trial_ends_at`. `user_feedback` ganha `archived_at` (§9.3). §8 (Multi-tenancy e RLS) ganha a extensão centralizada de `is_org_member`/`is_org_admin`/`is_org_editor` para `super_admin` ([architecture.md §15.2](architecture.md#152-rls--extensão-centralizada-não-checagem-espalhada)). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (29 — Missão 11 aprovada, ressalva de composição resolvida):** `campaigns` ganha `visual_brief` (jsonb, §4.5) — parâmetros de composição resolvidos 1x por campanha para consistência entre peças. `content_pieces` ganha `selected_version_id` (§4.6) — suporta múltiplas opções geradas por rodada, `null` preserva o comportamento atual (versão mais recente vence). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (28 — Missão 11 aprovada, escopo ajustado):** `brands` ganha mais 3 colunas de identidade visual — `secondary_color_hex`/`font_family`/`visual_style` (§2.3) — além das 2 já previstas; `pipeline_runs` ganha `progress_percent`/`estimated_remaining_seconds` além de `stage` (§4.8). Nenhuma mudança em `content_pieces`/`credit_pricing` além do já previsto na revisão anterior. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (27 — preparação Missão 11):** `brands` ganha `logo_storage_path`/`primary_color_hex` (§2.3, identidade visual — [architecture.md §14.1](architecture.md#141-identidade-visual-automática)), reaproveitando o bucket `brand-media` já existente; `content_pieces.production_mode` ganha o valor `licensed_stock_photo` (§4.6); `pipeline_runs` ganha `stage` (§4.8, progresso granular); `credit_pricing` ganha `image_generation` (§7.3). Nenhuma tabela nova — `brand_media_assets` (§5.2) segue documentada mas não migrada, decisão deliberada de não-acoplamento (mesma já tomada na Missão 7). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (26 — Missão 10 aprovada, escopo ajustado):** `user_feedback.category` ganha `other`; 3 colunas novas de contexto automático (`pathname`, `app_version`, `user_agent`), todas nullable — capturadas pela aplicação, nunca preenchidas manualmente. Ver [architecture.md §13.1.1](architecture.md#1311-contexto-automático-★-novo-ajuste-pré-implementação) e [docs/changelog.md](changelog.md).
> **Mudança desta revisão (25 — preparação Missão 10):** nova tabela `user_feedback` (§9.3) — captura de sugestões/bugs/dificuldades de uso via botão global, `insert`-only para membros da organização, sem `select` de usuário final (arch. §13). Nenhuma migration aplicada ainda.
> **Mudança desta revisão (24 — Missão 9 dividida em 2 etapas):** nenhuma mudança de schema — `production_mode` (§4.6) já cobria `ai_avatar`/`licensed_stock_video`/`hybrid`/`own_media`/`text_only` desde a revisão 3. Só uma nota de escopo: a **Etapa 1** da Missão 9 usa apenas `licensed_stock_video`; `ai_avatar`/`hybrid` continuam no enum (schema pronto, sem migration necessária depois) mas ficam sem nenhuma linha gravada com esses valores até a **Etapa 2** (futura, recurso Premium) ser implementada. Ver [architecture.md §3.5.1](architecture.md#351-geração-automática-de-vídeo-★-novo-preparação-missão-9) e [docs/changelog.md](changelog.md).
> **Mudança desta revisão (23 — fornecedores concretos aprovados):** nenhuma mudança de schema nesta revisão — confirma que `pipeline_runs.status` já suporta o ciclo `queued → running → completed`/`failed` pedido pelo dono do produto (nota em §4.8) e documenta os fornecedores concretos escolhidos para MVP (Pexels/ElevenLabs/HeyGen/Shotstack — ver [architecture.md §5](architecture.md#5-provider-layer-adapters-plugáveis-resolvidos-por-tier) e [PRD.md §13](../PRD.md#13-decisões-em-aberto-precisam-de-aprovação-antes-de-virar-escopo)). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (22 — preparação Missão 9):** `provider_configs.capability` (§5.1) ganha `video_render`, nova capacidade da Provider Layer ([architecture.md §5](architecture.md#5-provider-layer-adapters-plugáveis-resolvidos-por-tier)). `content_pieces.status` (§4.6) ganha `failed` — primeiro caminho do produto que pode falhar depois de `generating` sem operação humana no meio (pipeline assíncrono de vídeo, §4.6/§4.8). `content_versions.generation_metadata` (§4.6) ganha nota explícita incluindo `video_render_provider_key`. `pipeline_runs` (§4.8), documentada desde revisões antigas mas nunca escrita por nenhuma missão implementada, passa a ser ativamente usada — primeira vez que uma linha real é gravada nela. `credit_ledger` (§7.2) ganha `related_pipeline_run_id` (nova coluna, idempotência de cobrança assíncrona — análoga a `external_payment_id`). `credit_pricing` (§7.3) ganha `video_generation` como novo `trigger_reason`, valores em aberto (PRD §13, item 11). Nenhuma migration aplicada ainda — mudanças de schema propostas aqui aguardam aprovação antes de virar migration real (será `0017` em diante, seguindo a numeração sequencial já usada). Ver [docs/changelog.md](changelog.md) para o relato completo da auditoria que precedeu esta revisão.
> **Mudança desta revisão (21 — Missão 8 implementada e validada):** migration `0012_learning_engine.sql` aplicada e validada em produção — `learning_signals`/`learning_insights` (§4.7) sem mudança de coluna frente ao já documentado; `specialists.applies_to` de `marketing_strategy`/`branding` estendido para `learning_analysis` (mesmo padrão de `trend_ranking`, migration `0006`). Achado real durante a implementação: `intelligence_hub_sessions.related_entity_type` (§4.4) era `not null` com CHECK restrito a `('trend_research', 'campaign', 'content_piece')` — `learning_analysis` não tem uma entidade única desse tipo. Resolvido de forma aditiva, sem quebrar nenhuma sessão existente: `'brand'` adicionado ao CHECK, `related_entity_id = brand_id` para essa decisão. Confirmado em produção que `applied_to` realmente é só um rótulo — `brand_brain_profiles.learned_preferences` é o único destino de escrita, e passou a ser lido por todo Core Engine que monta contexto de marca (`buildBrandContextBlock`).
> **Mudança desta revisão (20 — preparação Missão 8, Learning Engine):** §4.7 (`learning_signals`/`learning_insights`) confirmada pronta para migrar sem mudança de coluna; nota adicionada esclarecendo que `applied_to` é só um rótulo descritivo — todo insight aceito grava em `brand_brain_profiles.learned_preferences`, único mecanismo de aplicação. Nenhum novo `trigger_reason` em `credit_pricing` (análise gratuita, aprovado). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (19 — Missão 7 implementada e validada):** migration `0011_asset_engine.sql` aplicada e validada em produção (Supabase real) — `content_pieces`/`content_versions`/`content_packages` (§4.6), `credit_ledger.related_content_piece_id` (§7.2), `credit_pricing` com `asset_generation` (3/6/12, valor final aprovado — ver revisão 23 de [docs/changelog.md](changelog.md)) e `trend_ranking` reajustado de 1/2/4 para 2/4/8. Helpers de RLS `campaign_organization_id`/`content_piece_organization_id` confirmados funcionando (insert/update restrito a `editor+`, select a membros).
> **Mudança desta revisão (18 — preparação Missão 7, Asset Engine):** §4.6 (`content_pieces`/`content_versions`/`content_packages`) confirmada pronta para migrar, sem mudança de coluna, escopo MVP = `text_only`/`own_media`. §7.2 (`credit_ledger`) ganha `related_content_piece_id` (nova coluna, como já antecipado na revisão 16 — não reaproveita `related_intelligence_hub_session_id`). §7.3 (`credit_pricing`) ganha proposta de preço para `asset_generation` (2/4/8 créditos), pendente de aprovação.
> **Mudança desta revisão (17 — Missão 6 implementada e validada):** migrations `0008_billing.sql` (`subscriptions`, `credit_ledger`, `credit_pricing`, `credit_packages`), `0009_drop_organizations_plan.sql` (coluna morta desde a Sprint 1, nunca usada em código, substituída por `subscriptions.plan`) e `0010_plans.sql` (nova tabela `plans` — §7.5, achado durante a implementação) aplicadas e validadas em produção (Supabase + Mercado Pago sandbox reais). `organizations.plan` removida.
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
(global)      plans (números por plano — sem organization_id)
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
| status | enum(`active`,`blocked`) | ★ novo (Missão 12) — default `active`; "bloquear"/"desbloquear" na tela Organizações do Super Admin ([architecture.md §15.8](architecture.md#158-telas-administrativas--visão-técnica)) alterna este campo, sem apagar nada — separado de `deleted_at` (bloqueado é reversível e temporário; excluído é a decisão final). `getCurrentSession()` nega acesso normal (não-impersonado) quando `status = blocked`; um `super_admin` impersonando continua acessando mesmo bloqueada, para diagnóstico |
| created_by | uuid FK → auth.users (nullable) | usuário que criou a organização (cadastro) |
| is_platform_account | boolean | ★ novo (Missão 12) — default `false`; `true` só para a organização "casa" do(s) `super_admin` ([architecture.md §15.3](architecture.md#153-organização-casa-do-super-admin)), usada para testar o produto sem tocar em dado de cliente real. Excluída das métricas de negócio do Dashboard administrativo (receita, contagem de organizações-cliente) por esta coluna, nunca por heurística |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | soft delete — ver [CONVENTIONS.md](../CONVENTIONS.md); ★ Missão 12 — também usada pela tela Organizações do Super Admin para "excluir" (sempre soft delete, decisão do dono do produto) |

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
| logo_storage_path | text (nullable) | ★ novo (Missão 11) — bucket `brand-media` (já existe desde a Sprint 1), path `{organization_id}/{brand_id}/logo.{ext}`; definido 1x no Perfil da Marca, aplicado automaticamente em toda peça gerada ([architecture.md §14.1](architecture.md#141-identidade-visual-automática-★-ativo-permanente-da-marca-ajuste-do-dono-do-produto)) |
| primary_color_hex | text (nullable) | ★ novo (Missão 11) — ex. `#1E40AF`; campo manual no Perfil da Marca, nunca extraído automaticamente do logo (decisão do dono do produto) |
| secondary_color_hex | text (nullable) | ★ novo (Missão 11, ajuste) — cor de apoio, mesmo espírito de `primary_color_hex` |
| font_family | text (nullable) | ★ novo (Missão 11, ajuste) — nome de fonte (Google Fonts), opcional; usado nos templates de composição ([architecture.md §14.4](architecture.md#144-composição-visual-real-storiescarouselthumbnail-★-ajuste-do-dono-do-produto)) |
| visual_style | text (nullable) | ★ novo (Missão 11, ajuste) — texto livre, não enum fechado (ex. "moderno"/"elegante"/"minimalista"/"corporativo"/"jovem" são sugestões da UI, não uma lista fechada); alimenta prompts de composição/seleção de voz |
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
| status | enum(`active`,`blocked`) | ★ novo (Missão 12) — default `active`; "bloquear"/"desbloquear" na tela Usuários do Super Admin ([architecture.md §15.8](architecture.md#158-telas-administrativas--visão-técnica)) — global ao usuário (não por organização; diferente de `organizations.status`, que bloqueia a organização inteira). `getCurrentSession()` nega acesso quando `status = blocked`, independentemente de qual organização o usuário tentaria acessar |
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
| related_entity_type | enum(`trend_research`,`campaign`,`content_piece`,`brand`) | `brand` ★ Missão 8 — `learning_analysis` não tem uma campanha/peça/pesquisa de tendência específica como assunto, é análise agregada em nível de marca; `related_entity_id` nesse caso é o próprio `brand_id` |
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
| visual_brief | jsonb (nullable) | ★ novo (Missão 11, ressalva de composição) — parâmetros de composição decididos por IA e resolvidos **uma vez por campanha** (cor de destaque escolhida entre `primary_color_hex`/`secondary_color_hex` da marca, redação do título curto, variante de layout) — preenchido na 1ª peça visual gerada da campanha, lido (nunca recalculado) pelas demais peças/candidatos, garantindo identidade visual consistente entre todas as peças ([architecture.md §14.4.3](architecture.md#1443-identidade-visual-consistente-entre-peças-da-mesma-campanha-★-ajuste-do-dono-do-produto)) |
| created_by | uuid FK → auth.users | |
| created_at | timestamptz | |

### 4.6 `content_pieces` / `content_versions` / `content_packages` ★ pronta para migrar (Missão 7)

Schema abaixo já documentado desde revisões anteriores, sem mudança de coluna — confirmado adequado ao escopo do MVP do Asset Engine (`production_mode` limitado a `text_only`/`own_media`, [architecture.md §3.5](architecture.md#35-asset-engine)). `content_versions.output_storage_path` recebe tanto o texto gerado por IA (formatos textuais) quanto o arquivo enviado manualmente pelo cliente (formatos visuais, MVP) — o mesmo campo serve os dois casos, sem coluna especial para "é upload manual ou gerado".

**`content_pieces`**

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK → campaigns | |
| format | enum(`video`,`caption`,`stories`,`carousel`,`thumbnail`,`blog_post`,`email`,`script`,`teleprompter`) | formatos do pacote de conteúdo (PRD §4.3) |
| production_mode | enum(`ai_avatar`,`licensed_stock_video`,`licensed_stock_photo` ★ novo preparação Missão 11,`own_media`,`hybrid`,`text_only`) (nullable) | aplica-se principalmente a `video`/`stories`/`carousel`/`thumbnail`; formatos puramente textuais (`caption`,`blog_post`,`email`,`script`,`teleprompter`) usam `text_only` ou deixam nulo. `licensed_stock_photo` (preparação Missão 11): `stories`/`carousel`/`thumbnail` passam a nascer com esse modo — geração automática via banco de fotos licenciadas, com upload manual (`own_media`) mantido como alternativa por peça ([architecture.md §14.4](architecture.md#144-geração-automática-de-storiescarouselthumbnail)) |
| is_primary | boolean | `true` para a peça "principal" da campanha (passa pelo Intelligence Hub completo — architecture.md §3.4) |
| intelligence_hub_session_id | uuid FK → intelligence_hub_sessions (nullable) | preenchido quando a peça é principal |
| script | text | |
| brand_rationale | text | justificativa curta em linguagem de negócio de por que esta peça reflete a marca (Princípio do Consultor Permanente, [architecture.md §1.1](architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7)); dado-fonte do bloco **"Por que fiz assim?"** no Cartão de Revisão de Peça ([ux-design.md §4.6](ux-design.md#46-cartão-de-revisão-de-peça)) |
| status | enum(`draft`,`generating`,`ready_for_review`,`approved`,`rejected`,`failed` ★ novo, preparação Missão 9) | sem status `published` no MVP; `failed` ★ novo — primeira peça que pode falhar depois de `generating` sem intervenção humana no meio (pipeline assíncrono de vídeo via n8n, [architecture.md §3.5.1](architecture.md#351-geração-automática-de-vídeo-★-novo-preparação-missão-9)/[§8](architecture.md#8-papel-do-n8n)); usuário pode então acionar nova tentativa (mecanismo exato de retry pela UI é decisão de UX, [ux-design.md](ux-design.md)) |
| approved_by | uuid FK → auth.users (nullable) | |
| approved_at | timestamptz (nullable) | |
| selected_version_id | uuid FK → content_versions (nullable) | ★ novo (Missão 11, ressalva de composição) — quando múltiplas `content_versions` são geradas na mesma rodada (§14.4.2), marca qual candidato o usuário escolheu para o pacote final. `null` (todo formato/fluxo existente, sem mudança de comportamento) mantém a regra de sempre hoje — a versão de `version_number` mais alto vence |
| created_at | timestamptz | |

**`content_versions`**

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| content_piece_id | uuid FK → content_pieces | |
| version_number | int | |
| output_storage_path | text | |
| generation_metadata | jsonb | inclui `llm_provider_key`, `avatar_provider_key`, `voice_provider_key`, `media_provider_key`, `video_render_provider_key` (★ novo, preparação Missão 9) + tier ativo no momento da geração + custo em créditos |
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

**Confirmado pronto para migrar, sem mudança de coluna** (preparação Missão 8) — o schema abaixo já estava especificado desde antes da Missão 4 e segue válido para o MVP aprovado. `intelligence_hub_sessions.trigger_reason` é `text` livre (migration `0004`, sem enum/constraint), então o novo tipo de decisão `learning_analysis` não exige migration própria; o mesmo vale para `specialists.applies_to` (`text[]` livre, migration `0004`) — habilitar Marketing/Branding para `learning_analysis` é um `UPDATE`, mesmo padrão já usado para `trend_ranking` (migration `0006`).

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
| applied_to | enum(`brand_brain`,`trend_engine`,`intelligence_hub`,`asset_engine`) | rótulo descritivo de qual comportamento futuro o insight pretende influenciar — **não é um destino de escrita diferente**: todo insight aceito grava em `brand_brain_profiles.learned_preferences` (único mecanismo de aplicação, preparação Missão 8), porque todo Core Engine já carrega o Brand Brain como portão obrigatório (§1.1) e portanto já vê a preferência atualizada, qualquer que seja o `applied_to` |
| status | enum(`pending_review`,`applied`,`dismissed`) | **nunca** pula `pending_review` — aplicação automática não existe em nenhum plano |
| reviewed_by | uuid FK → auth.users (nullable) | |
| created_at | timestamptz | |

### 4.8 `pipeline_runs`

> **★ Ativação real (preparação Missão 9):** esta tabela existe no schema desde revisões antigas, mas nenhuma missão implementada até a revisão 24 chegou a gravar uma linha nela — todo processamento até aqui foi síncrono, sem execução de n8n de verdade. O pipeline de geração de vídeo (§3.5.1) é a primeira escrita real: uma linha por `content_piece` de vídeo em processamento, `engine = 'asset_engine'`, `entity_type = 'content_piece'`, `n8n_execution_id` preenchido pelo workflow do n8n na chamada inicial (usado para correlacionar o webhook de conclusão à execução certa). Granularidade de uma linha por peça (não uma por etapa do pipeline — voz/avatar/render) é a decisão inicial; granularidade mais fina fica para quando houver necessidade real de observabilidade por etapa. **Confirmado (revisão 23):** o ciclo de vida `queued → running → completed`/`failed` já previsto no enum desde a definição original desta tabela é exatamente o usado pelo Fluxo 13 — a linha nasce `queued` (Server Action, antes do webhook para o n8n) e vira `running` assim que o n8n confirma recebimento (passo 2); nenhuma mudança de schema foi necessária para isso.
>
> **★ `stage`/`progress_percent`/`estimated_remaining_seconds` (Missão 11):** a granularidade mais fina "fica para quando houver necessidade real de observabilidade por etapa" citada acima chegou — progresso genérico ("gerando...") deixou de ser suficiente para a experiência do produto ([architecture.md §14.9](architecture.md#149-progresso-granular-★-percentual--tempo-estimado)). Continua **uma linha por peça** (não uma por etapa) — as 3 colunas só registram o estado atual da linha, atualizadas in-place pelo próprio pipeline (`narrating` → `selecting_voice` (1ª geração da marca) → `selecting_scenes`/`selecting_photos` → `rendering` → `applying_branding` → `finalizing`), nunca uma tabela de histórico de etapas. `progress_percent`/`estimated_remaining_seconds` são melhor esforço — `null` é esperado quando não há base para estimar.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| entity_type | enum(`trend_research`,`campaign`,`content_piece`,`intelligence_hub_session`) | |
| entity_id | uuid | polimórfico |
| engine | enum(`trend_engine`,`intelligence_hub`,`asset_engine`,`brand_brain`,`learning_engine`) | |
| n8n_execution_id | text | |
| status | enum(`queued`,`running`,`completed`,`failed`) | |
| stage | text (nullable) | ★ novo (Missão 11) — etapa atual dentro de `running` (§14.9); nunca um enum fechado no banco (a UI decide o mapeamento para copy amigável), só uma string curta que o próprio código do pipeline escreve |
| progress_percent | integer (nullable) | ★ novo (Missão 11, ajuste) — aproximação por peso relativo de cada etapa, calculada no próprio código do pipeline ([architecture.md §14.9](architecture.md#149-progresso-granular-★-percentual--tempo-estimado)) |
| estimated_remaining_seconds | integer (nullable) | ★ novo (Missão 11, ajuste) — melhor esforço ("quando possível"); `null` é estado esperado quando não há base para estimar (ex. tempo de fila do Shotstack), nunca tratado como erro |
| error | text (nullable) | |
| actor_user_id | uuid FK → auth.users (nullable) ★ novo (Missão 12) | achado durante a implementação — o portão de crédito (arch. §15.5) precisa saber quem disparou o pipeline para decidir o bypass de `platform_admin`, mas o webhook de conclusão do n8n roda sem sessão de usuário nenhuma. A Server Action que dispara o pipeline grava aqui; `completeVideoPipelineSuccess`/`completePhotoPipelineSuccess` leem de volta para passar a `recordConsumption` |
| started_at | timestamptz | |
| finished_at | timestamptz (nullable) | |

## 5. Provider Layer — Armazenamento

### 5.1 `provider_configs`

Mapeamento interno **(capability, tier) → fornecedor concreto**. Nunca exposto/editável pelo cliente final — apenas por um painel administrativo interno.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| capability | enum(`llm`,`avatar`,`voice`,`media`,`trend_source`,`video_render` ★ novo, preparação Missão 9) | `video_render` — [architecture.md §5](architecture.md#5-provider-layer-adapters-plugáveis-resolvidos-por-tier), composição final de vídeo (cenas + narração + legenda → MP4); nunca um fornecedor de mídia/avatar/voz |
| tier | enum(`economico`,`balanceado`,`premium`) | |
| specialist_id | uuid FK → specialists (nullable) | **substitui o antigo enum fixo** (revisão 10) — usado só quando `capability = llm` e a resolução precisa variar por especialista dentro do Intelligence Hub (tier Premium — architecture.md §10, item 5) |
| provider_key | text | ex: `openai-mini`, `openai-gpt5`, `claude-sonnet`, `claude-opus`, `heygen`, `elevenlabs` |
| credentials_ref | text (nullable) | referência a variável de ambiente — mecanismo original, mantido para compatibilidade |
| credential_value | text (nullable) | ★ novo (Missão 12) — credencial de verdade, editável pela tela Providers do Super Admin sem tocar `.env` ([architecture.md §15.11](architecture.md#1511-gestão-de-providers-pelo-admin--credenciais-no-banco-não-em-env-★-novo-round-2-item-8)); quando presente, tem precedência sobre `credentials_ref`. Mesma proteção de RLS de toda a tabela — sem policy para `authenticated`/`anon`, só service role; nunca exibida em texto claro na UI, mesmo para `super_admin` (campo sempre mascarado, com ação de "trocar") |
| priority | int | |
| fallback_provider_key | text (nullable) | |
| status | enum(`active`,`inactive`,`error`,`maintenance` ★ novo, Missão 12) | `maintenance` — Provider Gateway trata como indisponível para chamadas novas, sem apagar a config (arch. §15.11) |
| updated_at | timestamptz | |

> Trocar de fornecedor dentro de um tier = nova linha + `status = active` na antiga → `inactive`. Redesenhar o que compõe cada tier = mudança de dados aqui, nunca de código. A partir da Missão 12, essa mudança de dados tem uma interface administrativa real (arch. §15.11) — antes só era possível via acesso direto ao banco.

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
| status | enum(`active`,`past_due`,`canceled`,`trialing`) | sincronizado via webhook do Mercado Pago (Preapproval) para `active`/`past_due`/`canceled`; `trialing` é gerido pela tela Trials do Super Admin ([architecture.md §15.8](architecture.md#158-telas-administrativas--visão-técnica)) — o portão de crédito (§12.3) trata `trialing` como assinatura ativa (não bloqueia), mesma checagem `status !== 'active'` passa a aceitar também `trialing` |
| trial_ends_at | timestamptz (nullable) | ★ novo (Missão 12) — preenchido só quando `status = trialing`; "renovar"/"cancelar"/"alterar dias" a tela Trials edita este campo; "converter assinatura" muda `status` para `active` (fluxo normal de assinatura, sem mudança no webhook do Mercado Pago) |
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
| related_intelligence_hub_session_id | uuid FK → intelligence_hub_sessions (nullable) | consumo vindo de uma sessão do Intelligence Hub (`campaign_strategy`, `trend_ranking`) |
| related_content_piece_id | uuid FK → content_pieces (nullable) ★ novo (Missão 7) | consumo vindo da geração de uma peça de conteúdo (`asset_generation`) — nova coluna, como já antecipado na revisão 16; não reaproveita `related_intelligence_hub_session_id` porque geração de peça derivada não abre uma sessão do Intelligence Hub (Fluxo 3, §3.1) |
| related_pipeline_run_id | uuid FK → pipeline_runs (nullable, **unique**) ★ novo (preparação Missão 9) | consumo vindo de um pipeline assíncrono de geração de vídeo (`video_generation`) — o débito é registrado pelo webhook de conclusão do n8n, não pela Server Action original ([architecture.md §12.3](architecture.md#123-onde-o-portão-de-crédito-é-verificado)); `unique` garante idempotência de webhook exatamente como `external_payment_id` garante para o Mercado Pago — uma segunda entrega do mesmo callback falha por constraint em vez de debitar duas vezes |
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

**Preço em créditos por operação (revisado na Missão 7 — dono do produto ajustou `trend_ranking` e definiu `asset_generation`):**

| trigger_reason | economico | balanceado | premium |
|---|---|---|---|
| `trend_ranking` | 2 | 4 | 8 |
| `asset_generation` ★ novo (Missão 7) | 3 | 6 | 12 |
| `video_generation` ★ novo (Missão 9) | 15 | 30 | 50 |
| `image_generation` ★ novo (preparação Missão 11) | a definir | a definir | a definir |
| `campaign_strategy` | 5 | 10 | 20 |

`trend_ranking` passa de 1/2/4 (seed original, `0008_billing.sql`) para 2/4/8 — ajuste de preço da Missão 7, aplicado via `UPDATE` numa migration nova (nunca editar uma migration já aplicada). `asset_generation`: geração de uma peça de conteúdo textual (`caption`/`blog_post`/`email`/`script`/`teleprompter`) — uma única chamada ao LLM Provider, mais barato que `campaign_strategy` (painel de especialistas), mas mais caro que `trend_ranking`. Peças de formato visual preenchidas por upload manual (MVP) não consomem crédito — não há custo computacional de IA nelas. **`video_generation`:** `trigger_reason` próprio para o pipeline de geração automática de vídeo (§4.6/§4.8, [architecture.md §3.5.1](architecture.md#351-geração-automática-de-vídeo-★-novo-preparação-missão-9)) — deliberadamente separado de `asset_generation` porque o custo real (voz + avatar/mídia + renderização, múltiplos fornecedores pagos) é categoricamente maior e mais variável que uma única chamada de LLM. **`image_generation` (preparação Missão 11):** `trigger_reason` próprio para a geração automática de `stories`/`carousel`/`thumbnail` ([architecture.md §14.4](architecture.md#144-geração-automática-de-storiescarouselthumbnail)) — deliberadamente separado de `video_generation` porque a cadeia de fornecedores é mais simples e mais barata (Pexels Photos + 1 render Shotstack de imagem, contra os 3 fornecedores do vídeo). Valores por tier em aberto — linha inserida com placeholder e ajustada por `UPDATE`, mesmo padrão já usado para `video_generation`/`asset_generation`/`trend_ranking`; não bloqueia a migration.

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

### 7.5 `plans` ★ novo (Missão 6, achado durante a implementação) — ★ ampliada (Missão 12, round 2)

Números de cada plano — dado, não código. Sem esta tabela, o handler de webhook do Mercado Pago (`packages/core`, nunca importa de `apps/web`) e a tela de Configurações (`apps/web`) precisariam de duas constantes hardcoded separadas para a mesma informação (quantos créditos conceder por plano), arriscando divergir. `plan` é a mesma chave usada em `subscriptions.plan`. Mesmo padrão de RLS de `credit_pricing`/`credit_packages`: leitura liberada a qualquer `authenticated`, escrita só via service role (edição, na prática, só por `super_admin` — arch. §15.1.1).

**Conjunto de colunas ampliado (★ ajuste do dono do produto, Missão 12 round 2, item 1):** o modelo de negócio está migrando de "só crédito" para "crédito + limite por recurso" — a tabela ganha os campos abaixo já agora, mesmo que alguns fiquem sem nenhuma validação real ligada nesta missão ([architecture.md §15.10](architecture.md#1510-limites-e-recursos-de-plano--campos-sem-bloqueio-decisão-do-dono-do-produto)), para não exigir migration nova em poucos meses.

| Coluna | Tipo | Notas |
|---|---|---|
| plan | text PK | `starter`, `pro`, `business` |
| max_brands | integer | ★ renomeada (Missão 12, era `brands_included`) — mesmo dado, nome consistente com a família `max_*` nova |
| tier_included | enum(`economico`,`balanceado`,`premium`) | |
| monthly_credits | integer | ★ renomeada (Missão 12, era `credits_per_month`) — concedido via lançamento `grant_plan` a cada ciclo (Fluxo 6, passo 4) |
| price_cents | integer | preço mensal em centavos (BRL) — **valor de exemplo, nunca discutido/aprovado explicitamente** (só os números de crédito/marcas/tier foram decisão de produto confirmada); ajustar é um `UPDATE`, sem migration |
| max_users | integer (nullable) | ★ novo (Missão 12) — `null` = sem limite. Sem nenhum ponto de criação validando este campo nesta missão (arch. §15.10) |
| max_campaigns | integer (nullable) | ★ novo (Missão 12) — mesmo princípio |
| max_monthly_videos | integer (nullable) | ★ novo (Missão 12) — mesmo princípio |
| max_monthly_images | integer (nullable) | ★ novo (Missão 12) — mesmo princípio, para `stories`/`carousel`/`thumbnail` |
| storage_gb | integer (nullable) | ★ novo (Missão 12) — capacidade de armazenamento; sem nenhuma medição/enforcement de uso de Storage nesta missão, só o campo |
| priority_queue | boolean | ★ novo (Missão 12) — default `false`; sem nenhuma fila com prioridade real implementada nesta missão, só o campo |
| allow_ai_video | boolean | ★ novo (Missão 12) — default `true` (todo plano atual já inclui geração automática de vídeo, Missão 9/11 — o campo existe para um plano futuro mais restrito poder desligar) |
| allow_api | boolean | ★ novo (Missão 12) — default `false` (não existe API pública nesta missão nem antes dela) |
| allow_brand_customization | boolean | ★ novo (Missão 12) — default `true` (identidade visual, Missão 11, já disponível a todo plano hoje) |
| allow_team | boolean | ★ novo (Missão 12) — default `false` exceto `business` (reflete o que já existe informalmente — `brand_members`/plano Business, §2.4) |
| allow_white_label | boolean | ★ novo (Missão 12) — default `false` (não existe white-label em nenhum plano hoje) |
| status | enum(`active`,`inactive`) | |
| updated_at | timestamptz | |

**Seed inicial (PRD.md §8, arch. §12.5):** Starter (1 marca, econômico, 100 créditos, R$97,00) · Pro (1 marca, balanceado, 500 créditos, R$297,00) · Business (5 marcas, premium, 1.500 créditos, R$697,00).

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
- `pipeline_runs` (★ ativada na preparação da Missão 9): select restrito a membros da organização da `brand`/`campaign`/`content_piece` referenciada (join por `entity_id`, mesmo princípio de isolamento por `brand_id` já usado para as demais tabelas de Core Engine); insert/update **só via service role** — a Server Action cria a linha inicial, o webhook autenticado do n8n (`apps/web/app/api/webhooks/n8n/route.ts`, service role, nunca client) atualiza status/erro ao concluir. Nenhum usuário grava nesta tabela diretamente.
- `credit_pricing`/`credit_packages`/`plans` (Missão 6): mesmo padrão de `feature_flags` — select liberado a qualquer `authenticated` (preço/números devem ser visíveis, ex. CFG-2/CFG-4), insert/update/delete só via service role.
- `user_feedback` (★ novo, preparação Missão 10): `insert` liberado a membros da organização (`is_org_member`), gravando sempre a própria `organization_id`/`user_id` — nunca em nome de outra organização. **Sem policy de `select`/`update`/`delete` para usuário final** — mesmo padrão de `provider_configs`/`specialists`, leitura/arquivamento/exclusão só via service role (interface administrativa a partir da Missão 12 — §9.3/§15.8 de architecture.md).
- **`is_org_member`/`is_org_admin`/`is_org_editor` ★ estendidas (Missão 12):** as 3 funções de RLS já usadas por toda policy acima passam a conceder acesso também quando `is_platform_admin(auth.uid())` é verdadeiro (★ ajuste round 2 — os 2 papéis, `super_admin` e `support_admin`, não só o primeiro) — ponto único de extensão ([architecture.md §15.2](architecture.md#152-rls--extensão-centralizada-não-checagem-espalhada)), nenhuma policy individual muda. Cobre automaticamente toda tabela listada acima que usa uma dessas 3 funções (não cobre as que dependem só de service role, ex. `provider_configs`/`plans`/`subscriptions` — essas continuam exigindo o guard de aplicação `requirePlatformAdmin()`/`requireSuperAdmin()`, arch. §15.9, que aí sim distingue os 2 papéis).
- `platform_admins` (★ novo, Missão 12): sem policy para `authenticated`/`anon` — leitura e escrita só via service role, mesmo padrão de `provider_configs`/`specialists`. `is_platform_admin()`/`is_super_admin()` (funções `security definer`, §9.4) são o único jeito de qualquer policy consultar esta tabela indiretamente.
- `admin_audit_logs` (★ novo, Missão 12): mesmo padrão — sem policy para `authenticated`/`anon`, leitura/escrita só via service role (a tela Auditoria lê via Server Action, service role, depois de `requirePlatformAdmin()` — disponível aos 2 papéis, arch. §15.1.1).
- `provider_call_logs` (★ novo, Missão 12): mesmo padrão — sem policy para `authenticated`/`anon`, escrita pelos 4 adapters (service role, mesmo client já usado pelo Provider Gateway), leitura só pela tela Providers do Super Admin (service role).

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

### 9.3 `user_feedback` ★ novo (preparação Missão 10)

Captura simples de sugestões/bugs/dificuldades de uso enviadas pelo botão global "Enviar feedback" (arch. §13). Append-only — sem `update`/`updated_at`, cada envio é uma linha nova e definitiva.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations | isolamento multi-tenant, mesmo padrão de toda tabela do produto |
| user_id | uuid FK → auth.users | quem enviou |
| category | text | `check (category in ('suggestion', 'bug', 'difficulty', 'other'))` — `other` ★ ajuste do dono do produto antes da implementação |
| description | text not null | texto livre |
| pathname | text (nullable) | ★ novo (ajuste pré-implementação) — rota onde o usuário estava, capturada no client (`usePathname()`) |
| app_version | text (nullable) | ★ novo — lida no servidor a partir de `package.json`, nunca do client (arch. §13.1.1) |
| user_agent | text (nullable) | ★ novo — lido no servidor via `headers()` (`next/headers`), nunca confiado do client (arch. §13.1.1) |
| created_at | timestamptz | default `now()` |
| archived_at | timestamptz (nullable) | ★ novo (Missão 12) — "arquivar" na tela Feedbacks (CRM interno, [architecture.md §15.8](architecture.md#158-telas-administrativas--visão-técnica)); não é soft delete de domínio (não usa o padrão `deleted_at` de CONVENTIONS.md §4) — é um filtro de triagem, a linha nunca deixa de existir para fins de auditoria/exportação CSV. "Excluir" (pedido) usa `deleted_at`, coluna nova separada, seguindo o padrão normal |
| status | text | ★ novo (Missão 12, round 2 item 5) — `check (status in ('open', 'resolved'))`, default `open`; "marcar como resolvido" na tela Feedbacks |
| internal_response | text (nullable) | ★ novo (Missão 12, round 2 item 5) — nota/resposta interna do admin, **nunca enviada ao usuário que reportou** (decisão explícita: "é só um CRM interno") — 1 campo, não uma thread de mensagens |
| deleted_at | timestamptz (nullable) | ★ novo (Missão 12) — soft delete real, distinto de `archived_at` acima |

### 9.4 `platform_admins` ★ novo (Missão 12)

Identidade dos papéis administrativos — tabela dedicada, sem relação com `organization_members`/`user_profiles` ([architecture.md §15.1](architecture.md#151-identidade-e-papéis--platform_admins-is_platform_admin-is_super_admin)). Concessão/revogação do primeiro admin é operação manual (service role); a partir daí, criar/revogar é uma ação exclusiva de `super_admin` dentro do próprio painel (arch. §15.1.1).

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users (unique) | |
| role | text | ★ ajuste (Missão 12, round 2 item 2) — `check (role in ('super_admin', 'support_admin'))`; matriz de capacidades completa em [architecture.md §15.1.1](architecture.md#1511-matriz-de-capacidades) |
| granted_by | uuid FK → auth.users (nullable) | nulo para o primeiro admin (concedido manualmente fora da aplicação) |
| granted_at | timestamptz | default `now()` |
| deleted_at | timestamptz (nullable) | soft delete — revoga o acesso; `is_platform_admin()`/`is_super_admin()` (abaixo) filtram por `deleted_at is null` |

**Funções SQL:** `public.is_platform_admin(p_user_id uuid) returns boolean` — verdadeiro para qualquer um dos 2 papéis, usada pela extensão de RLS (§8) e pelo bypass de crédito (arch. §15.5). `public.is_super_admin(p_user_id uuid) returns boolean` — verdadeiro só para `role = 'super_admin'`, usada nas 4 ações administrativas exclusivas (arch. §15.1.1). Ambas `security definer`, mesmo padrão de `is_org_member`/`is_org_admin`/`is_org_editor` ([architecture.md §2.1](architecture.md#21-estrutura-de-projeto-monorepo-e-camada-de-acesso-a-dados-★-novo-revisão-5)).

### 9.5 `admin_audit_logs` ★ novo (Missão 12)

Auditoria dedicada de ações administrativas — `audit_logs` (§9.1) não muda, esta tabela é separada e nova ([architecture.md §15.6](architecture.md#156-auditoria-administrativa--admin_audit_logs)). Append-only.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| actor_user_id | uuid FK → auth.users | sempre o admin real, mesmo durante impersonação (arch. §15.4) |
| actor_role | text | ★ novo (Missão 12, round 2 item 2) — `super_admin`/`support_admin`, papel do ator **no momento da ação** (não um join a `platform_admins`, que pode ter mudado/sido revogado depois) |
| organization_id | uuid FK → organizations (nullable) | nulo para ações globais (ex.: editar `plans`, `credit_pricing`) — diferente de `audit_logs.organization_id`, que é `not null` |
| action | text | ex.: `organization.blocked`, `credit_ledger.adjustment`, `plan.updated` |
| entity_type | text | |
| entity_id | uuid (nullable) | |
| before | jsonb (nullable) | estado antes da mudança |
| after | jsonb (nullable) | estado depois da mudança |
| ip_address | text (nullable) | lido no servidor (`request.ip`/cabeçalho de proxy do Next.js), nunca confiado do client |
| user_agent | text (nullable) | lido no servidor via `headers()`, mesmo princípio de `user_feedback.user_agent` (§9.3) |
| created_at | timestamptz | default `now()` |

### 9.6 `provider_call_logs` ★ novo (Missão 12)

Instrumentação real de latência/custo/erro por chamada aos 4 providers reais ([architecture.md §15.7](architecture.md#157-observabilidade-de-providers--provider_call_logs)). Append-only, alto volume — uma linha por chamada de rede real a um fornecedor externo. **Campos ampliados (★ ajuste do dono do produto, Missão 12 round 2, item 4)** — "vai ser ouro quando começar a dar problema".

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| provider_key | text | mesmo valor usado em `provider_configs.provider_key` — corresponde a `provider` do pedido |
| model | text (nullable) | ★ novo — só chamadas de LLM têm modelo distinto do `provider_key` (ex. `claude-opus`/`claude-haiku` sob o mesmo `provider_key`); nulo para os demais |
| endpoint | text (nullable) | ★ novo — path/URL do endpoint chamado |
| capability | text | `llm`, `voice`, `media`, `video_render` — mesmo domínio de `provider_configs.capability` |
| organization_id | uuid FK → organizations (nullable) | nulo quando a chamada não é atribuível a uma organização específica (raro — quase toda chamada real tem organização) |
| request_id | text (nullable) | ★ novo — id/trace do próprio fornecedor, quando ele retorna um (correlaciona com o painel do fornecedor durante um incidente real) |
| started_at | timestamptz | |
| finished_at | timestamptz (nullable) | nulo se a chamada nunca retornou (timeout/crash do processo) |
| latency_ms | integer (nullable) | `finished_at - started_at`, calculado na gravação — corresponde a `tempo` do pedido |
| status | text | ★ renomeada (era `ok boolean`) — `check (status in ('success', 'error'))` |
| error_message | text (nullable) | |
| tokens_input | integer (nullable) | ★ novo — LLM/voice, quando o fornecedor retorna essa informação |
| tokens_output | integer (nullable) | ★ novo — idem |
| cost_estimate_credits | integer (nullable) | proxy usando os mesmos números de `credit_pricing` (§7.3) — não é integração de billing real de cada fornecedor; corresponde a `credits cobrados` do pedido |
| created_at | timestamptz | default `now()` |

## 10. Decisões em Aberto (banco de dados)

1. ~~`credit_pricing`: desenhar tabela de conversão custo→crédito por `capability` + `tier`.~~ **Resolvido (Missão 6):** chave é `trigger_reason` + `tier` (não `capability` + `tier` — ver §7.3), com valores seedados (`trend_ranking` 1/2/4, `campaign_strategy` 5/10/20 por tier).
2. Estrutura exata de `visual_guidelines`, `specialist_opinions.opinion`, `intelligence_hub_sessions.consolidated_result` e `learning_insights.summary` (jsonb) — fixar após prototipagem dos prompts de cada Core Engine. **Já decidido (revisão 7):** `specialist_opinions.opinion` e `intelligence_hub_sessions.consolidated_result` incluem obrigatoriamente uma chave `rationale`; o restante da estrutura permanece em aberto.
3. ~~Confirmar uso de `pgvector` para `knowledge_base_items.embedding`.~~ **Resolvido (revisão 13, Missão 4):** adiado — MVP usa retrieval por recência + `tags`/`source_type`. Coluna `embedding` permanece reservada (nullable) para busca híbrida futura. Ver [architecture.md §10, item 3](architecture.md#10-decisões-em-aberto-arquitetura).
4. `provider_configs.specialist_id`: confirmar se, no MVP, todo tier usa o mesmo modelo para todos os especialistas (campo fica nulo/irrelevante) ou se o tier Premium já precisa de granularidade por especialista desde o início.
5. Se `content_packages` deve versionar (permitir gerar o pacote mais de uma vez após reaprovações) ou é sempre 1:1 com a campanha.
6. `feature_flags`: manter global por enquanto, ou já modelar override por organização (`organization_feature_overrides`) desde a Sprint 1? Adiado até haver um caso de uso real.
7. **★ novo (preparação Missão 9):** granularidade de `pipeline_runs` para o pipeline de vídeo — uma linha por `content_piece` (decisão inicial, §4.8) é suficiente para o MVP, ou observabilidade por etapa (voz/avatar-mídia/render) precisa de linhas separadas desde já? Não bloqueia a migration inicial — pode começar grosseiro e refinar depois, sem mudança de schema incompatível (mesma tabela, só mais linhas).
