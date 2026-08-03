# Arquitetura — Ayon Creator

> **Status:** v1.0 (revisão 15 — Missão 5 liberada para código) — **aprovado, fonte oficial da verdade para a implementação**
> **Mudança desta revisão (15 — preparação e aprovação da Missão 5, Trend Engine):** §3.3 (Trend Engine) resolvida: Trend Source Provider do MVP é a busca web nativa da API da Anthropic, sempre atrás do Provider Gateway (contrato `trend_source`, Trend Engine nunca conhece o fornecedor concreto — troca futura por Google Trends/SerpAPI/Exploding Topics/Glimpse/Similarweb é só um novo adapter); nova regra inegociável de que nenhuma tendência entra em estratégia sem passar pelo Intelligence Hub; Fluxo 2 confirmado como Server Action direta, sem n8n. §8 (Papel do n8n) reescrita para refletir que n8n segue não implementado, reservado para quando surgir necessidade real de orquestração assíncrona (Asset Engine é o candidato mais provável). §10, itens 8 e 9, marcados como resolvidos. Aprovado pelo dono do produto. Ver [docs/changelog.md](changelog.md) para o detalhamento completo.
> **Mudança desta revisão (14 — Missão 4 implementada):** §3.2 (Knowledge Base) implementada e validada com Supabase real — upload de PDF/DOCX/TXT com extração síncrona (`mammoth` para DOCX, `pdf-parse` para PDF), nota manual, edição de tags, remoção (soft delete). `pdf-parse` precisou ser excluído do barrel de exports de `@ayon/core` (ver `packages/core/src/index.ts`) porque depende de `fs` e quebrava o bundle de Client Components que importavam qualquer coisa do pacote — importado agora só pelo arquivo específico que precisa dele. Retrieval por recência/tags confirmado como suficiente para o MVP (nenhum provider de embedding integrado, conforme decidido).
> **Mudança desta revisão (13 — pós-validação da Missão 3):** §10, item 7, marcado como resolvido — os 4 prompts do Specialist Registry foram validados qualitativamente com Supabase e Anthropic reais e documentados individualmente em [`docs/prompts/`](prompts/). Nova §11 registra o **Tool Registry** (ferramentas externas plugáveis para especialistas) como evolução arquitetural futura — não implementada agora, apenas documentada para não ser esquecida nem reinventada de forma inconsistente.
> **Mudança desta revisão (10 — infraestrutura de especialistas plugáveis, Missão 3 redefinida):** o Intelligence Hub deixa de tratar os especialistas (e o Coordinator) como papéis fixos no código — nova §4.1 define o **Specialist Registry**, uma tabela (`specialists`) que descreve cada especialista por dados (identidade, objetivo, system prompt, capacidade de Provider Layer, aplicabilidade, prioridade, parâmetros configuráveis), resolvida em tempo de execução exatamente como o Provider Gateway resolve fornecedores. `provider_configs.specialist_type` (enum fixo) é substituído por `provider_configs.specialist_id` (FK para `specialists`) — detalhado em [database.md §4.4](database.md#44-intelligence_hub_sessions--specialist_opinions--specialists). Isso resolve, na prática, a decisão em aberto PRD §13.1 (quais especialistas rodam em cada tipo de decisão passa a ser dado, não código). Ver também [docs/engine-behavior.md](engine-behavior.md) para o comportamento esperado de cada especialista.
> **Última atualização:** 2026-08-03
> **Mudança desta revisão (8 — consolidação final antes da Missão 2):** §1.1 ganha 3 regras: contexto de entrada do Intelligence Hub/Asset Engine passa a incluir explicitamente histórico de campanhas e aprendizados aplicados (memória de longo prazo, não só o Brand Brain do instante); a justificativa em linguagem de negócio ganha nome de affordance padrão — **"Por que fiz assim?"**; e uma regra inegociável nova — nenhum caminho de geração de conteúdo pode pular o carregamento do Brand Brain. Ver [PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7).
> Este documento descreve a arquitetura correspondente ao escopo definido em [PRD.md](../PRD.md). Qualquer nova funcionalidade aprovada no PRD deve refletir aqui antes de virar código.
> **Mudança da revisão 3:** a Ayon Creator é reposicionada como Sistema Operacional de Marketing orientado por IA. Adicionado o **Intelligence Hub** (painel de especialistas + Coordinator AI) como novo Core Engine. Nomes de módulos internos permanecem — mas nunca são expostos ao usuário (ver PRD §2). Onboarding vira entrevista conversacional. Provider Layer passa a ser resolvida por **tier** (Econômico/Balanceado/Premium), nunca por escolha direta de fornecedor. MVP não inclui publicação automática.
> **Mudança da revisão 5 (fundação técnica, sem mudança de escopo de produto):** nova §2.1 define a estrutura de projeto (monorepo) e resolve a decisão em aberto sobre onde a lógica de negócio roda (Server Actions + camada de Repository) — ver §10, item 1, agora marcado como resolvido. Adicionados buckets de Supabase Storage (§9.1) e convenções de plataforma transversais (ThemeProvider, Error Boundaries, logger, Estado Vazio padronizado). Detalhamento operacional dessas convenções em [CONVENTIONS.md](../CONVENTIONS.md).
> **Mudança desta revisão (6 — provisionamento inicial de conta):** nova §2.2 documenta que a confirmação de e-mail do Supabase Auth permanece ativa e que a criação de organization/brand/member/profile é feita por um serviço de Provisionamento Inicial idempotente, acionado no primeiro acesso autenticado — não mais no `signUp`. Ver também [flows.md — Fluxo 1](flows.md#fluxo-1--conheça-sua-empresa-onboarding-conversacional), passo 1, atualizado.
> **Mudança desta revisão (7 — Princípio do Consultor Permanente):** nova §1.1 traduz o princípio de produto ([PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7)) em exigência arquitetural: toda saída do Intelligence Hub e do Asset Engine carrega uma justificativa em linguagem de negócio ancorada no Brand Brain. §3.1/3.2/3.4/3.5/§6 atualizadas; termo "entrevista" removido do corpo vivo do documento (mantido apenas em notas históricas de revisões anteriores). Implicações em [database.md](database.md) (`content_pieces.brand_rationale`, estrutura de `specialist_opinions.opinion`/`intelligence_hub_sessions.consolidated_result`) e [flows.md](flows.md) (Fluxos 1, 2, 3, 4, 10).

---

## 1. Princípio Central: Modularidade e Independência de Fornecedor

Nenhuma regra de negócio deve "saber" que está falando com OpenAI, Claude, HeyGen ou ElevenLabs. Toda a lógica de produto é escrita contra **Core Engines** (módulos internos, estáveis) que conversam com o mundo externo apenas através de uma **Provider Layer** (adapters plugáveis, com contrato fixo). Trocar de fornecedor = escrever um novo adapter + mudar uma configuração — **zero mudança** nos Core Engines, nos fluxos de produto ou nos workflows do n8n.

Este princípio agora tem uma segunda camada: **o usuário nunca escolhe fornecedor, nem tier técnico algum — só um nível de qualidade/custo (tier)**. A tradução de "tier" para "fornecedor concreto" é uma decisão 100% interna (ver §5.1).

```
Fornecedor troca?           → só a Provider Layer muda.
Regra de negócio muda?      → só os Core Engines mudam.
Cliente vê algo técnico?    → nunca. Sempre linguagem de negócio (ver PRD §2).
```

### 1.1 Princípio Consultor Permanente: Justificativa Fundamentada em Marca ★ novo (revisão 7)

Consequência arquitetural do princípio de produto definido em [PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7): a Ayon nunca é tratada, em nenhuma camada, como uma IA que só pergunta ou só gera — é um consultor permanente que **justifica toda decisão com base no que já sabe sobre a marca**. Isso é exigência técnica, não só de copy:

- Toda saída do **Intelligence Hub** (opinião de cada especialista e resultado consolidado do Coordinator) inclui um campo de **justificativa em linguagem de negócio**, referenciando explicitamente atributos do Brand Brain usados naquela decisão — nunca apenas o resultado (ver §4). Na interface, essa justificativa é sempre acessível através do bloco padrão **"Por que fiz assim?"** ([ux-design.md §4.11](ux-design.md#411-bloco-de-justificativa-de-marca-★-novo-revisão-7)).
- Toda **peça de conteúdo** do Asset Engine que chega à revisão humana (Fluxo 4) vem com uma justificativa curta e legível de por que aquela escolha reflete a marca — não é um campo opcional de debug, é parte do contrato de saída (`content_pieces.brand_rationale`, [database.md §4.6](database.md#46-content_pieces--content_versions--content_packages)).
- **Memória de longo prazo:** o contexto de entrada de qualquer decisão do Intelligence Hub ou do Asset Engine inclui não só o estado atual do Brand Brain, mas um resumo do histórico recente de campanhas da marca e dos aprendizados já aplicados via Brand Evolution (§3.6) — a Ayon nunca decide como se fosse a primeira campanha ou a primeira interação com a marca (ver §4).
- **Regra inegociável — Brand Brain como portão obrigatório:** nenhum caminho de geração de conteúdo (Asset Engine, Intelligence Hub, ou qualquer atalho futuro) pode chamar LLM/Avatar/Voice/Media Provider sem primeiro carregar o contexto do Brand Brain. Não existe, e nunca deve existir, um modo "geração rápida" que pule esse carregamento — mesmo nível de regra inegociável que a aprovação humana do Learning Engine (§3.6).
- A **conversa de onboarding** ("Conheça sua empresa" — §6) não é uma sequência de perguntas e respostas: cada turno da Ayon reage ao que acabou de ouvir e, sempre que fizer sentido, conecta com algo dito anteriormente na mesma conversa (ou já conhecido via Brand Brain/Knowledge Base, em interações futuras).
- Nenhum campo de justificativa é jargão técnico — é texto em linguagem de negócio, sujeito à mesma regra do PRD §2.

> Ver [docs/ux-design.md §1](ux-design.md#1-princípios-de-ux) para como isso aparece na interface, e §4 (Painel de Especialistas, Cartão de Revisão de Peça) para onde a justificativa é exibida.

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

A identidade operante de cada marca. Alimentado inicialmente pela **conversa de onboarding** (§6) e continuamente pelo **Learning Engine**.

- **Responsabilidade:** manter identidade (tom de voz, público, diretrizes visuais, avatar/voz padrão, história, produtos, concorrentes, objetivos, diferenciais, palavras proibidas/favoritas) e preferências aprendidas; expor uma capacidade interna de **"gerar texto/roteiro consistente com a marca"**, usada por Trend Engine, Intelligence Hub e Asset Engine.
- **Depende de:** Knowledge Base (contexto/retrieval), LLM Provider, Learning Engine.
- **Armazenamento:** `brand_brain_profiles` (ver [database.md](database.md#41-brand_brain_profiles)).

### 3.2 Knowledge Base ★ ingestão detalhada (Missão 4, revisão 13)

O corpus de conhecimento retrivável de cada marca (RAG), incluindo a transcrição bruta da conversa de onboarding.

- **Responsabilidade:** ingerir documentos, conteúdos passados, FAQs, notas manuais, transcrição da conversa de onboarding; disponibilizar retrieval para o Brand Brain e para o Intelligence Hub.
- **Pipeline de ingestão de documento (KB-2 — "Ensine sua empresa para a IA"):** (1) usuário envia um arquivo (PDF, DOCX ou TXT) + tags opcionais; (2) arquivo vai para o Supabase Storage (bucket `knowledge-base`, já previsto em §9.1); (3) extração de texto acontece **de forma síncrona na mesma Server Action**, usando uma biblioteca de extração em JS (não n8n) — mesma lógica de latência do Fluxo 1 (§6): um upload que trava esperando um round-trip de webhook seria pior experiência que extrair o texto direto, para os tamanhos de arquivo aceitos no MVP; (4) o texto extraído vira `knowledge_base_items.content_text`, com `source_type` de acordo com o que o usuário indicou (`document`, `past_content`, `faq`, `performance_note` ou `manual_note`) e `storage_path` apontando para o arquivo original. Notas manuais (sem arquivo) pulam os passos 2–3 e vão direto para `content_text`.
- **Retrieval no MVP (resolve arquitetura.md §10, item 3 — ver detalhe abaixo):** por enquanto, **sem embeddings/pgvector**. O contexto de Knowledge Base usado pelo Intelligence Hub e pelo Brand Brain é montado por recência (itens mais recentes da marca) + filtro por `tags`/`source_type` quando aplicável — mesmo princípio já usado para o histórico de campanhas (§1.1, "memória de longo prazo"). Retrieval semântico de verdade (embeddings) fica registrado como evolução futura, não uma dívida técnica silenciosa.
- **Armazenamento:** `knowledge_base_items` (ver [database.md](database.md#42-knowledge_base_items)).

### 3.3 Trend Engine

Orquestra a descoberta de tendências relevantes ao nicho/marca ("O que está em alta").

- **Responsabilidade:** consultar o Trend Source Provider ativo (via Provider Gateway) para candidatos de tendência e enviar ao Intelligence Hub — nunca ao Brand Brain isoladamente — para ranqueamento estratégico (ver §4.3).
- **Armazenamento:** `trend_research` (ver [database.md](database.md#43-trend_research)).
- **Trend Source Provider do MVP (resolvido, revisão 15 — aprovado pelo dono do produto):** adapter inicial de `trend_source` implementado sobre a ferramenta de busca web nativa da API da Anthropic, resolvido pelo Provider Gateway pelo contrato `(capability: "trend_source", tier)` — exatamente como qualquer outro capability hoje (`llm`). **O Trend Engine nunca conhece a Anthropic diretamente**, apenas o contrato `trend_source` (lista de candidatos de tendência a partir de um `niche`); a implementação concreta (hoje, busca web da Anthropic) fica inteiramente isolada no adapter, atrás do Provider Gateway. Candidatos futuros de substituição, sem nenhuma mudança no Trend Engine — só um novo adapter + linha em `provider_configs`: Google Trends, SerpAPI, Exploding Topics, Glimpse, Similarweb.
- **Regra inegociável — uma tendência nunca entra diretamente na estratégia:** todo candidato de tendência produzido pelo Trend Source Provider passa obrigatoriamente pelo Intelligence Hub antes de influenciar qualquer decisão de campanha. Fluxo obrigatório: **Trend Source Provider → Trend Engine → Intelligence Hub → Brand Brain (contexto) → Painel de Especialistas → Coordinator → estratégia final** (`campaigns.strategy_summary`). Nenhuma tendência é exibida ao usuário como recomendação, nem vira campanha, sem antes ser interpretada à luz da identidade da marca — mesma família de regra do "portão" obrigatório do Brand Brain já registrada em [§1.1](#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7).
- **Orquestração (resolvido, revisão 15 — aprovado pelo dono do produto):** Fluxo 2 é Server Action direta (`Tela → Server Action → Repository → Provider Gateway → Trend Source Provider → Trend Engine → Intelligence Hub → Coordinator`), sem webhook para n8n — mesmo padrão já usado e validado nos Fluxos 1, 10 e 11 (Missões 2, 3 e 4). Ver §8 (Papel do n8n) para quando n8n de fato entra na arquitetura.

### 3.4 Intelligence Hub ★ (novo)

O mecanismo central de "como a Ayon Creator pensa" (PRD §4.1). Garante que nenhuma decisão estratégica dependa de um único modelo de IA.

- **Responsabilidade:** para uma decisão importante (ex: estratégia de campanha), consultar o **Specialist Registry** (§4.1) para resolver quais especialistas se aplicam a este tipo de decisão, acionar cada um para gerar uma opinião independente a partir do mesmo contexto (Brand Brain + Knowledge Base + tendências do Trend Engine + histórico de campanhas/aprendizados da marca — ver "Memória de longo prazo" abaixo); em seguida, acionar o especialista marcado como **Coordinator** no registry, que consolida as opiniões em uma única estratégia coerente. Nenhum papel de especialista é hardcoded — adicionar, remover ou ajustar um especialista é uma mudança de dados em `specialists`, nunca uma mudança de código no Intelligence Hub.
- **Diversidade de modelo:** cada especialista pode ser resolvido para um `provider_key`/modelo diferente dentro do tier ativo (ver §5.1), maximizando a diversidade de "opiniões" e reduzindo dependência de um único LLM — mesmo quando o Coordinator também é, tecnicamente, uma chamada ao LLM Provider.
- **Quando é acionado:** toda geração de estratégia de campanha (Fluxo 2) e toda peça de conteúdo classificada como "principal" de uma campanha (ex: o vídeo/roteiro central). Peças derivadas/secundárias (ex: variações de legenda) podem reaproveitar a decisão já consolidada, sem novo painel completo — ver decisão em aberto PRD §13.1.
- **Justificativa obrigatória (Princípio do Consultor Permanente, §1.1):** cada opinião e o resultado consolidado do Coordinator incluem uma justificativa em linguagem de negócio ancorada no Brand Brain — nunca apenas a recomendação nua. Exibida na interface como **"Por que fiz assim?"**.
- **Memória de longo prazo (Princípio do Consultor Permanente, §1.1):** o contexto de entrada não se limita ao estado atual do Brand Brain — inclui um resumo do histórico recente de `campaigns` da marca e dos `learning_insights` já aplicados, para que a estratégia nunca ignore decisões, testes ou aprendizados anteriores.
- **Depende de:** LLM Provider (para cada Specialist e para o Coordinator), Brand Brain, Knowledge Base, Trend Engine, histórico de campanhas.
- **Armazenamento:** `intelligence_hub_sessions`, `specialist_opinions` (ver [database.md](database.md#44-intelligence_hub_sessions--specialist_opinions)).

### 3.5 Asset Engine

Orquestra a materialização de cada peça do **pacote de conteúdo** (PRD §4.3), qualquer que seja o modo de produção.

- **Responsabilidade:** para cada `content_piece`, (1) obter o script/copy (via Brand Brain, ou via resultado já consolidado do Intelligence Hub quando a peça é "principal"); (2) conforme o `production_mode`, acionar Avatar Provider e/ou Voice Provider e/ou Media Provider e/ou a biblioteca de mídia própria; (3) compor o resultado final (inclusive em modo híbrido); (4) persistir a saída como nova `content_versions`; (5) ao concluir todas as peças da campanha, montar o **Pacote de Conteúdo** (`content_packages`) para download.
- **Justificativa de marca (Princípio do Consultor Permanente, §1.1):** toda peça que chega à revisão humana (Fluxo 4) inclui uma justificativa curta de por que aquela escolha reflete a marca, persistida em `content_pieces.brand_rationale` ([database.md §4.6](database.md#46-content_pieces--content_versions--content_packages)), exibida na interface como **"Por que fiz assim?"**.
- **Regra inegociável — Brand Brain como portão obrigatório (Princípio do Consultor Permanente, §1.1):** o Asset Engine nunca chama LLM/Avatar/Voice/Media Provider para gerar uma peça sem primeiro carregar o Brand Brain da marca (diretamente, ou via resultado já consolidado do Intelligence Hub, que por sua vez já parte do Brand Brain). Não existe modo de "geração rápida" que pule esse carregamento — mesmo nível de regra inegociável que a aprovação humana obrigatória do Learning Engine (§3.6).
- **Sem publicação automática no MVP:** o Asset Engine entrega sempre um pacote para download — não existe, no MVP, um passo de publicação em canal externo (ver §7).
- **Armazenamento:** `content_pieces`, `content_versions`, `content_packages` (ver [database.md](database.md#45-content_pieces--content_versions--content_packages)).

### 3.6 Learning Engine (produto: Brand Evolution)

Loop de aprendizado contínuo por marca, exposto ao usuário como **"O que funcionou"**.

- **Responsabilidade:** capturar sinais (aprovação, rejeição, edição manual e — quando disponível — métricas de engajamento pós-download/publicação manual), transformá-los em `learning_insights` (sugestões candidatas em linguagem simples, ex: "vídeos de até 35 segundos performam melhor").
- **Regra inegociável:** o Learning Engine **nunca aplica um ajuste automaticamente**. Todo `learning_insight` é apresentado ao usuário como uma pergunta explícita ("Deseja atualizar sua estratégia?") e só é aplicado ao Brand Brain/Trend Engine/Intelligence Hub/Asset Engine mediante aceite humano — isso vale para **todos os planos**, incluindo Business (não é uma feature paga de "automação total").
- **Armazenamento:** `learning_signals`, `learning_insights` (ver [database.md](database.md#46-learning_signals--learning_insights)).

## 4. Intelligence Hub — Detalhamento

> **Memória de longo prazo (Princípio do Consultor Permanente, §1.1):** o "Contexto de entrada" do diagrama abaixo não é só o snapshot atual do Brand Brain — inclui também um resumo do histórico recente de campanhas da marca (`campaigns`) e dos aprendizados já aplicados (`learning_insights`), montado pelo Intelligence Hub antes de acionar os especialistas.

```
                 ┌───────────────────────────────────────────┐
                 │        Contexto de entrada                 │
                 │  (Brand Brain + Knowledge Base + Trend     │
                 │   Engine + histórico de campanhas,         │
                 │   conforme a decisão em questão)           │
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

Cada opinião e a estratégia final carregam uma justificativa em linguagem de negócio (não apenas o resultado) — Princípio do Consultor Permanente (§1.1), persistida em `specialist_opinions.opinion.rationale` / `intelligence_hub_sessions.consolidated_result.rationale` ([database.md §4.4](database.md#44-intelligence_hub_sessions--specialist_opinions--specialists)).

### 4.1 Specialist Registry (especialistas plugáveis) ★ novo (revisão 10)

O painel de especialistas do diagrama acima (Marketing, Copy, Branding, Nicho, SEO, Redes Sociais, Dados) e o próprio Coordinator **não são papéis fixos no código** — são registros na tabela `specialists`, resolvidos em tempo de execução pelo Intelligence Hub exatamente como o Provider Gateway resolve fornecedores (§5.1). Adicionar, desativar ou ajustar um especialista é uma mudança de dados, nunca uma mudança de código no Intelligence Hub.

Cada linha de `specialists` descreve um especialista (ou o Coordinator, que é modelado como um especialista com `role = coordinator`) por 7 atributos:

| Atributo | Coluna | Papel |
|---|---|---|
| Identidade | `name` | Nome de negócio exibido internamente na documentação/administração (ex.: "Especialista em Marketing") — nunca aparece ao usuário final além do já previsto em [ux-design.md §4.1](ux-design.md#41-painel-de-especialistas-intelligence-hub--componente-assinatura) |
| Objetivo | `objective` | O que este especialista deve avaliar/produzir — ex.: "avaliar a estratégia sob a ótica de posicionamento e marca" |
| System prompt | `system_prompt` | O prompt que efetivamente conduz a chamada ao LLM Provider para este especialista — ver [docs/engine-behavior.md](engine-behavior.md) para os princípios de comportamento que todo `system_prompt` de especialista deve seguir |
| Provider (capacidade do Provider Layer) | `provider_capability` | Qual capacidade do Provider Layer este especialista consome — hoje sempre `llm`, mas o campo existe para especialistas futuros que precisem de outra capacidade (ex.: visão). **Nunca** um fornecedor específico — a resolução de fornecedor continua 100% no Provider Gateway (§5.1), combinando esta capacidade + o tier da organização + o `specialist_id` (ver §5.1) |
| Capabilities (aplicabilidade) | `applies_to` | Em quais tipos de decisão este especialista participa (ex.: `campaign_strategy`, `trend_ranking`, `content_piece_review`) — resolve, na prática, a decisão em aberto PRD §13.1: o conjunto de especialistas por decisão passa a ser uma consulta filtrada por este campo, não uma lista hardcoded |
| Prioridade | `priority` | Peso/ordem usado pelo Coordinator ao consolidar opiniões divergentes, e ordem de exibição no Painel de Especialistas |
| Parâmetros configuráveis | `parameters` | jsonb livre para ajustes finos por especialista (ex.: `temperature`, `max_tokens`, ou parâmetros específicos do papel) — nunca lido fora da chamada ao LLM Provider para este especialista |

**Acesso:** assim como `provider_configs`, `specialists` não tem policy de RLS para o usuário final — é administrado internamente (painel administrativo interno da Ayon, não do cliente). Nenhuma organização/marca tem sua própria configuração de especialistas; o painel é o mesmo produto/arquitetura para todos os clientes, o que varia por chamada é o contexto (Brand Brain da marca em questão), nunca o conjunto de especialistas em si.

**Resolução em tempo de execução:** para uma decisão de tipo `X`, o Intelligence Hub consulta `specialists` onde `status = 'active'` e `applies_to` contém `X`, ordenado por `priority`, aciona cada um, e por fim aciona o registro com `role = coordinator`. Ver [flows.md — Fluxo 10](flows.md#fluxo-10--coordenação-de-especialistas-intelligence-hub) para o passo a passo atualizado.

> Detalhamento de schema em [database.md §4.4](database.md#44-intelligence_hub_sessions--specialist_opinions--specialists).

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
- Internamente, cada combinação **(capability, tier)** resolve para um `provider_key` concreto em `provider_configs` — ex: `(llm, economico) → openai-mini`, `(llm, premium) → claude-opus`. Essa tabela é administrada internamente (painel administrativo interno, não exposto ao cliente). Quando a resolução precisa variar por especialista (tier Premium, §10 item 5), a combinação é **(capability, tier, specialist_id)** — `specialist_id` referencia `specialists` (§4.1), nunca mais um enum fixo de papéis.
- O **Provider Gateway** é o único ponto de código que lê `provider_configs` e invoca o adapter concreto. Core Engines nunca importam SDK de fornecedor nem leem tier diretamente — apenas pedem "preciso da capacidade X para esta organização" ao Gateway.
- Trocar de fornecedor dentro de um tier, ou redesenhar quais fornecedores compõem cada tier, é uma mudança de dados em `provider_configs` — **zero mudança** em Core Engines, fluxos ou n8n.
- Fallback: `provider_configs.fallback_provider_key` permite failover automático dentro do mesmo tier em caso de falha (ver decisão em aberto §7.4).

> Fluxo operacional de troca de fornecedor documentado em [flows.md — Fluxo 9](flows.md#fluxo-9--troca-de-provedor-provider-swap).

## 6. Conversa de Onboarding (arquitetura)

- Implementada como uma interface de chat (Next.js), conduzida via **LLM Provider** — mas o modelo de comportamento não é "perguntar e registrar resposta": é o **Princípio do Consultor Permanente** (§1.1) aplicado ao primeiro contato com a marca.
- Os 9 dados estruturados (história, produtos, clientes, tom de voz, concorrentes, objetivos, diferenciais, palavras proibidas, palavras favoritas) continuam sendo o que precisa ser capturado, mas o prompt que conduz a conversa é responsável por: (1) reagir a cada resposta antes de seguir adiante; (2) trazer observações/hipóteses/provocações baseadas no que já foi dito, não só extrair o próximo dado; (3) conectar espontaneamente respostas de temas diferentes quando fizer sentido (ex: relacionar um diferencial citado com o tom de voz descrito depois).
- Cada resposta continua sendo gravada de duas formas: (1) estruturada, atualizando os campos correspondentes de `brand_brain_profiles`; (2) bruta/literal, como um novo item em `knowledge_base_items` (`source_type = onboarding_conversation`), permitindo que o Brand Brain e o Intelligence Hub recuperem contexto adicional além dos campos estruturados.
- A conversa pode ser retomada/complementada a qualquer momento — não é um passo único e travado do cadastro. Ao retomar, o contexto já capturado é reinjetado no prompt para que a Ayon recapitule com uma referência específica ao que já foi dito, nunca um "continuando de onde paramos" genérico.
- Nenhum indicador de progresso baseado em contagem de campos é exposto à UI, nem deve existir como conceito no backend voltado à interface — o que a UI consome é uma síntese incremental de entendimento (ver [ux-design.md §4.2](ux-design.md#42-conversa-com-o-consultor-onboarding-conversacional)), não uma fração de campos preenchidos.
- **Caminho de execução (esclarecido na revisão técnica pré-Missão 2):** cada turno da conversa é uma chamada síncrona **Server Action → LLM Provider**, direta, sem passar pelo n8n — a latência-alvo da reação da Ayon (800ms–1.5s, [ux-design.md §4.2](ux-design.md#42-conversa-com-o-consultor-onboarding-conversacional)) é incompatível com o overhead de um round-trip via webhook do n8n. O n8n (§8) fica reservado para os passos verdadeiramente assíncronos e não conversacionais desse fluxo — ex: extração/gravação em `knowledge_base_items` e a síntese final que gera o Perfil da Marca (ONB-3) — nunca a troca de mensagens em si.
- Uma resposta do usuário pode atualizar **mais de um campo estruturado ao mesmo tempo** (ex: uma única resposta no tema "concorrência + diferenciais" pode gerar registros para `competitors` e `differentiators` simultaneamente) — a extração não assume relação 1:1 entre resposta e `question_key`.

## 7. Publicação (fora do MVP)

O MVP entrega exclusivamente um **Pacote de Conteúdo para download** (PRD §4.3, §9.1). Não existe, no MVP, integração de publicação automática em nenhum canal — isso vale para todos os planos, incluindo Business. As tabelas `publishing_channels`/`publications` (ver [database.md](database.md#6-publicação-fora-do-mvp)) permanecem modeladas para uma fase futura do produto, mas nenhum fluxo do MVP as utiliza.

## 8. Papel do n8n

**Não implementado até esta revisão (15)** — nenhuma missão entregue até aqui (Missões 2, 3 e 4) precisou de n8n de fato; todas usaram Server Action direta (ver §6, §3.2, §3.3), inclusive processos que a v1.0 original previa para o n8n, como a sessão do Intelligence Hub e — a partir da revisão 15 — a descoberta de tendências. Isso não invalida o papel do n8n na arquitetura: é uma decisão deliberada de não adicionar infraestrutura antes dela gerar valor real.

Quando o n8n orquestrar de fato, seu papel continua sendo **sequenciar chamadas aos Core Engines e ao Provider Gateway, sem conter lógica específica de fornecedor**:

1. Processos genuinamente longos/assíncronos e multi-etapas onde uma Server Action síncrona não é viável — candidatos previstos: geração de vídeo (Asset Engine, produção via avatar/mídia licenciada), processamento de mídia, publicações em redes sociais (pós-MVP), automações longas, integrações externas e workflows agendados/recorrentes;
2. Retentativas, timeouts e tratamento de falha entre etapas;
3. Atualização de status das entidades no Supabase a cada etapa concluída (refletido na UI via Realtime).

Introduzir n8n é, portanto, uma decisão a tomar quando uma dessas necessidades aparecer de fato (provavelmente Asset Engine), não antes.

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
3. ~~**Índice de retrieval da Knowledge Base:** uso de `pgvector` no Supabase Postgres — confirmar.~~ **Resolvido (revisão 14):** o dono do produto confirmou adiar `pgvector`/embeddings. MVP da Knowledge Base usa retrieval por recência + `tags`/`source_type` (implementado e validado — §3.2). Nenhum provider de embedding integrado nesta missão; a coluna `embedding` permanece reservada em `knowledge_base_items` (nullable, schema já preparado) para quando a plataforma evoluir para busca híbrida (tags + embeddings + ranking semântico), sem quebrar a arquitetura existente.
4. **Fallback automático de provider:** troca automática para `fallback_provider_key` no mesmo request, ou apenas registro de falha para intervenção manual?
5. **Especialistas com modelos distintos (tier Premium):** vale a pena, em termos de custo/benefício, atribuir modelos diferentes a especialistas diferentes, ou todos usam o mesmo modelo do tier e a diversidade vem só dos prompts/papéis? O **mecanismo** para isso já existe (`provider_configs` por `specialist_id`, §5.1) — o que falta é a decisão de custo/benefício em si. (Relacionado à decisão de produto PRD §13.2.)
6. Provedor de banco de vídeos públicos licenciados e como ele se integra.
7. ~~**Seed inicial do Specialist Registry (§4.1):** implementado na Missão 3 [...] revisão do dono do produto sobre o conteúdo exato de cada `system_prompt` pendente.~~ **Resolvido (revisão 13):** os 4 `system_prompt`s (`marketing_strategy`, `branding`, `copywriting`, `coordinator`) passaram por validação qualitativa real (Supabase + Anthropic reais, múltiplos objetivos de campanha incluindo um caso desenhado para forçar divergência) e foram aprovados pelo dono do produto. Um problema de truncamento no prompt de Branding foi corrigido (migration `0005`). Documentação individual de cada especialista em [`docs/prompts/`](prompts/).
8. ~~**Trend Source Provider do MVP.**~~ **Resolvido (revisão 15):** busca web nativa da API da Anthropic, como adapter de `trend_source` atrás do Provider Gateway — ver §3.3.
9. ~~**n8n no Fluxo 2.**~~ **Resolvido (revisão 15):** Fluxo 2 é Server Action direta, sem n8n — ver §3.3 e §8.

> Estas decisões devem ser resolvidas e refletidas aqui antes da implementação dos módulos correspondentes.

## 11. Tool Registry (ferramentas plugáveis para especialistas) ★ evolução futura, não implementada

Registrado na revisão 13 como decisão de arquitetura para uma evolução futura da plataforma — **não implementar agora**, apenas documentar a direção para que ela não seja esquecida nem reinventada de forma inconsistente quando a necessidade surgir.

**Motivação:** hoje um especialista do Specialist Registry só sabe raciocinar sobre o contexto textual que recebe (Brand Brain + objetivo + opiniões de pares). Em algum momento, um especialista (ou o Coordinator) vai precisar **agir no mundo** durante seu raciocínio — por exemplo, buscar um dado externo, consultar uma API de terceiros, ou rodar um cálculo — não apenas opinar sobre o que já foi fornecido no prompt.

**Direção proposta:** um **Tool Registry**, análogo ao Provider Gateway (§5) e ao Specialist Registry (§4.1) — uma tabela de dados (ex.: `tools`) descrevendo cada ferramenta disponível (nome, objetivo, schema de entrada/saída, capability/endpoint por trás, quem pode usá-la), nunca uma ferramenta hardcoded no código do Intelligence Hub. Cada linha de `specialists` ganharia uma forma de declarar **quais ferramentas pode usar** (análogo a `applies_to` hoje declarar quais tipos de decisão o especialista cobre) — permitindo que o mesmo especialista rode com ou sem acesso a ferramentas dependendo de configuração, sem mudança de código.

**Por que isso é consistente com os outros dois registries:**
- Provider Gateway: resolve **quem executa** uma capacidade (qual fornecedor).
- Specialist Registry: resolve **quem participa** de uma decisão (qual especialista).
- Tool Registry (futuro): resolveria **o que um especialista pode fazer** além de raciocinar sobre texto (quais ferramentas invocar).

**Explicitamente fora de escopo agora:** nenhuma tabela, nenhum código, nenhuma integração com tool use da API da Anthropic. Esta seção existe só para registrar a arquitetura-alvo antes que a necessidade apareça organicamente numa missão futura (provavelmente Trend Engine ou Asset Engine, que são os candidatos mais óbvios a precisarem de ferramentas externas de verdade — busca de tendências, geração de mídia).
