# Changelog

Histórico de releases do código da Ayon Creator. Para o histórico de decisões de escopo/documentação, ver [docs/changelog.md](docs/changelog.md).

## [0.8.0] — 2026-08-04

### Adicionado

- **Missão 8 — Learning Engine (Brand Evolution / "O que Funcionou")**: análise sob demanda dos sinais de aprovação/rejeição/edição de peça de conteúdo, gerando sugestões de ajuste que só mudam o comportamento futuro mediante aceite humano explícito. Gratuita em todos os planos; mínimo de 5 sinais não usados antes de qualquer análise.
  - **Banco**: migration `0012_learning_engine.sql` — `learning_signals`/`learning_insights`, `specialists.applies_to` estendido para `learning_analysis` (Marketing + Branding). `intelligence_hub_sessions.related_entity_type` ganha `'brand'` (extensão aditiva do CHECK) — `learning_analysis` é mais um tipo de decisão do Intelligence Hub, com a mesma trilha de auditoria (`specialist_opinions`) de `campaign_strategy`/`trend_ranking`.
  - **`packages/core`**: módulo `learning-engine/` — `runLearningAnalysis` (agrega sinais, aciona o Intelligence Hub, cria até 5 insights). `buildBrandContextBlock` ganha um parâmetro opcional para aprendizados aceitos, conectado aos 4 pontos que já montam contexto de marca (`campaign_strategy`, `trend_ranking`, `asset_generation`, `learning_analysis`) — é o mecanismo real de "aplicação" de um insight aceito.
  - **Server Actions**: `emitLearningSignal` conectado a aprovar/rejeitar/editar peça (Missão 7); `runLearningAnalysisAction`/`acceptInsightAction`/`dismissInsightAction` em `o-que-funcionou/actions.ts`, gated a `admin+`.
  - **UI**: `InsightList` (EVOL-1) — sugestões pendentes com Aceitar/Descartar inline, histórico na mesma tela. Item de navegação "O que Funcionou" passa a `implemented: true`.

### Observado durante a validação real (não é bug de código)

- A primeira tentativa de análise falhou com um JSON inválido do LLM; a segunda tentativa, com o mesmo código, teve sucesso. Mesma categoria de risco de qualquer chamada de LLM com saída estruturada estrita já existente no repositório — nenhum Engine hoje tem retry automático, e não houve reprodução numa segunda tentativa.

## [0.7.0] — 2026-08-03

### Adicionado

- **Missão 7 — Asset Engine**: geração automática do pacote de conteúdo de uma campanha aprovada — 5 formatos textuais gerados por IA (legenda, roteiro, teleprompter, e-mail, post de blog), 4 formatos visuais (vídeo, stories, carrossel, thumbnail) via upload manual do cliente (`own_media`, sem depender de Biblioteca de Mídia ainda inexistente). Escopo MVP aprovado pelo dono do produto: sem Avatar/Voice/Media Provider, execução síncrona sem n8n, sem Supabase Realtime.
  - **Banco**: migration `0011_asset_engine.sql` — `content_pieces`/`content_versions`/`content_packages`, helpers de RLS `campaign_organization_id`/`content_piece_organization_id`, `credit_ledger.related_content_piece_id`, `credit_pricing` para `asset_generation` (3/6/12 por tier) e reajuste de `trend_ranking` (2/4/8).
  - **`packages/core`**: módulo `asset-engine/` — `generateTextPiece` (LLM Provider por formato), `initializeCampaignContentPieces` (9 peças por campanha, roteiro como peça principal), `buildContentPackage` (JSZip, excluído do barrel de `@ayon/core` por depender de APIs Node, mesmo padrão de `pdf-parse`/`mercadopago`).
  - **Server Actions**: aprovação da estratégia dispara a geração das 5 peças textuais; 5 novas actions em `criar-campanha/asset-actions.ts` (editar, regenerar, upload, aprovar — que monta o pacote automaticamente quando a última peça é aprovada —, rejeitar).
  - **UI**: `ContentPackageReview` (CAMP-4/5/6) — revisão por peça, tela final de download do pacote (`.zip` via signed URL).

### Corrigido durante a validação real (Supabase + Anthropic reais)

