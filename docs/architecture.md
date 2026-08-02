# Arquitetura — Ayon Creator

> **Status:** Rascunho v1.0 (revisão 5 — fundação técnica da Sprint 1) — aguardando aprovação
> **Última atualização:** 2026-08-01
> Este documento descreve a arquitetura correspondente ao escopo definido em [PRD.md](../PRD.md). Qualquer nova funcionalidade aprovada no PRD deve refletir aqui antes de virar código.
> **Mudança da revisão 3:** a Ayon Creator é reposicionada como Sistema Operacional de Marketing orientado por IA. Adicionado o **Intelligence Hub** (painel de especialistas + Coordinator AI) como novo Core Engine. Nomes de módulos internos permanecem — mas nunca são expostos ao usuário (ver PRD §2). Onboarding vira entrevista conversacional. Provider Layer passa a ser resolvida por **tier** (Econômico/Balanceado/Premium), nunca por escolha direta de fornecedor. MVP não inclui publicação automática.
> **Mudança da revisão 5 (fundação técnica, sem mudança de escopo de produto):** nova §2.1 define a estrutura de projeto (monorepo) e resolve a decisão em aberto sobre onde a lógica de negócio roda (Server Actions + camada de Repository) — ver §10, item 1, agora marcado como resolvido. Adicionados buckets de Supabase Storage (§9.1) e convenções de plataforma transversais (ThemeProvider, Error Boundaries, logger, Estado Vazio padronizado). Detalhamento operacional dessas convenções em [CONVENTIONS.md](../CONVENTIONS.md).
> **Mudança desta revisão (6 — provisionamento inicial de conta):** nova §2.2 documenta que a confirmação de e-mail do Supabase Auth permanece ativa e que a criação de organization/brand/member/profile é feita por um serviço de Provisionamento Inicial idempotente, acionado no primeiro acesso autenticado — não mais no `signUp`. Ver também [flows.md — Fluxo 1](flows.md#fluxo-1--conheça-sua-empresa-onboarding-conversacional), passo 1, atualizado.

---

## 1. Princípio Central: Modularidade e Independência de Fornecedor

Nenhuma regra de negócio deve "saber" que está falando com OpenAI, Claude, HeyGen ou ElevenLabs. Toda a lógica de produto é escrita contra **Core Engines** (módulos internos, estáveis) que conversam com o mundo externo apenas através de uma **Provider Layer** (adapters plugáveis, com contrato fixo). Trocar de fornecedor = escrever um novo adapter + mudar uma configuração — **zero mudança** nos Core Engines, nos fluxos de produto ou nos workflows do n8n.

Este princípio agora tem uma segunda camada: **o usuário nunca escolhe fornecedor, nem tier técnico algum — só um nível de qualidade/custo (tier)**. A tradução de "tier" para "fornecedor concreto" é uma decisão 100% interna (ver §5.1).

```
Fornecedor troca?           → só a Provider Layer muda.
Regra de negócio muda?      → só os Core Engines mudam.
Cliente vê algo técnico?    → nunca. Sempre linguagem de negócio (ver PRD §2).
```

## 2. Visão Geral em Camadas

```
                          ┌─────────────────────────┐
                          │        Usuário           │
                          │  (vê só linguagem de     │
                          │   negócio — PRD §2)      │
                          └────────────┬──────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │   Next.js (App Router)    │
                          │  React + TS + Tailwind    │
                          │  - UI em linguagem de     │
                          │    negócio                │
                          │  - API Routes (BFF)       │
                          └────────────┬──────────────┘
                                       │  chama
                          ┌────────────▼──────────────┐
                          │       CORE ENGINES         │  ← lógica de produto,
                          │  (provider-agnostic)       │    100% independente de fornecedor
                          │                            │
                          │  • Brand Brain             │
                          │  • Knowledge Base          │
                          │  • Trend Engine            │
                          │  • Intelligence Hub  ★novo │
                          │  • Asset Engine             │
                          │  • Learning Engine          │
                          └────┬───────────────┬────────┘
                               │ orquestrado por │ chama (via contrato)
                     ┌─────────▼───────┐   ┌─────▼──────────────────────┐
                     │       n8n        │   │      PROVIDER LAYER        │
                     │ Orquestração de  │   │ (adapters plugáveis,       │
                     │ pipelines async  │   │  resolvidos por TIER)      │
                     │ (sem lógica de   │   ├────────────────────────────┤
                     │  fornecedor)     │   │ • LLM Provider              │
                     └──────────────────┘   │ • Avatar Provider           │
                                             │ • Voice Provider            │
                                             │ • Media Provider            │
                                             │ • Trend Source Provider     │
                                             └───────────┬─────────────────┘
                                                          │ implementado hoje por
                               ┌──────────────┬───────────┼───────────────┬──────────────┐
                          ┌────▼───┐    ┌─────▼────┐ ┌────▼─────┐   ┌─────▼─────┐  ┌─────▼─────┐
                          │ OpenAI │    │  Claude  │ │  HeyGen  │   │ElevenLabs │  │ Provedor  │
                          │        │    │          │ │          │   │           │  │ de mídia  │
                          └────────┘    └──────────┘ └──────────┘   └───────────┘  │licenciada │
                                                                                     └───────────┘

                          ┌───────────────────────────────────────────────────┐
                          │                     Supabase                      │
                          │  Postgres · Auth · Storage · Edge Functions ·      │
                          │  Realtime — usado por TODAS as camadas acima      │
                          └───────────────────────────────────────────────────┘
```

### 2.1 Estrutura de Projeto (monorepo) e Camada de Acesso a Dados ★ novo (revisão 5)

A partir da Sprint 1, o projeto é organizado como monorepo (pnpm workspaces):

- **`apps/web`** — aplicação Next.js (App Router); única app cliente-facing por enquanto.
- **`packages/ui`** — componentes de apresentação puros (design system), sem dependência de roteamento ou de Supabase — reutilizável por futuras apps (ex.: painel administrativo interno do Provider Gateway).
- **`packages/core`** — lógica de domínio agnóstica de framework: repositórios de acesso a dados, logger, validadores; é onde os Core Engines (§3) serão implementados à medida que forem construídos.
- **`packages/types`** — tipos compartilhados, incluindo os tipos gerados a partir do schema Supabase.

Isso resolve a decisão em aberto §10, item 1 (revisão anterior: "onde os Core Engines rodam fisicamente"): rodam como **Next.js Server Actions**, que chamam exclusivamente uma **camada de Repository** em `packages/core` — nunca o SDK do Supabase diretamente de telas/componentes. Fluxo obrigatório para toda leitura/escrita:

```
Tela (apps/web) → Server Action → Repository (packages/core) → Supabase
```

Cada entidade tem um repository dedicado (ex.: `organization.repository.ts`, `brand.repository.ts`, `user.repository.ts`) — único ponto de código que conhece a tabela e as regras de RLS correspondentes. Válido desde a Sprint 1 (tabelas de plataforma) e mantido quando os Core Engines de produto forem implementados.

**Convenções de plataforma transversais** (aplicadas desde a Sprint 1, detalhadas em [CONVENTIONS.md](../CONVENTIONS.md)): `ThemeProvider` (claro/escuro), Error Boundaries (global e por seção autenticada), `logger` estruturado (`packages/core`), componente padronizado de Estado Vazio (`packages/ui`, conforme [ux-design.md §4.9](ux-design.md#49-outros-componentes-de-apoio)).

### 2.2 Provisionamento Inicial (bootstrap de conta) ★ novo (revisão 6)

Decisão tomada durante a implementação da Sprint 1: a confirmação de e-mail do Supabase Auth **permanece ativa**. Isso significa que, no momento do cadastro (`signUp`), ainda não existe uma sessão autenticada — logo, `organizations`/`organization_members`/`brands`/`user_profiles` **não podem** ser criados nesse instante (a RLS exige `auth.uid()`, que só existe com sessão).

Em vez disso, o cadastro faz **apenas** a criação do usuário no Supabase Auth. A criação de `organizations` + `organization_members` (owner) + `brands` (padrão) + `user_profiles` + `audit_logs` (entrada inicial) é feita por um serviço de **Provisionamento Inicial**:

- Implementado como uma função idempotente em `packages/core` (não como Server Action — é lógica de domínio reutilizável, a Server Action/layout apenas a invoca).
- **Idempotência:** antes de criar qualquer recurso, verifica se o usuário já tem uma `organization_members`. Se sim, não faz nada (retorna o estado existente).
- **Ponto único de acionamento:** a leitura de sessão da aplicação (`getCurrentSession`, usada pelo layout autenticado) aciona o provisionamento sempre que encontra um usuário autenticado sem organização — cobrindo tanto o primeiro login por senha quanto a confirmação por link de e-mail (`/auth/callback`), sem duplicar a lógica em cada ponto de entrada.
- **Gate de acesso:** se o provisionamento falhar, o usuário **não** vê o painel — o Error Boundary da `(platform)` é acionado, com opção de tentar novamente (novo acionamento, seguro por ser idempotente).
- **Reuso futuro:** a função é estruturada para que outros recursos de inicialização de conta (além dos 4 desta sprint) possam ser adicionados ao mesmo envelope idempotente sem mudar o ponto de acionamento.

## 3. Core Engines

Nenhum destes nomes aparece na interface (ver mapeamento em PRD §2). São módulos internos que concentram a lógica de produto e só conhecem **capacidades** (`llm`, `avatar`, `voice`, `media`, `trend_source`), nunca fornecedores.

### 3.1 Brand Brain

A identidade operante de cada marca. Alimentado inicialmente pela **entrevista de onboarding conversacional** (§6) e continuamente pelo **Learning Engine**.

- **Responsabilidade:** manter identidade (tom de voz, público, diretrizes visuais, avatar/voz padrão, história, produtos, concorrentes, objetivos, diferenciais, palavras proibidas/favoritas) e preferências aprendidas; expor uma capacidade interna de **"gerar texto/roteiro consistente com a marca"**, usada por Trend Engine, Intelligence Hub e Asset Engine.
- **Depende de:** Knowledge Base (contexto/retrieval), LLM Provider, Learning Engine.
- **Armazenamento:** `brand_brain_profiles` (ver [database.md](database.md#41-brand_brain_profiles)).

### 3.2 Knowledge Base

O corpus de conhecimento retrivável de cada marca (RAG), incluindo a transcrição bruta da entrevista de onboarding.

- **Responsabilidade:** ingerir documentos, conteúdos passados, FAQs, notas manuais, transcrição da entrevista de onboarding; disponibilizar retrieval para o Brand Brain e para o Intelligence Hub.
- **Armazenamento:** `knowledge_base_items` (ver [database.md](database.md#42-knowledge_base_items)).

### 3.3 Trend Engine

Orquestra a descoberta de tendências relevantes ao nicho/marca ("O que está em alta").

- **Responsabilidade:** consultar Trend Source Provider(s) configurados, consolidar candidatos e enviar ao Intelligence Hub (não mais diretamente ao Brand Brain isoladamente) para ranqueamento estratégico quando a decisão for "importante" (ver §4.3).
- **Armazenamento:** `trend_research` (ver [database.md](database.md#43-trend_research)).

### 3.4 Intelligence Hub ★ (novo)

O mecanismo central de "como a Ayon Creator pensa" (PRD §4.1). Garante que nenhuma decisão estratégica dependa de um único modelo de IA.

- **Responsabilidade:** para uma decisão importante (ex: estratégia de campanha), acionar um painel de **Specialist Agents** — cada um um papel especializado (`marketing`, `copywriting`, `branding`, `niche`, `seo`, `social_media`, `data`) — que geram opiniões independentes a partir do mesmo contexto (Brand Brain + Knowledge Base + tendências do Trend Engine); em seguida, acionar o **Coordinator AI**, que consolida as opiniões em uma única estratégia coerente.
- **Diversidade de modelo:** cada Specialist Agent pode ser resolvido para um `provider_key`/modelo diferente dentro do tier ativo (ver §5.1), maximizando a diversidade de "opiniões" e reduzindo dependência de um único LLM — mesmo quando o Coordinator também é, tecnicamente, uma chamada ao LLM Provider.
- **Quando é acionado:** toda geração de estratégia de campanha (Fluxo 2) e toda peça de conteúdo classificada como "principal" de uma campanha (ex: o vídeo/roteiro central). Peças derivadas/secundárias (ex: variações de legenda) podem reaproveitar a decisão já consolidada, sem novo painel completo — ver decisão em aberto PRD §13.1.
- **Depende de:** LLM Provider (para cada Specialist e para o Coordinator), Brand Brain, Knowledge Base, Trend Engine.
- **Armazenamento:** `intelligence_hub_sessions`, `specialist_opinions` (ver [database.md](database.md#44-intelligence_hub_sessions--specialist_opinions)).

### 3.5 Asset Engine

Orquestra a materialização de cada peça do **pacote de conteúdo** (PRD §4.3), qualquer que seja o modo de produção.

- **Responsabilidade:** para cada `content_piece`, (1) obter o script/copy (via Brand Brain, ou via resultado já consolidado do Intelligence Hub quando a peça é "principal"); (2) conforme o `production_mode`, acionar Avatar Provider e/ou Voice Provider e/ou Media Provider e/ou a biblioteca de mídia própria; (3) compor o resultado final (inclusive em modo híbrido); (4) persistir a saída como nova `content_versions`; (5) ao concluir todas as peças da campanha, montar o **Pacote de Conteúdo** (`content_packages`) para download.
- **Sem publicação automática no MVP:** o Asset Engine entrega sempre um pacote para download — não existe, no MVP, um passo de publicação em canal externo (ver §7).
- **Armazenamento:** `content_pieces`, `content_versions`, `content_packages` (ver [database.md](database.md#45-content_pieces--content_versions--content_packages)).

### 3.6 Learning Engine (produto: Brand Evolution)

Loop de aprendizado contínuo por marca, exposto ao usuário como **"O que funcionou"**.

- **Responsabilidade:** capturar sinais (aprovação, rejeição, edição manual e — quando disponível — métricas de engajamento pós-download/publicação manual), transformá-los em `learning_insights` (sugestões candidatas em linguagem simples, ex: "vídeos de até 35 segundos performam melhor").
- **Regra inegociável:** o Learning Engine **nunca aplica um ajuste automaticamente**. Todo `learning_insight` é apresentado ao usuário como uma pergunta explícita ("Deseja atualizar sua estratégia?") e só é aplicado ao Brand Brain/Trend Engine/Intelligence Hub/Asset Engine mediante aceite humano — isso vale para **todos os planos**, incluindo Business (não é uma feature paga de "automação total").
- **Armazenamento:** `learning_signals`, `learning_insights` (ver [database.md](database.md#46-learning_signals--learning_insights)).

## 4. Intelligence Hub — Detalhamento

```
                 ┌───────────────────────────────────────────┐
                 │        Contexto de entrada                 │
                 │  (Brand Brain + Knowledge Base + Trend     │
                 │   Engine, conforme a decisão em questão)   │
                 └───────────────────┬─────────────────────────┘
                                     │
        ┌────────────┬──────────────┼──────────────┬────────────┬──────────────┬────────────┐
        ▼            ▼              ▼              ▼            ▼              ▼            ▼
   ┌─────────┐  ┌─────────┐   ┌───────────┐  ┌──────────┐  ┌────────┐  ┌────────────────┐ ┌────────┐
   │Marketing│  │  Copy   │   │ Branding  │  │  Nicho   │  │  SEO   │  │ Redes Sociais   │ │ Dados  │
   └────┬────┘  └────┬────┘   └─────┬─────┘  └────┬─────┘  └───┬────┘  └────────┬────────┘ └───┬────┘
        │            │              │             │            │                │              │
        └────────────┴──────────────┴─────────────┴────────────┴────────────────┴──────────────┘
                                     │ opiniões independentes (specialist_opinions)
                                     ▼
                          ┌───────────────────────┐
                          │    Coordinator AI      │
                          │ (consolida em UMA      │
                          │  estratégia coerente)  │
                          └───────────┬────────────┘
                                     ▼
                      Estratégia final (campaigns.strategy_summary
                      ou content_pieces.script, com referência à sessão)
```

Cada Specialist Agent e o Coordinator são, tecnicamente, chamadas ao **LLM Provider** com um prompt/papel diferente — a "equipe de especialistas" é uma composição arquitetural sobre o mesmo Provider Layer, não fornecedores distintos por especialista (embora o tier Premium possa, opcionalmente, atribuir modelos diferentes a especialistas diferentes para maximizar diversidade — ver §5.1 e decisão em aberto PRD §13.2).

## 5. Provider Layer (adapters plugáveis, resolvidos por Tier)

Cada tipo de provider tem um **contrato fixo**. Novos fornecedores só precisam satisfazer o contrato.

| Provider | Capacidade | Contrato (entrada → saída) | Implementação inicial |
|---|---|---|---|
| **LLM Provider** | `llm` | `generateText(prompt, contexto) → texto/estrutura` | OpenAI e/ou Claude |
| **Avatar Provider** | `avatar` | `generateAvatarVideo(script, configAvatar, áudio?) → vídeo` | HeyGen |
| **Voice Provider** | `voice` | `synthesizeVoice(script, configVoz) → áudio` | ElevenLabs |
| **Media Provider** | `media` | `searchMedia(query, filtros) → candidatos`, `fetchMedia(id) → mídia` | Provedor de banco de vídeo licenciado (a definir — PRD §13.6) |
| **Trend Source Provider** | `trend_source` | `fetchTrends(nicho, contextoDeMarca) → candidatos de tendência` | LLM Provider e/ou API externa de tendências |

### 5.1 Tier de Provedor (interface exposta ao cliente) → Provider Registry (interno)

- O único controle visível ao cliente é o **tier**: Econômico, Balanceado ou Premium (PRD §8.1) — escolhido por organização (ou marca, no plano Business).
- Internamente, cada combinação **(capability, tier)** resolve para um `provider_key` concreto em `provider_configs` — ex: `(llm, economico) → openai-mini`, `(llm, premium) → claude-opus`. Essa tabela é administrada internamente (painel administrativo interno, não exposto ao cliente).
- O **Provider Gateway** é o único ponto de código que lê `provider_configs` e invoca o adapter concreto. Core Engines nunca importam SDK de fornecedor nem leem tier diretamente — apenas pedem "preciso da capacidade X para esta organização" ao Gateway.
- Trocar de fornecedor dentro de um tier, ou redesenhar quais fornecedores compõem cada tier, é uma mudança de dados em `provider_configs` — **zero mudança** em Core Engines, fluxos ou n8n.
- Fallback: `provider_configs.fallback_provider_key` permite failover automático dentro do mesmo tier em caso de falha (ver decisão em aberto §7.4).

> Fluxo operacional de troca de fornecedor documentado em [flows.md — Fluxo 9](flows.md#fluxo-9--troca-de-provedor-provider-swap).

## 6. Onboarding Conversacional (arquitetura)

- Implementado como uma interface de chat (Next.js) apoiada por uma sequência de perguntas-guia (história, produtos, clientes, tom de voz, concorrentes, objetivos, diferenciais, palavras proibidas, palavras favoritas), conduzida via **LLM Provider**.
- Cada resposta é gravada de duas formas: (1) estruturada, atualizando os campos correspondentes de `brand_brain_profiles`; (2) bruta/literal, como um novo item em `knowledge_base_items` (permitindo que o Brand Brain e o Intelligence Hub recuperem contexto adicional além dos campos estruturados).
- A entrevista pode ser retomada/complementada a qualquer momento — não é um passo único e travado do cadastro.

## 7. Publicação (fora do MVP)

O MVP entrega exclusivamente um **Pacote de Conteúdo para download** (PRD §4.3, §9.1). Não existe, no MVP, integração de publicação automática em nenhum canal — isso vale para todos os planos, incluindo Business. As tabelas `publishing_channels`/`publications` (ver [database.md](database.md#6-publicação-fora-do-mvp)) permanecem modeladas para uma fase futura do produto, mas nenhum fluxo do MVP as utiliza.

## 8. Papel do n8n

O n8n orquestra **sequências de chamadas aos Core Engines e ao Provider Gateway**, sem conter lógica específica de fornecedor:

1. Processos longos/assíncronos e multi-etapas (entrevista → Brand Brain, tendências, sessão do Intelligence Hub, geração de cada peça, montagem do pacote);
2. Retentativas, timeouts e tratamento de falha entre etapas;
3. Atualização de status das entidades no Supabase a cada etapa concluída (refletido na UI via Realtime).

## 9. Segurança

### 9.1 Buckets de Supabase Storage ★ novo (revisão 5)

Criados desde a Sprint 1 (sem upload ainda — preparam o terreno para as funcionalidades que os populam depois), todos privados, path convention `{organization_id}/{brand_id}/...`:

| Bucket | Alimenta (futuramente) |
|---|---|
| `brand-media` | `brand_media_assets.storage_path` |
| `knowledge-base` | `knowledge_base_items.storage_path` |
| `content-output` | `content_versions.output_storage_path`, `content_packages.storage_path` |

- Autenticação: Supabase Auth.
- Autorização: RLS por organização/marca + checagem de papel na camada de API antes de operações sensíveis (billing, convite de usuários, mudança de tier).
- Segredos de fornecedores armazenados como variáveis de ambiente/segredos geridos, referenciados por `provider_configs.credentials_ref` — nunca expostos ao client, nunca lidos fora do Provider Gateway, e o mapeamento tier→fornecedor nunca é exposto via API pública.
- Webhooks (n8n ↔ Next.js/Supabase) autenticados com secret compartilhado.
- Uploads de mídia e documentos de Knowledge Base validados antes de armazenamento.

## 10. Decisões em Aberto (arquitetura)

1. ~~**Onde os Core Engines rodam fisicamente:** Next.js Route Handlers/Server Actions, Supabase Edge Functions, ou serviço dedicado?~~ **Resolvido na revisão 5** — Next.js Server Actions + camada de Repository (ver §2.1).
2. **Composição de vídeos híbridos:** node de n8n com render externo, ou dentro do próprio Asset Engine?
3. **Índice de retrieval da Knowledge Base:** uso de `pgvector` no Supabase Postgres — confirmar.
4. **Fallback automático de provider:** troca automática para `fallback_provider_key` no mesmo request, ou apenas registro de falha para intervenção manual?
5. **Especialistas com modelos distintos (tier Premium):** vale a pena, em termos de custo/benefício, atribuir modelos diferentes a especialistas diferentes, ou todos usam o mesmo modelo do tier e a diversidade vem só dos prompts/papéis? (Relacionado à decisão de produto PRD §13.2.)
6. Provedor de banco de vídeos públicos licenciados e como ele se integra.

> Estas decisões devem ser resolvidas e refletidas aqui antes da implementação dos módulos correspondentes.
