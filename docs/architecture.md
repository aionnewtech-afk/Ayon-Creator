# Arquitetura — Ayon Creator

> **Status:** v1.0 (revisão 31 — Missão 10 aprovada, escopo ajustado)
> **Mudança desta revisão (31 — Missão 10 aprovada, escopo ajustado):** dono do produto aprovou e pediu 2 ajustes: categoria `other` (§13.1) e captura automática de contexto — `pathname` (client), `userAgent` (servidor, via `headers()`, nunca confiado do client), `app_version` (servidor, de `package.json`) — nova §13.1.1. Achado durante o ajuste: `package.json` do monorepo nunca foi sincronizado com as tags de release, parado em `0.1.0` desde sempre — corrigido para `0.10.2`, e bumpar `package.json` passa a fazer parte do fechamento de toda missão a partir daqui (§13.1.2). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (30 — preparação Missão 10):** nova §13 — Feedback do Usuário, utilitário transversal (não Core Engine, não Provider Layer) para captura de sugestões/bugs/dificuldades de uso via botão global + modal simples, gravando em `user_feedback`. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (29 — n8n provisionado, Fluxo 13 completo):** n8n provisionado como instância própria e isolada do Ayon Creator (Docker, `n8n/docker-compose.yml` — nunca compartilhada com outros projetos, achado de auditoria antes de provisionar: já existia um n8n rodando localmente, mas de outro projeto do dono do produto). Workflow real criado e ativado (`n8n/README.md` documenta a estrutura completa). §8 ganha precisão: "n8n chamando o Provider Gateway a cada etapa" (revisão 25) significa, na implementação real, **n8n chama as rotas HTTP internas do Fluxo 13** (`/api/pipeline/video/narrate|scenes|render`), que por sua vez usam o Provider Gateway — o n8n em si nunca importa nem conhece o Provider Gateway diretamente (não poderia, é um sistema externo). Fluxo 13 validado de ponta a ponta em ambiente real (ElevenLabs + Pexels + Shotstack + Supabase + n8n reais, nenhum mock) — vídeo MP4 gerado automaticamente, `pipeline_runs`/`content_pieces`/`content_versions` corretos, crédito debitado uma única vez. Um bug real encontrado e corrigido durante a integração (headers errados no nó de consulta ao Supabase) — ver [docs/changelog.md](changelog.md) para o relato completo. **Missão 9, Etapa 1, encerrada.**
> **Mudança desta revisão (28 — providers validados com dados reais):** ElevenLabs, Pexels e Shotstack implementados e validados com chamadas reais (contas do dono do produto) — nenhum bug de adapter encontrado. §12.4 ganha uma tabela de latência/custo medidos, insumo para a decisão em aberto de precificação de `video_generation` (PRD §13, item 11, continua aberta — os dados são insumo, não a decisão em si). Ver [docs/changelog.md](changelog.md) para o relato completo, incluindo dois achados de API que teriam causado bugs se não verificados antes de codar (endpoint correto do Pexels e valor `"done"` — não `"completed"` — do status do Shotstack).
> **Mudança desta revisão (27 — Missão 9 dividida em 2 etapas):** decisão do dono do produto — reduzir risco de retrabalho, mesma disciplina de "uma fatia vertical por vez" de todas as missões anteriores. **Etapa 1** (§3.5.1 reescrita): só `licensed_stock_video` implementado — pipeline completo roteiro → narração (ElevenLabs) → cenas (Pexels) → composição (Shotstack) → MP4, de ponta a ponta, sem depender de avatar. **Etapa 2** (futura, recurso Premium): `ai_avatar` (HeyGen) e `hybrid` (que depende de avatar) — contrato `avatar` (§5) permanece documentado e a Provider Layer permanece desenhada para acomodá-lo sem mudança estrutural quando a Etapa 2 chegar, mas nenhuma linha de código de avatar é escrita na Etapa 1. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (26 — fornecedores concretos definidos):** dono do produto aprovou a revisão 25 e fechou os fornecedores do MVP (§5): Voice Provider = **ElevenLabs**, Avatar Provider = **HeyGen**, Media Provider = **Pexels**, Video Render Provider = **Shotstack**. §3.5.1 atualizada — o mecanismo de legenda deixa de ser decisão em aberto: ElevenLabs retorna marcação de tempo por caractere junto do áudio, usada diretamente para `captionCues` (o fallback por estimativa de proporção de caracteres passa a caminho defensivo, não o principal). §10, item 12, marcado como resolvido para fornecedor/legenda — a regra de segmentação do modo `hybrid` permanece em aberto (não bloqueante). Confirmado: `pipeline_runs.status` já tinha `queued → running → completed`/`failed` desde a definição original da tabela (§4.8 de [database.md](database.md#48-pipeline_runs)) — nenhuma mudança de schema necessária para o pedido do dono do produto de um estado `queued` antes de `running`. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (25 — preparação Missão 9):** §3.5 (Asset Engine) ganha o pipeline de geração automática de vídeo para o formato `video` (vertical 9:16): narração via **Voice Provider**, cenas via **Avatar Provider** (`ai_avatar`) e/ou **Media Provider** (`licensed_stock_video`, banco de vídeo licenciado — modo `hybrid` combina os dois), legendas, e composição final via uma capacidade inteiramente nova da Provider Layer, **Video Render Provider** (`video_render` — §5), que nunca conhece fornecedor de mídia/avatar/voz, só recebe áudio + fontes de vídeo + cues de legenda e devolve um MP4. Decisão do dono do produto: avatar **não é obrigatório** — os três modos (`ai_avatar`, `licensed_stock_video`, `hybrid`) são igualmente válidos, resolvidos pela estratégia da campanha, não por uma capacidade sempre presente. **n8n ativado oficialmente pela primeira vez** (§8 reescrita) — orquestra o pipeline assíncrono de geração de vídeo, porque a soma de latências (voz + avatar/mídia + renderização externa) excede qualquer teto razoável de Server Action síncrona; resolve também a decisão em aberto §10, item 2 ("composição de vídeos híbridos: n8n ou dentro do Asset Engine?"). Billing (§12.4) ganha `trigger_reason` próprio (`video_generation`), separado de `asset_generation`, com valores em aberto (PRD §13, item 11) e cobrança só após sucesso do pipeline assíncrono (via webhook, não mais dentro da mesma Server Action — §12.3 atualizada). Fornecedores concretos de Avatar/Voice/Media/Video Render Provider e o mecanismo exato de legenda permanecem decisões em aberto (§10, itens 2/6 atualizados + novo item 12) — bloqueiam o início do código desta missão, não a aprovação da documentação. Nome interno do Core Engine **mantido como "Asset Engine"** — decisão explícita do dono do produto, não um rebranding para "Multimedia Engine" apesar do objetivo da missão ser descrito assim. Ver [docs/changelog.md](changelog.md) para o relato completo da auditoria que precedeu esta revisão.
> **Mudança desta revisão (24 — Missão 8 implementada e validada):** Learning Engine (§3.6) implementado e validado com Supabase + Anthropic reais — `runLearningAnalysis` aciona o Intelligence Hub como mais um tipo de decisão (`learning_analysis`, painel Marketing + Branding, Coordinator generalizado), gera até 5 `learning_insights` a partir dos `learning_signals` acumulados, gratuito, sob demanda. Aceitar um insight grava em `brand_brain_profiles.learned_preferences` — confirmado em produção que isso realmente muda o comportamento de gerações futuras: uma nova sessão de `campaign_strategy` para a mesma marca, depois de um insight aceito, trouxe os três especialistas citando explicitamente o aprendizado aplicado na resposta. Achado real durante a implementação (não decisão de produto, mas contradição de schema): `intelligence_hub_sessions.related_entity_type` era `not null` com CHECK restrito a `('trend_research', 'campaign', 'content_piece')` — `learning_analysis` não tem uma entidade única desse tipo (é análise em nível de marca). Resolvido de forma aditiva: `'brand'` adicionado ao CHECK (migration `0012`), `related_entity_id = brand_id`, mantendo a mesma trilha de auditoria (`specialist_opinions`) de `campaign_strategy`/`trend_ranking`, sem exceção arquitetural para o Learning Engine. Segundo achado: `brand_brain_profiles.learned_preferences` nunca era lido por nenhum engine — corrigido estendendo `buildBrandContextBlock` com um parâmetro opcional, agora passado por `campaign_strategy`, `trend_ranking`, `asset_generation` e `learning_analysis`. Ver [docs/changelog.md](changelog.md) para o relato completo da validação.
> **Mudança desta revisão (23 — preparação Missão 8, Learning Engine):** §3.6 ganha o escopo do MVP aprovado pelo dono do produto — geração de insights via Intelligence Hub (novo tipo de decisão `learning_analysis`, painel Marketing + Branding), gratuito em todos os planos, síncrono sob demanda com mínimo de 5 `learning_signals` acumulados, escopo de sinais limitado a `approved`/`rejected`/`edited` (sem `engagement_metric` ainda). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (22 — correção de auditoria):** §3.6 corrigida — link para `database.md` apontava para a âncora errada (`#46-...`, seção 4.6, em vez de `#47-...`, seção 4.7, onde `learning_signals`/`learning_insights` de fato estão documentadas). Achado em auditoria de rotina antes da Missão 8.
> **Mudança desta revisão (21 — Missão 7 implementada e validada):** Asset Engine (§3.5) implementado e validado com Supabase + Anthropic reais — `generateTextPiece` (5 formatos textuais via LLM Provider, Zod `{content, rationale}`), `initializeCampaignContentPieces` (9 `content_pieces` por campanha, `script` como peça principal reutilizando a sessão do Intelligence Hub da estratégia), upload manual para os 4 formatos `own_media` direto no bucket `content-output` (sem depender de `brand_media_assets`, como já decidido), `buildContentPackage` (JSZip, montagem automática do pacote assim que a última peça é aprovada — sem passo manual separado, sem Realtime). Um bug real encontrado e corrigido na validação: `buildContentPackage` nomeava os arquivos `own_media` dentro do zip com o prefixo `{contentPieceId}-` (herdado do caminho de storage usado para evitar colisão), em vez do nome original enviado pelo cliente — corrigido para remover o prefixo antes de adicionar ao zip. Ver [docs/changelog.md](changelog.md) para o relato completo da validação.
> **Mudança desta revisão (20 — preparação Missão 7, Asset Engine):** §3.5 ganha o escopo do MVP aprovado pelo dono do produto: `production_mode` limitado a `text_only`/`own_media` (sem Avatar/Voice/Media Provider agora), formatos visuais preenchidos por upload direto do cliente (sem depender de `brand_media_assets`/Biblioteca de Mídia, ainda não implementada), execução síncrona sem n8n, sem Supabase Realtime — mesmo padrão de todas as missões anteriores. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (19 — Missão 6 implementada e validada):** Billing (§12) implementado e validado com Supabase + Mercado Pago reais (sandbox) — assinatura via Preapproval, compra de créditos via Checkout Pro, portão de crédito bloqueando antes de qualquer chamada de IA, idempotência de webhook confirmada contra o constraint real do Postgres. Nova tabela `plans` (não prevista na preparação — achado durante a implementação, ver [database.md §7.5](database.md#75-plans-★-novo-missão-6-achado-durante-a-implementação)). Um bug real encontrado e corrigido: `organizations.provider_tier` nunca era sincronizado com o plano ativo (§12.1). Ver [docs/changelog.md](changelog.md) para o relato completo da validação.
> **Mudança desta revisão (18 — preparação Missão 6, Billing):** nova §12 — módulo de Billing dedicado (não Provider Layer, não Core Engine), integração com Mercado Pago (Preapproval para assinaturas, Checkout Pro para créditos avulsos), portão de crédito obrigatório antes de qualquer sessão do Intelligence Hub, idempotência de webhook via `credit_ledger.external_payment_id` único. Preço em créditos concentrado no Asset Engine futuro, não no Intelligence Hub (decisão de produto explícita). Planos com números concretos (§12.5), resolvendo PRD §13 item 5. Novos itens 10-11 em §10. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (17 — Missão 5 implementada e validada):** Trend Engine (§3.3) implementado e validado com Supabase + Anthropic reais — adapter `AnthropicWebSearchTrendSourceProvider` (busca web nativa, `web_search_20250305`), `TrendResearchRepository`, painel de especialistas (Marketing + Branding, ampliados via `applies_to`) + Coordinator generalizado, telas TREND-1/TREND-2, handoff para "Criar Campanha" com tema pré-preenchido. Ver [docs/changelog.md](changelog.md) para o relato completo da validação, incluindo dois bugs encontrados e corrigidos (formato de saída do Coordinator não declarado nas mensagens de usuário; sessão do Intelligence Hub não marcada como `failed` quando a descoberta falhava depois de criada).
> **Mudança desta revisão (16 — achado durante a implementação da Missão 5):** §4.1 (Specialist Registry) ganha nota sobre o Coordinator — encontrado durante a implementação que seu `system_prompt` (Missão 3) fixava um formato de saída JSON específico de `campaign_strategy`, incompatível com o único Coordinator global também precisar atender `trend_ranking`. **Parado e reportado ao dono do produto antes de qualquer mudança** (regra explícita da Missão 5); aprovada a generalização: comportamento do Coordinator idêntico, formato de saída passa a ser definido pela tarefa que o invoca, nunca mais fixo no `system_prompt`. Um único Coordinator no registry, sem mudança de schema (migration `0007_coordinator_decision_agnostic.sql`). Ver [docs/prompts/coordinator.md](prompts/coordinator.md) e [docs/changelog.md](changelog.md).
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
- **Armazenamento:** `content_pieces`, `content_versions`, `content_packages` (ver [database.md](database.md#46-content_pieces--content_versions--content_packages)).

**Escopo da Missão 7 (MVP do Asset Engine) — decisão do dono do produto, auditoria pré-Missão 7:**

- **`production_mode` cobertos: `text_only` e `own_media`.** `ai_avatar`, `licensed_stock_video` e `hybrid` permanecem documentados (§3.2 abaixo, [flows.md Fluxo 3](flows.md#fluxo-3--criar-campanha-geração-do-pacote-de-conteúdo-asset-engine)) mas **fora do escopo desta missão** — não exigem nenhum Provider Layer novo agora. Zero fornecedor novo (sem HeyGen, sem ElevenLabs, sem Media Provider de vídeo licenciado) — mesmo padrão de todas as missões anteriores, uma fatia vertical validada por vez.
- **Formatos textuais** (`caption`, `blog_post`, `email`, `script`, `teleprompter`) — gerados pelo LLM Provider já existente, sem capability nova.
- **Formatos visuais** (`video`, `stories`, `carousel`, `thumbnail`) — no MVP, o cliente **anexa o próprio arquivo** diretamente na revisão da peça (upload simples para `content_versions.output_storage_path`, bucket `content-output` já existente desde a Sprint 1). **Decisão explícita: não depende de `brand_media_assets`/Biblioteca de Mídia** (nav item separado, ainda não implementado) — evita acoplar a Missão 7 a uma funcionalidade que não existe. Se/quando a Biblioteca de Mídia for implementada, o upload por peça pode evoluir para selecionar de uma biblioteca já organizada, sem mudança de arquitetura.
- **Execução: Server Action síncrona, sem n8n.** Mesmo padrão das 6 missões anteriores — geração de texto (5 formatos) é rápida o suficiente para não precisar de processamento assíncrono. n8n permanece adiado (§8) até um modo de produção genuinamente demorado (vídeo com avatar, por exemplo) exigir de fato.
- **Sem Supabase Realtime.** UI reflete o resultado direto da Server Action (padrão de toda missão até aqui), não uma assinatura de canal Realtime — [flows.md Fluxo 3, passo 4](flows.md#33-conclusão-e-montagem-do-pacote-de-conteúdo) ajustado de acordo.

### 3.5.1 Geração automática de vídeo ★ novo (preparação Missão 9)

**Escopo dividido em 2 etapas (decisão do dono do produto, revisão 27 — reduzir risco de retrabalho, mesma disciplina de "uma fatia vertical por vez" de todas as missões anteriores):**

- **Etapa 1 (implementação imediata):** só `production_mode = licensed_stock_video`. `ai_avatar` e `hybrid` **não são implementados nesta etapa** — o pipeline completo (passos 1–5 abaixo) só precisa cobrir narração + banco de vídeo licenciado + composição, nunca avatar.
- **Etapa 2 (futura, recurso Premium):** `ai_avatar` e `hybrid` (que depende de avatar). Quando implementado, avatar de IA é exclusivo do tier Premium — decisão de produto, não só adiamento técnico. O contrato `avatar` (§5) já está especificado desde já para que a Etapa 2 seja só um novo adapter + habilitar o `production_mode` no Asset Engine, sem redesenho.
- `stories`/`carousel`/`thumbnail` continuam `own_media` (upload manual) em ambas as etapas, fora de escopo.

**Pipeline (substitui, só para o formato `video`, o caminho síncrono direto de texto do §3.2) — Etapa 1:**

1. **Roteiro/copy:** sem mudança — vem do `consolidated_result` da sessão do Intelligence Hub da campanha (peça principal, Fluxo 3.1), como já acontece hoje para `script`.
2. **Narração (Voice Provider = ElevenLabs ★ definido):** `synthesizeVoice(script, brandVoiceConfig) → { audioUrl, durationMs, captionCues }`. Áudio gravado no bucket `content-output`. A API do ElevenLabs retorna marcação de tempo por caractere junto do áudio sintetizado — usada diretamente para montar `captionCues`, sem depender de nenhuma capacidade de transcrição separada. O fallback determinístico (estimativa de tempo por proporção de caracteres dentro de `durationMs`) permanece como caminho defensivo, para o caso de a resposta do fornecedor vir sem a marcação por algum motivo pontual — nunca o caminho principal.
3. **Cenas (Media Provider = Pexels ★ definido):** `searchMedia(keywords, filtros) → candidatos` + `fetchMedia(id) → clipUrl`, um ou mais clipes por trecho do roteiro (critério de seleção: palavras-chave extraídas de cada trecho correspondente a um `captionCue`). Único caminho de "cenas" implementado na Etapa 1 — sem branch de `ai_avatar`/`hybrid` no código desta etapa.
4. **Composição final (Video Render Provider = Shotstack ★ definido — capacidade nova, §5):** `composeVideo({ audioUrl, videoSources, captionCues, aspectRatio: "9:16" }) → { videoUrl }` — único ponto que efetivamente produz o MP4 final (cenas + narração + legenda). O Asset Engine nunca compõe vídeo diretamente; sempre delega a este contrato.
5. **Persistência:** vídeo final baixado do fornecedor e gravado no bucket `content-output`; nova `content_versions` criada (mesmo padrão de hoje); `content_pieces.status = ready_for_review`. `generation_metadata` passa a incluir também `video_render_provider_key`/`media_provider_key`.

**Etapa 2 (futura, quando aprovada):** passo 3 ganha um branch `ai_avatar` (`generateAvatarVideo(script, avatarConfig, audioUrl) → videoUrl`, retorna já um vídeo com avatar + narração embutida) e um branch `hybrid` que combina os dois — a regra de segmentação de quais trechos do roteiro usam avatar vs. banco de vídeo (§10, item 12) é decisão a fechar nessa etapa, não agora.

**Execução: assíncrona via n8n (★ primeira ativação real — §8).** A soma de latências (síntese de voz + geração de avatar ou busca de mídia + renderização externa) não cabe em uma Server Action síncrona. A Server Action que dispara a geração da peça de vídeo apenas: (a) verifica o portão de crédito (`ensureSufficientCredits`, mesmo princípio de sempre — §12.3), (b) marca `content_pieces.status = generating` e cria uma linha em `pipeline_runs` (`engine = 'asset_engine'`, `entity_type = 'content_piece'`, já documentada desde revisões antigas do schema, nunca usada de fato até esta missão), (c) dispara o workflow do n8n via webhook autenticado (mesmo padrão de segredo compartilhado de §9.1), devolvendo controle à UI imediatamente. O n8n sequencia os passos 2–5 acima chamando o Provider Gateway a cada etapa (nunca lógica de fornecedor dentro do próprio n8n — mesmo princípio de sempre, §8), e ao concluir chama de volta um webhook autenticado da aplicação (`apps/web/app/api/webhooks/n8n/route.ts`, novo) que atualiza `pipeline_runs`/`content_pieces`/`content_versions` e só então registra o consumo de crédito (`recordConsumption`, cobrança só após sucesso — mesmo princípio do Fluxo 6, mudando apenas o ponto de código que a dispara: o webhook, não mais a Server Action original).

**UI passa a depender de status assíncrono** (Supabase Realtime ou polling — a decidir na fase de UX, [ux-design.md](ux-design.md)) para refletir o progresso da geração de vídeo — primeira vez que o produto precisa disso de fato, revertendo a decisão repetida em todas as missões anteriores ("sem Realtime no MVP"), só para este caminho especificamente. Formatos textuais e `own_media` continuam 100% síncronos, sem mudança.

**Fornecedores e mecanismo de legenda resolvidos:** Voice = ElevenLabs, Media = Pexels, Video Render = Shotstack (§5) — os 3 fornecedores da Etapa 1; legenda vem da marcação de tempo por caractere que o ElevenLabs já retorna (passo 2 acima). Avatar = HeyGen já está definido para a Etapa 2, sem implementação nesta etapa. Único item ainda em aberto (fica para a Etapa 2, não bloqueia a Etapa 1): regra de segmentação do modo `hybrid` (§10, item 12). Ver [database.md §4.6](database.md#46-content_pieces--content_versions--content_packages) e [§4.8](database.md#48-pipeline_runs) para o detalhamento de schema correspondente.

### 3.6 Learning Engine (produto: Brand Evolution)

Loop de aprendizado contínuo por marca, exposto ao usuário como **"O que funcionou"**.

- **Responsabilidade:** capturar sinais (aprovação, rejeição e edição manual de peças de conteúdo — Fluxo 4) e, sob demanda, transformá-los em `learning_insights` (sugestões candidatas em linguagem simples, ex: "vídeos de até 35 segundos performam melhor").
- **Regra inegociável:** o Learning Engine **nunca aplica um ajuste automaticamente**. Todo `learning_insight` é apresentado ao usuário como uma pergunta explícita ("Deseja atualizar sua estratégia?") e só é aplicado ao Brand Brain/Trend Engine/Intelligence Hub/Asset Engine mediante aceite humano — isso vale para **todos os planos**, incluindo Business (não é uma feature paga de "automação total").
- **Escopo de sinais do MVP (aprovado pelo dono do produto, preparação Missão 8):** só `signal_type` em (`approved`, `rejected`, `edited`), emitidos pelas Server Actions já existentes de revisão de peça (Missão 7 — `criar-campanha/asset-actions.ts`). `engagement_metric` (métricas de engajamento pós-publicação manual) permanece fora do MVP — não existe ainda um mecanismo de captura definido para o usuário registrar onde/quando publicou cada peça (ver [flows.md, Fluxo 5, passo 4](flows.md#fluxo-5--entrega-do-pacote-de-conteúdo-mvp)); decisão adiada para uma missão futura, mesma disciplina de "uma fatia vertical por vez" das missões anteriores.
- **Mecanismo de geração dos insights (aprovado):** roda através do **Intelligence Hub**, não como chamada direta e isolada ao LLM Provider — novo tipo de decisão `learning_analysis`, reaproveitando o Coordinator generalizado (Missão 5, migration `0007`, que já antecipava exatamente este reuso — ver [docs/prompts/coordinator.md](prompts/coordinator.md)) e o painel de especialistas Marketing + Branding (`applies_to` estendido por `UPDATE`, mesmo padrão usado para habilitar `trend_ranking` na migration `0006` — sem mudança de schema no Specialist Registry). Copywriting não participa (o produto desta análise é um insight de padrão, não uma peça de comunicação).
- **Gatilho e cadência (aprovado):** **síncrono, sob demanda** — o usuário aciona a análise (ex: ao abrir "O que Funcionou" com sinais novos desde a última rodada, ou por uma ação explícita "buscar novidades"), a Server Action agrega os `learning_signals` ainda não usados numa análise anterior e chama o Intelligence Hub ali mesmo. Mesmo padrão síncrono sem n8n/cron de toda missão até aqui — nenhuma infraestrutura de agendamento existe no repositório. **Mínimo de 5 `learning_signals` não utilizados** antes de qualquer tentativa de análise, para não gerar uma sugestão fraca a partir de 1-2 eventos (resolve [PRD.md §13, item 3](../PRD.md#13-decisões-em-aberto-precisam-de-aprovação-antes-de-virar-escopo)).
- **Cobrança em créditos (aprovado):** **gratuito, em todos os planos** — sem `trigger_reason` novo em `credit_pricing`. Mesma filosofia de "não é uma feature paga de automação total" já registrada acima: a análise não gera um ativo monetizável novo, é leitura de dados que o cliente já pagou para gerar (peças de conteúdo do Asset Engine); a cadência é controlada pelo limite mínimo de sinais, não pelo saldo de créditos.
- **Armazenamento:** `learning_signals`, `learning_insights` (ver [database.md §4.7](database.md#47-learning_signals--learning_insights)).

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

**Coordinator é único e independente de tipo de decisão (★ Missão 5, migration `0007`):** ao contrário dos especialistas (`applies_to`-filtrados por tipo de decisão), existe **um único registro** com `role = coordinator` no Registry, reaproveitado por qualquer tipo de decisão (`campaign_strategy`, `trend_ranking`, e futuras). Até a Missão 5, seu `system_prompt` fixava o formato de saída JSON no próprio prompt — específico de estratégia de campanha, incompatível com o ranqueamento de tendências. Generalizado: o comportamento do Coordinator (nunca faz média, reconhece divergência real, ancora no Brand Brain) permanece o mesmo — só o formato de saída fixo foi removido do `system_prompt`. O JSON exato esperado agora é declarado pela tarefa que invoca o Coordinator, via instrução explícita na mensagem do usuário montada por cada Engine chamador (`buildCoordinatorUserMessage` para `campaign_strategy`, `buildTrendRankingCoordinatorMessage` para `trend_ranking`). Documentado em [docs/prompts/coordinator.md](prompts/coordinator.md).

> Detalhamento de schema em [database.md §4.4](database.md#44-intelligence_hub_sessions--specialist_opinions--specialists).

## 5. Provider Layer (adapters plugáveis, resolvidos por Tier)

Cada tipo de provider tem um **contrato fixo**. Novos fornecedores só precisam satisfazer o contrato.

| Provider | Capacidade | Contrato (entrada → saída) | Implementação inicial |
|---|---|---|---|
| **LLM Provider** | `llm` | `generateText(prompt, contexto) → texto/estrutura` | OpenAI e/ou Claude |
| **Avatar Provider** | `avatar` | `generateAvatarVideo(script, configAvatar, áudio?) → vídeo` | **HeyGen** ★ fornecedor definido — implementação adiada para a **Etapa 2 da Missão 9** (recurso Premium, revisão 27); contrato já especificado, zero código nesta etapa |
| **Voice Provider** | `voice` | `synthesizeVoice(script, configVoz) → áudio` | **ElevenLabs** ★ definido (Missão 9) — retorna marcação de tempo por caractere junto do áudio, usada para `captionCues` (§3.5.1); idem, documentado desde a revisão 3, nunca implementado até agora |
| **Media Provider** | `media` | `searchMedia(query, filtros) → candidatos`, `fetchMedia(id) → mídia` | **Pexels** ★ definido (Missão 9) — banco de vídeo licenciado, API gratuita para uso comercial (PRD §13.6) |
| **Video Render Provider** ★ novo (Missão 9) | `video_render` | `composeVideo({audioUrl, videoSources, captionCues, aspectRatio}) → vídeo` | **Shotstack** ★ definido — composição de vídeo via API, timeline em JSON, suporta 9:16 e burn-in de legenda (PRD §13.10). Nunca conhece fornecedor de mídia/avatar/voz — só recebe as fontes já resolvidas pelo Asset Engine e devolve o MP4 final. |
| **Trend Source Provider** | `trend_source` | `findCandidates(nicho, nomeDaMarca) → candidatos de tendência` | Anthropic (busca web nativa, `web_search_20250305`) — implementado e validado na Missão 5 |

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

**★ Ativado oficialmente nesta revisão (25, preparação Missão 9)** — até a revisão 24, nenhuma missão entregue (2 a 8) precisou de n8n de fato; todas usaram Server Action direta (ver §6, §3.2, §3.3), inclusive processos que a v1.0 original previa para o n8n, como a sessão do Intelligence Hub e a descoberta de tendências. Essa disciplina de "não adicionar infraestrutura antes dela gerar valor real" segue válida — o que muda agora é que o valor real apareceu: a geração automática de vídeo (§3.5.1) é o primeiro processo do produto cuja soma de latências (síntese de voz + avatar/busca de mídia + renderização externa) genuinamente não cabe numa Server Action síncrona.

**Papel do n8n a partir desta revisão — sequenciar chamadas aos Core Engines e ao Provider Gateway, sem conter lógica específica de fornecedor** (princípio inalterado desde a revisão 1):

1. **Pipeline de geração de vídeo (§3.5.1, primeiro uso real):** recebido via webhook autenticado disparado pela Server Action, o workflow chama o Provider Gateway em sequência (Voice Provider → Avatar/Media Provider, conforme `production_mode` → Video Render Provider), sem nunca importar SDK de fornecedor diretamente — cada chamada passa pelos mesmos `resolveXProvider` que qualquer Core Engine usaria. Ao concluir (sucesso ou falha), chama de volta um webhook autenticado da aplicação (`apps/web/app/api/webhooks/n8n/route.ts`, novo, mesmo princípio de segredo compartilhado de §9.1) que atualiza `pipeline_runs`/`content_pieces`/`content_versions` e só então (em caso de sucesso) registra o consumo de crédito.
2. Retentativas, timeouts e tratamento de falha entre etapas do pipeline de vídeo — se uma etapa falha (ex: Media Provider não retorna candidato relevante), o n8n decide retry/timeout; falha definitiva marca `content_pieces.status = failed` (novo valor de enum — [database.md §4.6](database.md#46-content_pieces--content_versions--content_packages)) e `pipeline_runs.error`, nunca trava a campanha inteira (mesmo espírito do painel de especialistas, Fluxo 10, passo 7).
3. Atualização de status das entidades no Supabase a cada etapa concluída, refletido na UI — primeira vez que o produto depende disso de fato (Supabase Realtime ou polling, a decidir em [ux-design.md](ux-design.md)).
4. Candidatos futuros para expandir o uso do n8n além do pipeline de vídeo: processamento de mídia adicional, publicações em redes sociais (pós-MVP), automações longas, integrações externas, workflows agendados/recorrentes — nenhum deles faz parte do escopo desta missão.

**O que não muda:** todo Core Engine e toda Server Action continuam sem conhecer fornecedor concreto algum — o n8n só adiciona um orquestrador entre etapas já mediadas pelo Provider Gateway, nunca uma nova via de acesso direto a fornecedor.

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
2. ~~**Composição de vídeos híbridos:** node de n8n com render externo, ou dentro do próprio Asset Engine?~~ **Resolvido (revisão 25, preparação Missão 9):** n8n orquestra o pipeline (sequencia as chamadas ao Provider Gateway), a composição em si acontece inteiramente fora do Asset Engine, delegada a um fornecedor externo via a nova capacidade Video Render Provider (§3.5.1, §5) — o Asset Engine nunca renderiza vídeo diretamente.
3. ~~**Índice de retrieval da Knowledge Base:** uso de `pgvector` no Supabase Postgres — confirmar.~~ **Resolvido (revisão 14):** o dono do produto confirmou adiar `pgvector`/embeddings. MVP da Knowledge Base usa retrieval por recência + `tags`/`source_type` (implementado e validado — §3.2). Nenhum provider de embedding integrado nesta missão; a coluna `embedding` permanece reservada em `knowledge_base_items` (nullable, schema já preparado) para quando a plataforma evoluir para busca híbrida (tags + embeddings + ranking semântico), sem quebrar a arquitetura existente.
4. **Fallback automático de provider:** troca automática para `fallback_provider_key` no mesmo request, ou apenas registro de falha para intervenção manual?
5. **Especialistas com modelos distintos (tier Premium):** vale a pena, em termos de custo/benefício, atribuir modelos diferentes a especialistas diferentes, ou todos usam o mesmo modelo do tier e a diversidade vem só dos prompts/papéis? O **mecanismo** para isso já existe (`provider_configs` por `specialist_id`, §5.1) — o que falta é a decisão de custo/benefício em si. (Relacionado à decisão de produto PRD §13.2.)
6. Provedor de banco de vídeos públicos licenciados e como ele se integra. **★ Bloqueia o início do código da Missão 9** (necessário para `licensed_stock_video`/`hybrid` — PRD §13, item 6); até a revisão 24 não bloqueava nenhuma implementação em andamento.
7. ~~**Seed inicial do Specialist Registry (§4.1):** implementado na Missão 3 [...] revisão do dono do produto sobre o conteúdo exato de cada `system_prompt` pendente.~~ **Resolvido (revisão 13):** os 4 `system_prompt`s (`marketing_strategy`, `branding`, `copywriting`, `coordinator`) passaram por validação qualitativa real (Supabase + Anthropic reais, múltiplos objetivos de campanha incluindo um caso desenhado para forçar divergência) e foram aprovados pelo dono do produto. Um problema de truncamento no prompt de Branding foi corrigido (migration `0005`). Documentação individual de cada especialista em [`docs/prompts/`](prompts/).
8. ~~**Trend Source Provider do MVP.**~~ **Resolvido (revisão 15):** busca web nativa da API da Anthropic, como adapter de `trend_source` atrás do Provider Gateway — ver §3.3.
9. ~~**n8n no Fluxo 2.**~~ **Resolvido (revisão 15):** Fluxo 2 é Server Action direta, sem n8n — ver §3.3 e §8.
10. **(★ novo, Missão 6) Cobrança incremental por marca extra no Business:** hoje até 5 marcas inclusas, sem custo adicional por marca a mais. Se/quando surgir demanda real por mais de 5 marcas numa organização, decidir se isso vira upgrade de plano, add-on pago por marca, ou limite rígido. Não bloqueia o MVP.
11. ~~**Downgrade/cancelamento de assinatura:** o que acontece com créditos já concedidos (`grant_plan`) quando o cliente troca para um plano menor no meio do ciclo, ou cancela?~~ **Resolvido (Missão 6):** créditos já concedidos no ciclo corrente não são revogados retroativamente — o cliente já "pagou" por eles nesse período. Troca de plano ou cancelamento só afeta o `grant_plan` do próximo ciclo (ou a ausência dele, em caso de cancelamento).
12. ~~**Fornecedor do Video Render Provider, mecanismo de legenda e regra de segmentação do modo `hybrid`.**~~ **Fornecedor e legenda resolvidos:** Video Render Provider = Shotstack; legenda vem da marcação de tempo por caractere do ElevenLabs (§3.5.1), sem capacidade de transcrição separada. **Regra de segmentação do `hybrid` adiada para a Etapa 2** (revisão 27) — junto com a própria implementação de `ai_avatar`, não bloqueia a Etapa 1 (que não usa `hybrid`).

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

## 12. Billing (Módulo dedicado) ★ novo (Missão 6)

**Por que não é uma capability do Provider Layer:** todo capability do Provider Layer (§5) existe para esconder um fornecedor de IA/mídia atrás de um contrato genérico e trocável, porque o cliente nunca deveria saber ou se importar com qual fornecedor está por trás. Um gateway de pagamento é fundamentalmente diferente: checkout, webhooks, ciclo de vida de assinatura e mensagens de erro são específicos do fornecedor (Mercado Pago), e fingir um contrato genérico agora, para um cenário de troca de gateway de pagamento que é raro e caro de fazer bem, adicionaria abstração sem benefício real hoje. Decisão explícita do dono do produto (Missão 6): módulo de Billing dedicado, isolado o suficiente para ser substituído no futuro sem reescrever o resto do produto, mas não modelado como Provider Layer.

**Por que também não é um Core Engine:** Core Engines (§3) concentram lógica de **produto** orientada por IA (Brand Brain, Trend Engine, Intelligence Hub, Asset Engine, Learning Engine, Knowledge Base). Billing é infraestrutura de comércio — controla acesso e cobra pelo uso dos Core Engines, mas não é, em si, um mecanismo de raciocínio de IA.

### 12.1 Responsabilidade

- Gerenciar o ciclo de vida da assinatura (`subscriptions`) — criar, sincronizar status com o Mercado Pago, cancelar.
- Manter o saldo de créditos da organização (`credit_ledger`) — lançamentos de concessão mensal (`grant_plan`), compra avulsa (`purchase`), consumo (`consumption`) e ajuste manual (`adjustment`).
- **Portão de crédito obrigatório:** antes de qualquer sessão do Intelligence Hub (hoje: `campaign_strategy` e `trend_ranking` — os únicos geradores de custo real que existem; `Asset Engine`, quando implementado, se torna o principal ponto de consumo, ver §12.4), checar se a organização tem assinatura ativa **e** saldo suficiente para o custo em créditos daquela operação (`credit_pricing`). Sem os dois, a operação é bloqueada antes de qualquer chamada à Provider Layer — nunca depois, para não desperdiçar uma chamada de LLM que o cliente não vai poder pagar.
- Processar pagamentos avulsos de créditos (Checkout Pro) e assinaturas recorrentes (Preapproval) via Mercado Pago.
- **Sincronizar `organizations.provider_tier` com o plano ativo** — quando uma assinatura é ativada (nova ou renovada), o tier de provedor da organização é atualizado para o `tier_included` do plano (`plans`, PRD §8: Starter→Econômico, Pro→Balanceado, Business→Premium). **Achado durante a validação real (Missão 6):** sem isso, um cliente pagando Pro/Business continuava recebendo o tier Econômico em toda geração, porque nada propagava essa informação — bug real, corrigido antes do fechamento da missão.

### 12.2 Integração com o Mercado Pago

Dois produtos do Mercado Pago, para dois fluxos diferentes:

- **Assinatura de plano (Starter/Pro/Business) → [Preapproval](https://www.mercadopago.com.br) (assinatura recorrente).** `subscriptions.billing_provider_ref` guarda o `preapproval_id`. Mudanças de status (autorizada, pausada, cancelada, pagamento falhou) chegam via webhook e atualizam `subscriptions.status`.
- **Compra avulsa de créditos → Checkout Pro (pagamento único).** Cliente escolhe um pacote (`credit_packages`), é redirecionado ao checkout do Mercado Pago, e a confirmação chega via webhook — nunca por redirect de volta ao navegador (o cliente pode fechar a aba antes de voltar; o webhook é a única fonte de verdade).

**Webhooks:** endpoint dedicado (`apps/web/app/api/webhooks/mercado-pago/route.ts`), autenticado validando a assinatura enviada pelo Mercado Pago no header (`x-signature`) contra o webhook secret — mesmo princípio de segredo compartilhado já usado para webhooks de n8n (§9.1), nunca confiando no payload sem validar a origem.

**Idempotência:** notificações de webhook podem ser reentregues pelo Mercado Pago. Em vez de uma tabela nova de eventos, `credit_ledger.external_payment_id` (nullable, **unique**) guarda o id do pagamento do Mercado Pago em lançamentos `purchase` — uma segunda entrega do mesmo webhook tenta inserir a mesma `external_payment_id` e falha por constraint, sem duplicar crédito. Atualizações de status de assinatura são idempotentes por natureza (um `UPDATE` do mesmo status não causa efeito colateral).

**Segredos:** `MERCADO_PAGO_ACCESS_TOKEN` (server-side, nunca exposto ao client) e `MERCADO_PAGO_WEBHOOK_SECRET` como variáveis de ambiente, mesmo padrão de `ANTHROPIC_API_KEY` — nunca lidos fora do módulo de Billing.

### 12.3 Onde o portão de crédito é verificado

Mesma camada onde hoje já vive a checagem de papel (`hasMinimumRole`) — a Server Action, antes de chamar o Core Engine. `createCampaignStrategyAction` e `runTrendDiscoveryAction` passam a checar `ensureSufficientCredits(organizationId, triggerReason, tier)` antes de acionar `runCampaignStrategySession`/`runTrendDiscovery`, e registrar `recordConsumption` depois de uma sessão concluída com sucesso (nunca antes — uma sessão que falha não deve cobrar o cliente). Nenhum Core Engine conhece `credit_ledger` diretamente — a checagem e o débito ficam na borda (Server Action), não dentro do Intelligence Hub, mantendo a mesma separação de responsabilidades já usada em todo o resto do produto (Tela → Server Action → Repository).

**★ Variante assíncrona (preparação Missão 9, geração de vídeo):** a checagem (`ensureSufficientCredits`) continua acontecendo na Server Action, antes de disparar o pipeline do n8n (§3.5.1/§8) — mesmo princípio de nunca chamar um fornecedor pago sem saldo confirmado antes. A diferença é **onde o débito acontece**: como a operação não termina dentro da mesma Server Action, `recordConsumption` é chamado pelo webhook de conclusão do n8n (`apps/web/app/api/webhooks/n8n/route.ts`), não pela Server Action original — só quando o pipeline reporta sucesso. Idempotência do débito (reentrega do mesmo webhook não pode cobrar duas vezes) segue o mesmo padrão já usado para pagamentos do Mercado Pago (§12.2): `credit_ledger` ganha uma coluna própria referenciando a execução do pipeline (`related_pipeline_run_id`, único — [database.md §7.2](database.md#72-credit_ledger)), análoga a `external_payment_id`.

### 12.4 Preço em créditos por operação (`credit_pricing`)

Custo deliberadamente baixo no Intelligence Hub (raciocínio) e concentrado no Asset Engine (geração de mídia — carrossel, vídeo, avatar, imagem) — decisão de produto explícita (Missão 6): incentivar uso intenso do "cérebro" da plataforma, cobrar principalmente pelo que tem custo computacional real. A partir da preparação da Missão 9, essa concentração deixa de ser só uma previsão — `video_generation` é o primeiro `trigger_reason` que reflete o custo real de múltiplos fornecedores pagos externos, não só de uma chamada de LLM.

| `trigger_reason` | Econômico | Balanceado | Premium |
|---|---|---|---|
| `trend_ranking` | 2 | 4 | 8 |
| `asset_generation` ★ novo (Missão 7) | 3 | 6 | 12 |
| `video_generation` ★ novo (preparação Missão 9) | a definir | a definir | a definir |
| `campaign_strategy` | 5 | 10 | 20 |

Preço por `trigger_reason` + `tier`, não só por `capability` — as operações que usam a mesma capability (`llm`, no caso de `trend_ranking`/`asset_generation`/`campaign_strategy`) custam diferente porque o custo real (nº de chamadas, tamanho do contexto) é diferente: `trend_ranking` é mais leve (1-2 especialistas), `asset_generation` é uma única chamada por peça de texto, `campaign_strategy` é o painel completo. `trend_ranking` ajustado de 1/2/4 para 2/4/8 na Missão 7 (decisão do dono do produto). **`video_generation` (preparação Missão 9) é `trigger_reason` próprio, deliberadamente separado de `asset_generation`** — decisão do dono do produto: geração de vídeo consome múltiplos fornecedores pagos (voz, mídia, renderização), custo real muito maior e mais variável que uma única chamada de LLM, não deveria compartilhar preço com a geração de texto. Valores exatos por tier permanecem em aberto (PRD §13, item 11) — **não bloqueia o início do código**, a linha pode ser inserida com um valor provisório e ajustada por `UPDATE` antes do lançamento, mesmo padrão já usado para `asset_generation`/`trend_ranking`. Ver [database.md §7.3](database.md#73-credit_pricing).

**Dados reais de custo/latência por chamada (revisão 28, validação real da Etapa 1 — [docs/changelog.md](changelog.md) v2.18), insumo para fechar os valores acima:**

| Provider | Operação | Latência medida | Custo (tabela pública do fornecedor) |
|---|---|---|---|
| ElevenLabs (voz) | `synthesizeVoice`, 97 caracteres → 7,3s de áudio | 5,25s | ~US$0,01–0,02 (cobrado por caractere de entrada, US$0,09–0,20/1.000 caracteres conforme plano) |
| Pexels (cenas) | `searchMedia` + `fetchMedia` | 2,3s | Gratuito |
| Shotstack (composição) | `composeVideo`, 5s renderizados | 16,3s (sandbox) | Sandbox: sem custo direto (créditos de teste). Produção: ~US$0,017–0,025 (US$0,20–0,30/min, arredondado ao segundo) |

Números de uma única chamada cada, ambiente de desenvolvimento — ordem de grandeza, não média estatística. Custo de produção do Shotstack não medido diretamente (sandbox não cobra); estimado a partir da tabela pública de preços.

### 12.5 Planos

| Plano | Marcas inclusas | Tier incluso | Créditos/mês (`grant_plan`) |
|---|---|---|---|
| Starter | 1 | Econômico | 100 |
| Pro | 1 | Balanceado | 500 |
| Business | até 5 | Premium | 1.500 |

## 13. Feedback do Usuário (utilitário transversal) ★ novo (preparação Missão 10)

**Por que não é um Core Engine:** Core Engines (§3) concentram lógica de produto orientada por IA. Feedback do usuário é só captura de texto — não raciocina, não chama Provider Layer, não tem justificativa de marca. **Por que não é Provider Layer:** não esconde fornecedor algum atrás de um contrato — é gravação direta numa tabela. Mesmo raciocínio de exclusão já usado para justificar o Billing como módulo dedicado (§12), aplicado aqui a algo ainda mais simples: um utilitário transversal, sem camada própria.

### 13.1 Responsabilidade

- Um botão **"Enviar feedback"**, visível em qualquer tela autenticada (layout da `(platform)`, ao lado de onde já vivem outras ações globais como troca de tema/sair) — nunca escondido dentro de uma tela específica.
- Ao clicar, abre um modal simples: categoria (**Sugestão** / **Bug** / **Dificuldade de uso** / **Outro** ★ ajuste do dono do produto) + descrição em texto livre.
- Ao enviar, grava uma linha em `user_feedback` — usuário, organização, categoria, descrição, data, **e contexto capturado automaticamente** (rota atual, versão da aplicação, navegador — ★ ajuste do dono do produto, §13.1.1) — e fecha o modal com uma confirmação simples (toast), sem fluxo adicional.
- **Sem interface administrativa nesta missão** (decisão explícita do dono do produto, PRD §9.3) — consulta ao feedback recebido é direta no banco (Supabase Studio ou SQL), não pela aplicação. Puramente write-only do ponto de vista do usuário final.

#### 13.1.1 Contexto automático ★ novo (ajuste pré-implementação)

Capturado sem exigir nada do usuário, para nunca depender de perguntar depois "em qual tela isso aconteceu":

- **Rota atual (`pathname`):** só o client sabe em qual tela o usuário estava — capturado via `usePathname()` (Next.js) no componente do modal, enviado como argumento da Server Action.
- **Navegador (`userAgent`):** capturado **no servidor**, não confiando em valor enviado pelo client — `headers().get("user-agent")` (`next/headers`), dentro da própria Server Action. Mais confiável que um campo de formulário, mesmo espírito de nunca confiar em input não verificado quando existe uma fonte melhor disponível.
- **Versão da aplicação (`app_version`):** lida no servidor a partir de `package.json` (`apps/web/package.json.version`) — nunca hardcoded solto em outro lugar, nunca enviada pelo client. **Achado durante este ajuste:** os `package.json` do monorepo nunca foram sincronizados com as tags de release (`CHANGELOG.md`/`git tag`) — todos ainda em `0.1.0` apesar do repositório já estar em `v0.10.2`. Corrigido como parte desta missão (§13.1.2).

#### 13.1.2 Achado: `package.json.version` nunca foi mantido em sincronia com as releases

`package.json` (raiz, `apps/web`, `packages/core`) ficou parado em `0.1.0` desde o início do projeto — nenhuma missão anterior precisou de um valor confiável de versão em runtime, então ninguém bumpava. Corrigido: os 3 `package.json` atualizados para `0.10.2` (última tag), e a partir desta missão, **bumpar `package.json` passa a fazer parte do fechamento de toda missão** (junto de `CHANGELOG.md` e da tag `git`) — nenhuma mudança de processo document-first além dessa, só uma disciplina nova de release.

### 13.2 Onde vive no código

Segue o mesmo padrão de toda ação simples do produto — `Tela → Server Action → Repository → Supabase` (arch. §2.1) — mas sem Core Engine no meio, porque não há lógica de produto a orquestrar: a Server Action grava direto via `UserFeedbackRepository`, sem intermediário.

- Componente de UI (modal + botão) vive em `packages/ui` ou `apps/web/components/layout` (decisão de implementação, não de arquitetura) — reutilizável em qualquer tela por estar no layout autenticado, nunca duplicado por página.
- `UserFeedbackRepository` (novo, `packages/core/src/repositories/`) — único ponto de código que fala com `user_feedback`, mesmo padrão de todo repository já existente.

### 13.3 Segurança

- RLS: `insert` liberado para membros da organização (`is_org_member`, mesmo padrão de escrita já usado em tabelas equivalentes) — cada usuário só grava feedback vinculado à própria `organization_id`/`user_id`, nunca em nome de outra organização.
- **Sem policy de `select` para usuário final** — mesmo padrão já usado para tabelas administrativas internas (`specialists`, `provider_configs`, §5.1) — nenhum usuário lê feedback de ninguém, nem o próprio, pela aplicação. Leitura é só via service role (consulta direta ao banco), consistente com "sem interface administrativa nesta missão".
- Sem `update`/`delete` para ninguém além de service role — `user_feedback` é append-only, mesmo espírito de `credit_ledger`/`audit_logs`.

> Detalhamento de schema em [database.md §4.9](database.md#49-user_feedback-★-novo-preparação-missão-10).

Sem contador de cota separado — a "cota mensal" de cada plano **é** o tamanho do `grant_plan` de créditos lançado no início de cada ciclo (Fluxo 6, passo 4). Um único mecanismo (`credit_ledger`) cobre tanto o limite do Starter quanto o "ilimitado sujeito a fair use" do Pro/Business (PRD §8) — a diferença entre os planos é só o tamanho do grant e o tier incluso, nunca um sistema de contagem paralelo. Resolve PRD §13, item 5. Sem cobrança incremental por marca extra no Business por enquanto — decisão futura se surgir necessidade real (§10, item 10 abaixo).