- **Nomes de arquivo com UUID vazado no pacote final**: `buildContentPackage` nomeava cada arquivo `own_media` dentro do `.zip` com o último segmento do caminho de storage (`{contentPieceId}-{nomeOriginal}`, prefixo usado só para evitar colisão no bucket) em vez do nome original enviado pelo cliente. Corrigido para remover o prefixo antes de adicionar ao zip — confirmado com os 4 arquivos reais da validação (thumbnail/carousel/video/stories).

## [0.6.0] — 2026-08-03

### Adicionado

- **Missão 6 — Billing**: planos (Starter/Pro/Business), créditos, dedução por uso dos módulos, integração com Mercado Pago, bloqueio quando não há créditos ou assinatura ativa, telas de assinatura/consumo/histórico.
  - **Banco**: migrations `0008_billing.sql` (`subscriptions`, `credit_ledger`, `credit_pricing`, `credit_packages`), `0009_drop_organizations_plan.sql` (remove coluna morta da Sprint 1), `0010_plans.sql` (números de cada plano como dado, não código).
  - **`packages/core`**: repositories de billing; módulo `billing/` com adapter do Mercado Pago (`mercado-pago-client.ts`, SDK oficial `mercadopago`), portão de crédito (`credit-gate.ts`: `ensureSufficientCredits`/`recordConsumption`) e handler de webhook (`mercado-pago-webhook-handler.ts`).
  - **Server Actions**: portão de crédito integrado a Criar Campanha e O que está em Alta (checagem antes de qualquer chamada de IA, débito só após sucesso); novas actions de assinatura/compra de créditos, restritas a `admin+`.
  - **UI**: `/configuracoes` — plano atual, planos disponíveis, saldo de créditos, pacotes avulsos, histórico de lançamentos. CTA de bloqueio ("Ir para Configurações") nas telas que consomem crédito.
  - **Webhook**: `/api/webhooks/mercado-pago`, assinatura validada antes de processar qualquer notificação.

### Corrigido durante a validação real (Supabase + Mercado Pago reais, sandbox)

- **`organizations.provider_tier` nunca sincronizado com o plano ativo**: PRD promete tier Balanceado incluso no Pro e Premium no Business, mas nada atualizava o tier da organização quando a assinatura era ativada — cliente pagando Pro continuava recebendo preço/qualidade de tier Econômico. Reproduzido ao vivo (campanha de teste debitou 5 créditos em vez de 10) e corrigido no handler de webhook, que agora sincroniza o tier na mesma transição que concede os créditos do ciclo.

### Observado, não corrigido (fora de escopo da Missão 6)

- Checkout de sandbox de ponta a ponta (pagamento real de teste aprovado) não pôde ser completado nesta sessão — o Mercado Pago exige uma conta vendedora de teste dedicada, que requer configuração adicional no painel do Mercado Pago. O ramo "pagamento aprovado" do webhook foi validado por chamada direta ao handler/repositories reais contra dados reais da API, não por um payload inventado — ver `docs/changelog.md` (v2.4) para o detalhamento. Registrado como possível trabalho futuro se um teste de checkout visual completo for necessário.
- Dois arquivos `.env.local` (raiz e `apps/web/.env.local`) mantidos manualmente em sincronia desde a Sprint 1 — `apps/web/.env.local` é o que `next dev` de fato lê. Causou confusão durante a validação desta missão; não é um bug de produto, é uma decisão de tooling fora de escopo aqui.

## [0.5.0] — 2026-08-03

### Adicionado

