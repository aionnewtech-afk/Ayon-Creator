# Changelog de Documentação — Ayon Creator

> Todo pedido de nova funcionalidade gera uma entrada aqui, junto com as atualizações correspondentes em PRD.md, architecture.md, database.md e flows.md. Nenhuma implementação é feita sem uma entrada aprovada aqui.

---

## v1.0 (revisão 6) — 2026-08-01 — Provisionamento Inicial de conta (bootstrap idempotente)

**Status:** aprovado (decisão tomada durante a implementação da Sprint 1)

**Motivação:** durante a implementação do cadastro/login, identificado que a confirmação de e-mail do Supabase Auth (mantida ativa, por decisão explícita) impede criar `organizations`/`organization_members`/`brands`/`user_profiles` no momento do `signUp` (não há sessão autenticada ainda). Decisão registrada antes de codar o Server Action, conforme regra de parar em decisões arquiteturais não documentadas.

**O que mudou:**
- `docs/architecture.md`: nova §2.2 — Provisionamento Inicial: serviço idempotente em `packages/core`, acionado no primeiro acesso autenticado (login por senha ou confirmação por link), não no `signUp`; gate de acesso via Error Boundary da `(platform)` em caso de falha; estruturado para reuso por futuros recursos de inicialização.
- `docs/flows.md`: Fluxo 1, passo 1, reescrito para refletir a nova sequência (cadastro só cria o usuário; provisionamento ocorre depois, no primeiro acesso).

**Fora de escopo desta revisão:** nenhuma tabela nova ou alterada — mesmo schema de `database.md` revisão 5.

**Próximo passo:** implementação do Server Action de cadastro/login e do serviço de provisionamento, seguindo esta decisão.

---

## v1.0 (revisão 5) — 2026-08-01 — Fundação técnica da Sprint 1 (monorepo, repository pattern, tabelas de plataforma)

**Status:** aguardando aprovação

**Motivação:** antes de iniciar a implementação de código da Sprint 1, sincronizar `architecture.md` e `database.md` com decisões técnicas estruturais já combinadas em conversa (monorepo, camada de repository, tabelas de plataforma) e com os requisitos formais de início de sprint. Sem mudança de escopo de produto — `PRD.md`, `docs/flows.md` e `docs/ux-design.md` permanecem inalterados.

**O que mudou:**
- `docs/architecture.md`:
  - Nova §2.1: estrutura de monorepo (`apps/web`, `packages/ui`, `packages/core`, `packages/types`, pnpm workspaces).
  - Resolve a decisão em aberto (antiga §10.1) sobre onde a lógica de negócio roda: **Next.js Server Actions + camada de Repository** (`packages/core`) — fluxo obrigatório `Tela → Server Action → Repository → Supabase`, nunca Supabase chamado direto de componente/página.
  - Nova §9.1: buckets de Supabase Storage (`brand-media`, `knowledge-base`, `content-output`).
  - Registradas convenções de plataforma transversais (ThemeProvider, Error Boundaries, logger, Estado Vazio padronizado), detalhadas em `CONVENTIONS.md`.
- `docs/database.md`:
  - `organizations` ganha `slug`.
  - `brands` passa a ter uma linha padrão criada automaticamente no cadastro (nome = nome da organização, `niche` nulo até o onboarding).
  - Novas tabelas de plataforma: `user_profiles` (§2.5), `audit_logs` e `feature_flags` (novo §9).
  - Convenção de colunas de auditoria (`created_by`, `updated_at`, `deleted_at`) aplicada a `organizations`, `organization_members`, `brands`, `user_profiles`; RLS correspondente descrito em §8.
  - Nova decisão em aberto (§10.6): override de `feature_flags` por organização, adiado até haver caso de uso real.
- `CONVENTIONS.md` (novo, raiz do repositório): monorepo, repository pattern, soft delete, colunas de auditoria, migrations, feature flags, commits, nomenclatura — guia de engenharia, fora do fluxo de aprovação de escopo de produto.

**Fora de escopo desta revisão:** qualquer mudança de PRD/fluxos/UX — nenhuma funcionalidade de produto foi adicionada, removida ou redesenhada.

**Próximo passo:** aprovação para iniciar a implementação de código da Sprint 1 (estrutura de projeto, Supabase, autenticação, layout base, sidebar, dashboard vazio).

---

## v1.0 (revisão 4) — 2026-08-01 — Especificação de UX (telas, componentes, estados, navegação, microinterações)

**Status:** aguardando aprovação

