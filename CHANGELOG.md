# Changelog

Histórico de releases do código da Ayon Creator. Para o histórico de decisões de escopo/documentação, ver [docs/changelog.md](docs/changelog.md).

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