- **Missão 5 — O que está em Alta (Trend Engine)**: descoberta de tendências relevantes ao nicho da marca, sempre interpretadas pelo Intelligence Hub antes de chegar ao usuário — nunca uma lista bruta de resultados de busca.
  - **`packages/core`**: `TrendSourceProvider` (contrato) + `AnthropicWebSearchTrendSourceProvider` (adapter sobre a ferramenta de busca web nativa da API da Anthropic), resolvido pelo Provider Gateway (`resolveTrendSourceProvider`) — o Trend Engine nunca conhece o fornecedor concreto. `TrendResearchRepository`. Módulo `trend-engine/` (`runTrendDiscovery`) orquestrando Trend Source Provider → Intelligence Hub (painel de Marketing + Branding, ampliados via `applies_to` — Specialist Registry, mudança de dado) → Coordinator → ranqueamento final.
  - **Server Actions** (`apps/web/app/(platform)/o-que-esta-em-alta/actions.ts`): `runTrendDiscoveryAction`, restrita a `editor+` para disparar busca.
  - **UI**: TREND-1 (lista de tendências ranqueadas) e TREND-2 (detalhe com justificativa "Por que fiz assim?" e link para a fonte), com handoff para "Criar Campanha" já com o tema pré-preenchido. Item de navegação "O que está em Alta" passa a `implemented: true`.
  - **Banco**: migration `0006_trend_engine.sql` (`trend_research`, FK real de `campaigns.trend_research_id`, capability `trend_source` em `provider_configs`, `applies_to` de Marketing/Branding ampliado para `trend_ranking`).
  - **Dependência**: `@anthropic-ai/sdk` atualizado de `0.32.1` para `^0.65.0` (suporte à ferramenta de busca web nativa).

### Decisão arquitetural tomada durante a implementação (parada técnica, aprovada pelo dono do produto)

- **Coordinator generalizado para ser independente do tipo de decisão**: o único Coordinator do Specialist Registry tinha, desde a Missão 3, um `system_prompt` com formato de saída JSON fixo, específico de estratégia de campanha — incompatível com o ranqueamento de tendências precisar de um formato diferente (lista ordenada). Resolvido sem duplicar o Coordinator: comportamento idêntico (nunca faz média, reconhece divergência real, ancora no Brand Brain), mas o formato de saída passa a ser declarado pela tarefa que o invoca, via mensagem do usuário — nunca mais fixo no `system_prompt` (migration `0007_coordinator_decision_agnostic.sql`).

### Corrigido durante a validação real (Supabase + Anthropic reais, busca de tendências + regressão em Criar Campanha)

- **Coordinator retornava formato errado em ambas as tarefas**: a generalização acima só funciona se a mensagem do usuário de cada tarefa declarar explicitamente o JSON esperado — `buildTrendRankingCoordinatorMessage` (nova, Missão 5) e `buildCoordinatorUserMessage` (existente, Missão 3) nunca faziam isso, contando implicitamente com o formato fixo que acabara de ser removido do `system_prompt`. **Sem essa correção, a primeira execução real de "Criar Campanha" em produção pós-generalização teria quebrado** — pego a tempo por um teste de regressão explícito depois de corrigir o caso de tendências. Corrigido adicionando a instrução de formato JSON explícita em ambas as mensagens.
- **Sessão do Intelligence Hub presa em `running`** quando a descoberta de tendências falhava depois da sessão já criada (reproduzido ao vivo pelo bug acima) — `trend_research` era marcado `failed`, mas a sessão associada não. Corrigido em `trend-engine.ts`.

## [0.4.0] — 2026-08-03

### Adicionado

- **Missão 4 — Ensine sua Empresa para a IA (Knowledge Base)**: ingestão de conhecimento da marca via upload de arquivo (PDF/DOCX/TXT) ou nota manual, com edição de tags e remoção (soft delete).
  - **`packages/core`**: `extract-document-text.ts` (extração síncrona de texto — `pdf-parse` para PDF, `mammoth` para DOCX, leitura direta para TXT), `knowledge-source-labels.ts` (rótulos em linguagem de negócio); `KnowledgeBaseItemRepository` ganhou `findById`/`update`/`softDelete`.
  - **Server Actions** (`apps/web/app/(platform)/ensine-sua-empresa/actions.ts`): upload de arquivo, criação de nota manual, edição de tags, remoção — todos restritos a papel `editor+`.
  - **UI**: telas KB-1 (Biblioteca de Conhecimento), KB-2 (Adicionar Conhecimento), KB-3 (Detalhe/edição/remoção). Item de navegação "Ensine sua Empresa para a IA" passa a `implemented: true`.
  - **Decisão de arquitetura de módulos**: `extract-document-text.ts` foi excluído do barrel de exports de `@ayon/core` porque `pdf-parse` depende de `fs` e quebrava o bundle de Client Components que importam qualquer coisa do pacote — passou a ser importado por caminho direto, só de onde é realmente usado.
  - Nenhuma migration nova: reaproveita `knowledge_base_items`, já criada na migration `0002_conheca_sua_empresa.sql` (Missão 2). `embedding`/pgvector permanece adiado (decisão registrada em `docs/database.md`/`docs/architecture.md`) — retrieval no MVP é por recência + tags/source_type.