**Motivação:** antes de qualquer código, especificar toda a experiência de produto — telas, componentes, estados, navegação e microinterações — como um documento próprio, no mesmo padrão de aprovação dos demais (PRD, arquitetura, banco, fluxos).

**O que foi criado:**
- `docs/ux-design.md` (novo): 
  - Princípios de UX (linguagem de negócio sempre, Intelligence Hub como exceção deliberadamente comunicada, progresso sempre visível, aprovação humana sempre explícita).
  - Arquitetura de informação (sitemap, navegação primária/secundária, visibilidade por papel/plano).
  - Inventário de ~30 telas, organizadas por área (Autenticação, Conheça sua Empresa, Ensine sua Empresa para a IA, O que está em Alta, Criar Campanha, Campanhas, Biblioteca de Mídia, O que Funcionou, Configurações, Globais).
  - Especificação de componentes, com destaque para o **Painel de Especialistas** (visualização do Intelligence Hub) como componente-assinatura do produto.
  - Matriz de estados globais (vazio, carregando, processando com IA, erro total/parcial, créditos insuficientes, permissão insuficiente, aguardando aprovação humana).
  - Catálogo de microinterações-chave.
  - 6 jornadas de navegação ponta a ponta (primeiro acesso, criar campanha, ensinar a IA, aceitar sugestão, convidar time, retomar campanha incompleta).
  - Notas de responsividade e acessibilidade.
  - Decisões em aberto de UX (campanha por tema livre, atalhos de teclado, sistema visual — deliberadamente fora deste documento —, notificações por e-mail, retry em erro parcial, localização).
- `README.md` atualizado: `docs/ux-design.md` incluído na estrutura, na ordem de atualização obrigatória e na leitura recomendada.

**Fora de escopo desta revisão:** sistema visual (paleta de cores, tipografia, tokens, logotipo) — fica para uma fase seguinte, após aprovação da especificação de UX.

**Decisões pendentes de aprovação:** ver `docs/ux-design.md` §10.

**Próximo passo:** revisão do usuário/dono do produto. Nenhum código será escrito até aprovação explícita.

---

## v1.0 (revisão 3) — 2026-08-01 — Filosofia de produto, Intelligence Hub e escopo de MVP sem publicação automática

**Status:** aguardando aprovação

**Motivação:** reposicionar a Ayon Creator de "gerador de conteúdo" para "Sistema Operacional de Marketing orientado por IA", introduzir um mecanismo que evita dependência de um único LLM em decisões importantes, garantir que o usuário nunca veja jargão técnico nem escolha fornecedor, e reduzir o MVP a entrega de pacote de conteúdo para download (sem publicação automática).

**O que mudou:**
- **Filosofia/posicionamento:** `PRD.md` §1 reescrito — produto não é gerador de conteúdo, é Sistema Operacional de Marketing.
- **Camada de linguagem (`PRD.md` §2, novo):** tabela formal mapeando cada Core Engine interno (Brand Brain, Knowledge Base, Trend Engine, Asset Engine, Learning Engine) ao nome exposto ao usuário ("Conheça sua empresa", "Ensine sua empresa para a IA", "O que está em alta", "Criar campanha", "O que funcionou"). Nenhum nome técnico deve aparecer na UI.
- **Intelligence Hub (novo Core Engine):** painel de 7 especialistas de IA (Marketing, Copy, Branding, Nicho, SEO, Redes Sociais, Dados) + Coordinator AI que consolida em uma estratégia única. Toda decisão estratégica importante passa por aqui — nenhuma depende de um único LLM. Documentado em `architecture.md` §4, novas tabelas `intelligence_hub_sessions`/`specialist_opinions` em `database.md` §4.4, novo **Fluxo 10** em `flows.md`.
- **Brand Evolution (renomeação de produto para o Learning Engine):** exposto como "O que funcionou". Regra reforçada e tornada **definitiva e sem exceção por plano**: nenhuma sugestão de aprendizado é aplicada automaticamente, sempre requer aprovação humana explícita — inclusive no plano Business.
- **Onboarding conversacional:** substituído formulário por entrevista guiada por IA ("Conheça sua empresa"), cobrindo história, produtos, clientes, tom de voz, concorrentes, objetivos, diferenciais, palavras proibidas e favoritas. Nova tabela `brand_onboarding_answers`; `brand_brain_profiles` ganhou os campos estruturados correspondentes.
- **Providers por tier, não por escolha do cliente:** cliente escolhe apenas Econômico/Balanceado/Premium; `provider_configs` passou a resolver por `(capability, tier)` em vez de configuração direta de fornecedor por organização/marca. Mapeamento tier→fornecedor é 100% interno/administrativo.
- **MVP sem publicação automática:** removida do MVP a publicação automática em redes sociais, mesmo no plano Business. O MVP entrega um **Pacote de Conteúdo** para download (`content_packages`, novo) com: vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro e teleprompter. `content_pieces.format` expandido de `(video,image,text)` para os 9 formatos do pacote. `publishing_channels`/`publications` mantidas no modelo apenas como referência de arquitetura futura (Fluxo 5-B, explicitamente fora do MVP).
- `README.md` atualizado com a nova descrição de produto e o princípio de linguagem.

