# Changelog

Histórico de releases do código da Ayon Creator. Para o histórico de decisões de escopo/documentação, ver [docs/changelog.md](docs/changelog.md).

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