### Validado durante a validação real (Supabase real — upload de PDF, DOCX e TXT reais, nota manual, edição de tags, remoção)

- Extração de texto correta nos 3 formatos, confirmada lendo `content_text` gravado no banco.
- Arquivo persistido corretamente no bucket `knowledge-base`, confirmado via listagem do Storage.
- Erro amigável e específico para tipo de arquivo não suportado (testado com PNG).
- Edição de tags e remoção (soft delete, `deleted_at` preenchido, linha preservada) confirmadas via leitura direta do banco.

### Observado, não corrigido (fora de escopo da Missão 4)

- **Race condition no Provisionamento Inicial** (`ensureInitialProvisioning`, Sprint 1): checagem "check-then-act" sem lock — duas requisições quase simultâneas do mesmo usuário novo podem criar duas organizations/marcas distintas, ambas com o usuário como owner. Reproduzido ao vivo durante o teste (dois logins de teste próximos no tempo geraram 2 organizations); dados de teste já limpos. Registrado como tarefa isolada para uma missão de manutenção dedicada, para não misturar uma correção de Sprint 1 dentro da tag da Missão 4.

## [0.3.0] — 2026-08-03

### Adicionado

- **Missão 3 — Specialist Registry + primeiro Intelligence Hub funcional**: infraestrutura de especialistas plugáveis (tabela `specialists`, nunca hardcoded no código) e um Intelligence Hub funcional de ponta a ponta.
  - 3 especialistas iniciais (Marketing, Branding, Copy) + Coordinator AI, cada um resolvido em runtime via Specialist Registry — adicionar um novo especialista é uma mudança de dado, não de arquitetura.
  - Painel de especialistas roda em paralelo (`Promise.allSettled`); falha de um nunca bloqueia os demais nem o Coordinator.
  - Coordinator nunca faz média das opiniões: reconhece divergência real quando ela existe, explica qual lado seguiu e por quê, sempre ancorado no Brand Brain (bloco "Por que fiz assim?").
  - Tela "Criar Campanha" (`/criar-campanha`): objetivo de campanha em texto livre → opiniões individuais dos especialistas → estratégia consolidada com justificativa → aprovação explícita (nunca automática).
- **Banco**: migration `0004_intelligence_hub.sql` (`specialists`, `intelligence_hub_sessions`, `specialist_opinions`, `campaigns`; `provider_configs.specialist_type` substituído por `specialist_id`).
- **`packages/core`**: `SpecialistRepository`, `IntelligenceHubSessionRepository`, `SpecialistOpinionRepository`, `CampaignRepository`; `resolveLlmProvider` ganha resolução opcional por especialista; módulo `intelligence-hub/` (painel, Coordinator, engine de orquestração); `shared/llm-json.ts` extraído para reuso entre Engines.

### Corrigido durante a validação real (Supabase + Anthropic reais, painel de 3 especialistas + Coordinator)

- **Especialista de Branding falhava sistematicamente**: `maxTokens: 512` no painel de especialistas cortava a resposta no meio de uma string JSON (`stop_reason: "max_tokens"`) porque o prompt de Branding, ao contrário do de Marketing, não delimitava um tamanho de resposta. Corrigido elevando `maxTokens` para 1024 (margem estrutural para qualquer especialista, presente ou futuro) e reforçando os prompts de Branding e Copy com o mesmo limite explícito de frases que o de Marketing já tinha (migration `0005_intelligence_hub_prompt_fixes.sql`).

### Observado, não corrigido (fora de escopo da Missão 3)