**Decisões pendentes de aprovação:** ver PRD.md §13, architecture.md §10, database.md §9, flows.md (seção final).

**Próximo passo:** revisão do usuário/dono do produto. Nenhum código será escrito até aprovação explícita.

---

## v1.0 (revisão 2) — 2026-08-01 — Arquitetura modular e independência de fornecedor

**Status:** aguardando aprovação

**Motivação:** antes de fechar a v1.0, o produto precisa ser modular e não acoplado a fornecedores específicos de IA/mídia, para permitir substituir qualquer um deles (OpenAI, Claude, HeyGen, ElevenLabs, provedor de mídia) sem alterar a lógica principal do sistema.

**O que mudou:**
- Introduzidos os **Core Engines**: Brand Brain, Knowledge Base, Trend Engine, Asset Engine, Learning Engine — concentram toda a lógica de produto, sem conhecer fornecedores.
- Introduzida a **Provider Layer**: LLM Provider, Avatar Provider, Voice Provider, Media Provider, Trend Source Provider — adapters plugáveis com contrato fixo por capacidade, resolvidos via Provider Gateway/`provider_configs`.
- `PRD.md`: nova seção §3.2 (princípio de modularidade), diferenciais atualizados, stack reclassificada em fundação vs. fornecedor inicial (substituível), escopo do MVP atualizado com os novos módulos, glossário expandido, novas decisões em aberto (§12.7–§12.9).
- `docs/architecture.md`: reescrito com diagrama em camadas (Core Engines + Provider Layer + n8n só orquestrando, sem lógica de fornecedor), tabela de contratos por tipo de provider, papel revisado do n8n, novas decisões em aberto.
- `docs/database.md`: `brand_kits` renomeada/expandida para `brand_brain_profiles` (+ `learned_preferences`); novas tabelas `knowledge_base_items`, `provider_configs`, `learning_signals`, `learning_insights`; `content_versions.generation_metadata` passa a registrar `*_provider_key` usado em cada geração; `trend_research` ganha `provider_key`.
- `docs/flows.md`: todos os fluxos reescritos para referenciar Core Engines/Provider Layer em vez de fornecedores nomeados; **Fluxo 8 (Aprendizado Contínuo)** e **Fluxo 9 (Troca de Provedor)** adicionados.

**Decisões pendentes de aprovação** (bloqueiam início de implementação dos respectivos módulos):
- Ver PRD.md §12, architecture.md §7, database.md §8, flows.md (seção final) para a lista completa e atualizada por documento.

**Próximo passo:** revisão do usuário/dono do produto. Nenhum código será escrito até aprovação explícita.

---

## v1.0 — 2026-08-01 — Criação inicial da documentação

**Status:** aguardando aprovação

**O que foi criado:**
- `PRD.md`: visão de produto, problema, solução, ICP, personas, modelo de negócio, escopo do MVP, stack, métricas, glossário.
- `docs/architecture.md`: arquitetura de referência (Next.js + Supabase + n8n + OpenAI/Claude + HeyGen/ElevenLabs), multi-tenancy, segurança, processamento assíncrono.
- `docs/database.md`: modelo de dados inicial (organizations, brands, campaigns, content_pieces, créditos/billing etc.).
- `docs/flows.md`: 7 fluxos principais (onboarding, pesquisa de tendência → campanha, geração de conteúdo por modo de produção, aprovação, publicação, créditos, gestão de marcas/times).

**Decisões pendentes de aprovação** (bloqueiam início de implementação dos respectivos módulos):
- Ver PRD.md §12, architecture.md §6, database.md §5, flows.md (seção final) para a lista completa por documento.

**Próximo passo:** revisão do usuário/dono do produto. Nenhum código será escrito até aprovação explícita deste conjunto de documentos (ou da parte específica que for aprovada primeiro).