- Uma execução teve os 3 especialistas e o Coordinator falhando simultaneamente com erro de conexão transitório — o sistema se comportou corretamente (sessão/campanha marcadas `failed`, erro amigável ao usuário, nova tentativa funcionou normalmente). Sugestão registrada para a Missão 4: retry com backoff no Provider Gateway para esse tipo de falha transitória.
- Tempo médio de resposta de uma sessão completa (painel + Coordinator): ~45s, com variação alta entre execuções. Funciona, mas revelação progressiva (mostrar cada opinião assim que chega, em vez de esperar o lote completo) melhoraria a sensação de fluidez — já era decisão em aberto documentada antes da implementação.
- Bug de citações trocadas na tela "O que eu entendi até agora" (Missão 2, v0.2.0) encontrado ao montar a marca de teste para esta validação — **não corrigido nesta versão de propósito**, para não misturar uma correção de Missão 2 dentro da tag de Missão 3. Registrado como tarefa isolada, a ser resolvida numa missão de manutenção dedicada.

## [0.2.0] — 2026-08-03

### Adicionado

- **Missão 2 — "Conheça sua empresa"**: conversa completa com a Ayon (consultora permanente, PRD §1.1) que popula o Brand Brain.
  - 5 temas cobrindo os 9 campos estruturados (história, produtos, clientes, tom de voz, concorrentes, objetivos, diferenciais, palavras proibidas/favoritas), com reação e callback obrigatórios a cada turno.
  - Painel "O que a Ayon já sabe" — progresso como conhecimento acumulado, nunca contagem de perguntas.
  - Síntese revisável (ONB-3, "O que eu entendi até agora") e Perfil da Marca persistente e editável (ONB-4).
  - Retomada de conversa: reload reconstrói o histórico exato e mostra recapitulação, sem repetir turnos.
- **Provider Layer para LLM**: `LlmProvider`/`AnthropicLlmProvider`/`resolveLlmProvider`, resolvido por `(capability, tier)` via `provider_configs` — a conversa nunca acopla lógica de negócio a um fornecedor específico.
- **Banco**: migrations `0002_conheca_sua_empresa.sql` (`brand_brain_profiles`, `brand_onboarding_answers`, `knowledge_base_items`, com RLS) e `0003_provider_configs.sql` (mapeamento tier→fornecedor, acesso restrito a service role).
- **`packages/ui`**: componente `Textarea`.

### Corrigido durante a validação real (Supabase + Anthropic reais, conversa completa até confirmação)

- **Perda da mensagem de abertura ao retomar**: a primeira mensagem da Ayon (kickoff) nunca era persistida em `knowledge_base_items` — qualquer reload antes da primeira resposta do usuário reiniciava a conversa do zero, gerando uma abertura nova e descartando a anterior. Corrigido para persistir também o turno de abertura.
- **Confusão de identidade**: a Ayon usou o próprio nome ("Ayon") numa frase hipotética do cliente da marca, em vez do nome da marca do cliente. Adicionada regra explícita no system prompt proibindo essa confusão.
- **Corrupção de campos de lista**: concorrentes/palavras proibidas/favoritas às vezes vinham como frase inteira em vez de itens curtos, e o split ingênuo por vírgula cortava itens no meio de parênteses explicativos (ex.: "Booking, 123Milhas" virava dois itens quebrados). Corrigido na fonte (instrução explícita no prompt) e reforçado com parsing defensivo (remoção de parênteses antes de dividir), usado tanto pelo merge da conversa quanto pela edição manual.

### Observado, não corrigido (fora de escopo da Missão 2)

- Latência média de ~12,7s por turno da conversa (variação 6,9s–20,1s) — funciona, mas resposta em streaming melhoraria a sensação de fluidez. Registrado como possível melhoria futura, não implementado agora.
- Warning "Maximum update depth exceeded" (dev mode) presente também em `/painel` — dívida técnica pré-existente da Sprint 1, não relacionada à Missão 2.

## [0.1.0] — 2026-08-02

### Adicionado

- Fundação do Ayon Creator: monorepo (pnpm workspaces), autenticação (Supabase Auth), provisionamento inicial de conta (organization/brand/member idempotente), layout base autenticado (sidebar, topbar, dashboard vazio).

### Corrigido

- RLS bloqueando `INSERT ... RETURNING` no bootstrap de conta (policy de select precisava de cláusula alternativa para o próprio criador).
- Mensagem amigável para rate limit de e-mail no cadastro.
