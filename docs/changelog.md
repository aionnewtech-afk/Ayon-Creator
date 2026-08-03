# Changelog de Documentação — Ayon Creator

> Todo pedido de nova funcionalidade gera uma entrada aqui, junto com as atualizações correspondentes em PRD.md, architecture.md, database.md e flows.md. Nenhuma implementação é feita sem uma entrada aprovada aqui.

---

## v1.7 (revisão 14) — 2026-08-03 — Preparação doc-first da Missão 4 (Ensine sua Empresa para a IA)

**Status:** documentação pronta para revisão — **aguardando confirmação do dono do produto antes do código**, seguindo o mesmo processo doc-first já usado nas Missões 2 e 3.

**O que mudou:**

- **`docs/architecture.md`:** §3.2 (Knowledge Base) detalhada com o pipeline de ingestão (upload → Storage → extração de texto síncrona → `knowledge_base_items`); §10, item 3 (pgvector) resolvido com uma recomendação explícita: **adiar embeddings/pgvector**, já que nenhum provider de embedding está integrado hoje (a Anthropic não expõe API de embeddings) e adicionar um fornecedor novo agora atrasaria a Missão 4 sem necessidade clara. MVP da Knowledge Base usa retrieval por recência + `tags`/`source_type`.
- **`docs/database.md`:** nota de `knowledge_base_items.embedding` (§4.2) atualizada para refletir a recomendação acima. **Nenhuma migration nova necessária** — a tabela já existe desde a Missão 2 (migration `0002_conheca_sua_empresa.sql`).
- **`docs/flows.md`:** novo Fluxo 11 — "Ensine sua Empresa para a IA", cobrindo upload de arquivo (PDF/DOCX/TXT) ou nota manual, extração síncrona de texto, e o critério de retrieval por recência/tags.
- **`docs/ux-design.md`:** §3.3 (KB-1/2/3) detalhado — formatos aceitos, limite de 10MB, estados de upload/extração, itens de onboarding tratados como somente leitura nesta tela.

**Decisão explícita pendente de confirmação antes do código:** adiar `pgvector`/embeddings (ver `architecture.md` §10, item 3, e `database.md` §4.2) — é uma decisão de produto/infra (adiciona ou não um fornecedor novo de embeddings), não só técnica.

**Próximo passo:** após confirmação do dono do produto sobre a decisão de retrieval acima, iniciar a implementação de código da Missão 4.

---

## v1.6 (revisão 13) — 2026-08-03 — Reordenação do roadmap pós-Missão 3 + documentação de prompts

**Status:** aprovado — dono do produto aprovou o encerramento da Missão 3 e definiu a nova ordem do roadmap de implementação, sem mudança de escopo de produto em nenhuma das missões futuras.

**Nova ordem do roadmap (a partir da Missão 4):**
1. **Missão 4 — Ensine sua Empresa para a IA** (Knowledge Base / Learning Engine de ingestão)
2. Trend Engine ("O que está em Alta")
3. Billing (`subscriptions`/`credit_ledger`, hoje só documentados, sem migration)
4. Asset Engine (geração de conteúdo — vídeo, legenda, carrossel etc.)
5. Learning Engine ("O que Funcionou")

Essa ordem já havia sido sugerida no checkpoint técnico pós-Missão 3; o dono do produto a confirmou como a sequência oficial.

**Nova documentação — `docs/prompts/`:** um documento por especialista do Specialist Registry (objetivo, responsabilidades, system prompt, entradas, saídas, exemplos, restrições, critérios de qualidade). Não substitui `docs/engine-behavior.md` (que documenta o comportamento das Engines como um todo) nem o `system_prompt` em produção (que continua sendo dado, na tabela `specialists`) — é a referência oficial para evoluir cada especialista de forma deliberada, com histórico de decisão, em vez de editar o prompt em produção sem registro.

**Tool Registry registrado como evolução arquitetural futura (não implementado):** análogo ao Provider Gateway e ao Specialist Registry — permitiria que qualquer especialista usasse ferramentas externas (busca na web, consulta a APIs, cálculos) de forma plugável, sem hardcode. Ver [architecture.md §11](architecture.md#11-tool-registry-ferramentas-plugáveis-para-especialistas-★-evolução-futura-não-implementada).

**Próximo passo:** revisão doc-first (PRD/architecture/database/flows/ux-design) da Missão 4 antes de qualquer código, seguindo o mesmo processo já usado nas Missões 2 e 3.

---

## v1.5 (revisão 12) — 2026-08-03 — Validação real da Missão 3 concluída e aprovada

**Status:** aprovado — dono do produto validou o Intelligence Hub em produção (Supabase + Anthropic reais) com foco na qualidade estratégica, não apenas no funcionamento técnico, e aprovou a Missão 3 em nível de arquitetura, implementação e validação funcional.

**O que foi validado:** 5 sessões reais do Intelligence Hub, incluindo um objetivo convergente, um objetivo claramente incompatível com a marca (guerra de descontos) e um objetivo genuinamente ambíguo (desenhado para forçar divergência real entre especialistas). Confirmado: personalidades distintas por especialista, divergência real capturada e resolvida pelo Coordinator (nunca média das opiniões), justificativa sempre ancorada em campos específicos do Brand Brain, e degradação graciosa em falha (parcial ou total).

**Bug encontrado e corrigido antes da tag `v0.3.0`:** o especialista de Branding falhava sistematicamente por truncamento de resposta (`maxTokens: 512` insuficiente para um prompt sem limite de frases, ao contrário do de Marketing). Corrigido no código (`maxTokens` → 1024) e reforçado nos prompts de Branding/Copy via migration `0005_intelligence_hub_prompt_fixes.sql`. Ver [CHANGELOG.md](../CHANGELOG.md) `[0.3.0]` para o detalhamento técnico completo.

**Decisão explícita do dono do produto:** o bug de citações trocadas na tela "O que eu entendi até agora" (Missão 2, já lançada como `v0.2.0`), encontrado incidentalmente ao montar a marca de teste para esta validação, **não foi corrigido agora** — fica registrado como tarefa isolada para uma missão de manutenção dedicada, para não misturar uma correção de Missão 2 dentro da tag de Missão 3.

**Sugestões registradas para a Missão 4 (não bloqueiam a aprovação):** retry com backoff no Provider Gateway para falhas de conexão transitórias; revelação progressiva das opiniões dos especialistas (a espera em bloco de ~45s em média começa a incomodar).

**Próximo passo:** checkpoint técnico atualizado pós-Missão 3, aguardando autorização do dono do produto para iniciar a Missão 4.

---

## v1.4 (revisão 11) — 2026-08-03 — Missão 3 implementada: Specialist Registry e primeiro Intelligence Hub funcional

**Status:** aprovado e implementado — escopo ampliado pelo dono do produto após aprovar o design do Specialist Registry: em vez de só a infraestrutura, a Missão 3 entrega um Intelligence Hub funcional de ponta a ponta (3 especialistas + Coordinator + tela "Criar Campanha").

**Motivação:** validar o Intelligence Hub como cérebro estratégico da plataforma antes de investir em geração de conteúdo — "Não quero geração de conteúdo ainda... Quero apenas validar o funcionamento do Intelligence Hub".

**O que foi implementado:**

- **Migration `0004_intelligence_hub.sql`:** tabelas `specialists` (Specialist Registry), `intelligence_hub_sessions`, `specialist_opinions`, `campaigns`; `provider_configs.specialist_type` (enum) substituída por `specialist_id` (FK). Seed inicial: especialistas `marketing_strategy`, `branding`, `copywriting` (todos `applies_to = ['campaign_strategy']`) + 1 `coordinator`.
- **`packages/types`:** enums `SpecialistRole`, `SpecialistStatus`, `IntelligenceHubRelatedEntityType`, `IntelligenceHubSessionStatus`, `CampaignStatus`; tipos Row/Insert/Update das 4 tabelas. Removido o antigo enum hardcoded `SpecialistType`.
- **`packages/core`:** `SpecialistRepository` (`findApplicable`/`findCoordinator`), `IntelligenceHubSessionRepository`, `SpecialistOpinionRepository`, `CampaignRepository`; `ProviderConfigRepository`/`resolveLlmProvider` passam a resolver por `specialist_id` opcional (fallback para configuração genérica do tier); módulo `intelligence-hub/` com `runSpecialistPanel` (painel em paralelo via `Promise.allSettled` — falha de um nunca bloqueia os demais nem o Coordinator) e `runCoordinator` (consolidação, sempre com `rationale` — Princípio do Consultor Permanente); `runCampaignStrategySession` orquestra tudo (Fluxo 10 completo para o gatilho `campaign_strategy`).
- **UI:** item de navegação "Criar Campanha" (antes "em breve") passa a `implemented: true`; nova tela em `/criar-campanha` — objetivo de campanha em texto livre → opiniões individuais dos 3 especialistas → estratégia consolidada do Coordinator com o bloco "Por que fiz assim?" → aprovação explícita (nunca automática).
- **`docs/database.md`/`docs/flows.md`:** atualizados de "planejado, sem migration" para "implementado" — ver notas de revisão 11 em cada documento.

**Fora de escopo desta missão (mantido conforme combinado):** nenhuma geração de conteúdo; gatilho `trend_ranking` (Fluxo 2) ainda não ligado ao Intelligence Hub, pois o Trend Engine em si não existe; demais especialistas (além dos 3 iniciais) ficam para próximas missões, adicionados como dado no Specialist Registry, sem mudança de arquitetura.

**Verificação:** `pnpm -r typecheck`, `pnpm -r lint` e `pnpm -r build` passam em todo o workspace (`@ayon/types`, `@ayon/ui`, `@ayon/core`, `web`).

---

## v1.3 (revisão 10) — 2026-08-03 — Specialist Registry e reordenação do roadmap

**Status:** aprovado — dono do produto decidiu reordenar o roadmap: a próxima missão de implementação passa a ser a infraestrutura de especialistas plugáveis do Intelligence Hub, não "Ensine sua empresa para a IA".

**Motivação:** antes de implementar qualquer parte do Intelligence Hub, o dono do produto quer que os especialistas (e o Coordinator) sejam **dados configuráveis, nunca papéis hardcoded** — cada especialista com identidade, objetivo, system prompt, capacidade de Provider Layer, aplicabilidade, prioridade e parâmetros configuráveis, resolvidos em runtime por um "Specialist Registry" análogo ao Provider Gateway. Também foi pedida uma documentação técnica nova, específica para descrever o **comportamento de IA** de cada Core Engine (não estrutura, não processo) — complementar ao PRD, nunca substituto.

**O que mudou:**

- **`docs/architecture.md`:** nova §4.1 — **Specialist Registry**: especialistas e Coordinator deixam de ser um enum fixo no código (`marketing`, `copywriting`, etc.) e passam a ser linhas na tabela `specialists`, com os 7 atributos pedidos (identidade → `name`; objetivo → `objective`; system prompt → `system_prompt`; provider → `provider_capability`; capabilities → `applies_to`; prioridade → `priority`; parâmetros configuráveis → `parameters`). Resolve, na prática, a decisão em aberto PRD §13.1. §3.4/§4/§5.1/§10 atualizadas para refletir a resolução por registry em vez de lista fixa.
- **`docs/database.md`:** nova tabela `specialists` (§4.4, ainda **sem migration** — planejada para a implementação da Missão 3), sem RLS de usuário final (mesmo padrão de `provider_configs`). `provider_configs.specialist_type` e `specialist_opinions.specialist_type` (enums fixos) passam a `specialist_id` (FK → `specialists`) — mudança de schema também pendente de migration.
- **`docs/flows.md`:** Fluxo 10 (passos 1, 3, 4) reescrito — resolução de especialistas via consulta ao Specialist Registry filtrada por `applies_to`, não mais uma lista fixa de 7 papéis.
- **`PRD.md`:** §13, item 1, marcado como resolvido arquiteturalmente (o mecanismo agora é configurável; o conteúdo — quais especialistas existem de fato — continua sendo decisão de produto/seed a aprovar na Missão 3).
- **`docs/engine-behavior.md`** (novo documento): comportamento de IA esperado de cada Core Engine (Brand Brain, Intelligence Hub, Trend Engine, Asset Engine, Learning Engine) — tom, princípios de raciocínio, o que nunca deve acontecer. Não substitui o PRD; é a referência de estilo para quem escreve `system_prompt`s, incluindo os do Specialist Registry.
- **`README.md`:** estrutura e "por onde começar a ler" atualizados com o novo documento; estado do projeto atualizado.

**Fora de escopo desta revisão:** nenhuma migration foi criada, nenhum código foi escrito — `specialists` e a mudança de `provider_configs`/`specialist_opinions` são schema planejado, a implementar na Missão 3.

**Decisões pendentes de aprovação:** seed inicial do Specialist Registry (quais especialistas, quais `system_prompt`s exatos — architecture.md §10, item 7); comportamento de Trend/Asset/Learning Engine descrito em `engine-behavior.md` ainda não validado com IA real (ao contrário do Brand Brain).

**Próximo passo:** implementação de código da Missão 3 — infraestrutura do Specialist Registry (migration, tipos, repository, resolução em `packages/core`), sem ainda construir o painel completo de 7 especialistas — isso fica para a missão seguinte do Intelligence Hub.

---

## v1.2 (revisão 9) — 2026-08-02 — Revisão técnica final pré-Missão 2

**Status:** aprovado — filosofia de produto consolidada; documentação liberada como fonte oficial da verdade; início da implementação de código autorizado.

**Motivação:** antes de iniciar a implementação de código da Missão 2, auditoria técnica cruzada entre PRD/architecture/database/flows/ux-design, buscando inconsistências, requisitos duplicados/contraditórios/inviáveis e riscos técnicos — não refinamento de filosofia.

**Problemas encontrados e resolvidos (todos ajustes cirúrgicos, sem mudança estrutural):**
1. **Persona da Ayon** (PRD §13.8, ux-design §10.7) — a documentação já usava "Ayon" como nome em toda a copy de exemplo, mas listava a persona como decisão em aberto. Resolvido: Ayon é o nome, oficialmente.
2. **Síncrono vs. assíncrono** (PRD §13.7) — a conversa já estava 100% especificada como chat em tempo real com retomada em `ux-design.md §4.2`/`architecture.md §6`, mas o PRD ainda listava isso como pergunta em aberto. Resolvido: síncrono, com persistência por resposta.
3. **n8n vs. latência da conversa** — `architecture.md §8` listava "conversa de onboarding → Brand Brain" como um dos processos orquestrados pelo n8n, o que colidiria com o alvo de reação de 800ms–1.5s especificado em `ux-design.md §4.2` (round-trip de webhook é incompatível com essa latência). Esclarecido: cada turno é uma chamada direta Server Action → LLM Provider; n8n fica restrito a passos verdadeiramente assíncronos do fluxo (extração/gravação em `knowledge_base_items`, síntese final).
4. **Consumo de créditos durante o onboarding** — `flows.md` Fluxo 6 não isentava a conversa "Conheça sua empresa" do bloqueio por saldo insuficiente, o que poderia travar um cliente novo no meio da primeira conversa com o produto, antes de qualquer geração paga. Esclarecido: a conversa de onboarding não consome créditos; consumo começa no Fluxo 2 (Intelligence Hub) em diante.
5. **Extração de campos por turno** — `flows.md` Fluxo 1 (passo 4) e `architecture.md §6` presumiam implicitamente 1 resposta → 1 campo, mas a conversa por temas (§4.2) frequentemente cobre mais de um campo estruturado por troca (ex: concorrência + diferenciais juntos). Esclarecido: uma resposta pode gerar registros para múltiplos `question_key` na mesma rodada.

**Fora de escopo:** nenhuma tabela, tela ou princípio novo — apenas resolução de ambiguidades já existentes entre os documentos.

**Próximo passo:** início imediato da implementação de código da Missão 2 ("Conheça sua empresa"). A partir de agora, qualquer alteração de documentação deve ser motivada por necessidade descoberta durante o desenvolvimento, não por refinamento teórico.

---

## v1.2 (revisão 8) — 2026-08-02 — Consolidação do Princípio do Consultor Permanente

**Status:** **aprovado** — dono do produto consolidou a filosofia da Ayon com esta revisão; próximas mudanças estruturais na filosofia só após a implementação da Missão 2.

**Motivação:** antes de congelar a filosofia de produto definida na revisão 7, o dono do produto pediu que três princípios adicionais fossem verificados e, quando já implícitos, registrados explicitamente como regras permanentes: (1) memória de longo prazo (não só da conversa atual, mas de decisões/campanhas/aprendizados anteriores); (2) toda decisão estratégica importante ter uma justificativa consultável através de um bloco nomeado "Por que fiz assim?"; (3) nenhum conteúdo poder ser criado sem passar pelo Brand Brain. Os três já estavam parcialmente contemplados pela revisão 7 — esta revisão os torna explícitos, nomeados e, no caso do item 3, uma regra inegociável no mesmo nível da aprovação humana do Learning Engine.

**O que mudou:**

- **`PRD.md`:** §1.1 — item 3 (memória espontânea → **memória de longo prazo**, escopo explícito: campanhas e aprendizados anteriores); item 6 (justificativa) nomeia o bloco **"Por que fiz assim?"** como affordance padrão; novo item 7 — regra inegociável de que nenhum conteúdo nasce sem passar pelo Brand Brain. Documento marcado como aprovado para a seção §1.1 especificamente (demais decisões em §13 seguem em aberto).
- **`docs/architecture.md`:** §1.1 ganha duas novas regras técnicas — contexto de entrada do Intelligence Hub/Asset Engine inclui explicitamente histórico de `campaigns` e `learning_insights` aplicados (não só o Brand Brain do instante); e a regra inegociável do "portão" do Brand Brain (nenhum caminho de geração pula esse carregamento). §3.4, §3.5 e §4 atualizadas para refletir ambas.
- **`docs/database.md`:** sem tabelas/colunas novas — notas explícitas em `intelligence_hub_sessions` (contexto inclui `campaigns`/`learning_insights`), em `content_pieces.brand_rationale` (dado-fonte do "Por que fiz assim?") e em `campaigns.intelligence_hub_session_id` (NOT NULL de propósito, materializando a regra do portão obrigatório).
- **`docs/flows.md`:** Fluxo 10 (passo 2) explicita a memória de longo prazo no contexto montado; Fluxo 3 ganha nota da regra inegociável do portão do Brand Brain.
- **`docs/ux-design.md`:** §1.1 — item 8 expandido (memória de longo prazo), item 11 expandido (nomeia "Por que fiz assim?"), novo item 12 (nenhum atalho de geração rápida pula o Brand Brain). §4.11 (Bloco de Justificativa de Marca) formaliza a affordance em duas camadas: justificativa curta sempre visível + link nomeado "Por que fiz assim?" para o raciocínio completo. §4.1 (Painel de Especialistas) ganha comportamento 5, citando campanhas/aprendizados anteriores quando relevante.

**Fora de escopo desta revisão:** nenhuma tela, tabela ou fluxo novo além dos ajustes de linguagem/comportamento acima.

**Decisões pendentes de aprovação (não relacionadas à filosofia, seguem em aberto):** ver PRD.md §13, architecture.md §10, database.md §10, ux-design.md §10.

**Próximo passo:** com a filosofia da Ayon consolidada, a implementação de código da Missão 2 ("Conheça sua empresa") pode começar assim que o dono do produto autorizar explicitamente o início do trabalho de código.

---

## v1.1 (revisão 7) — 2026-08-02 — Princípio do Consultor Permanente

**Status:** aguardando aprovação

**Motivação:** durante o desenho de UX da Missão 2 ("Conheça sua empresa"), a experiência conversacional evoluiu em três iterações dentro da mesma sessão — de "entrevista com reflexo de bloco" para "conversa com consultor" e, por fim, para uma mudança de posicionamento de produto: a Ayon nunca deve parecer uma IA fazendo perguntas ou preenchendo um cadastro; ela deve parecer um consultor estratégico permanente que entrou para a equipe da empresa. Esse não é um ajuste de copy do onboarding — é um princípio permanente que rege toda saída de IA do produto (estratégias, roteiros, vídeos, carrosséis), e foi registrado como tal antes de iniciar a implementação da Missão 2.

**O que mudou:**

- **`PRD.md`:**
  - Nova §1.1 — **Princípio do Consultor Permanente**: 6 regras permanentes (nunca sensação de formulário/entrevista; reação antes de seguir; memória espontânea; progresso é conhecimento, não contagem; encerramento é integração de equipe; toda saída de IA se justifica pela marca).
  - §4.1 (Intelligence Hub) e §4.3 (pacote de conteúdo) ganham notas de que a saída sempre inclui justificativa em linguagem de negócio.
  - §4.5 (Onboarding Conversacional) reescrita — não é mais "entrevista conduzida pela IA".
  - §7 (diferenciais), §11 (métricas) e §13.7 (decisão em aberto) atualizados; novos itens §13.8 (persona da Ayon: nome próprio ou primeira pessoa sem nome?) e §13.9 (atalho de contexto por link de site/Instagram).
  - Palavra "entrevista" removida de todo o corpo vivo do documento.

- **`docs/architecture.md`:**
  - Nova §1.1 — **Princípio Consultor Permanente: Justificativa Fundamentada em Marca** — traduz o princípio de produto em exigência técnica: toda saída do Intelligence Hub e do Asset Engine carrega uma justificativa em linguagem de negócio ancorada no Brand Brain.
  - §3.1/3.2/3.4/3.5 e §6 atualizadas com a exigência de justificativa e memória; §6 renomeada de "Onboarding Conversacional (arquitetura)" para "Conversa de Onboarding (arquitetura)" e reescrita para descrever comportamento de reação/memória, não sequência de perguntas.
  - Palavra "entrevista" removida do corpo vivo (mantida apenas em notas históricas de revisões anteriores).

- **`docs/database.md`:**
  - Nova coluna `content_pieces.brand_rationale` (justificativa de marca por peça, exibida no Cartão de Revisão).
  - `specialist_opinions.opinion` e `intelligence_hub_sessions.consolidated_result` passam a exigir, na estrutura jsonb, uma chave `rationale` (decisão em aberto §10.2 parcialmente resolvida).
  - Enum `knowledge_base_items.source_type`: `onboarding_interview` renomeado para `onboarding_conversation`.
  - Comentários de `brands`, `brand_brain_profiles` e `brand_onboarding_answers` atualizados para remover "entrevista".

- **`docs/flows.md`:**
  - Fluxo 1 (passos 2–3) reescrito: a Ayon reage a cada resposta antes de seguir, e toda transição de tema a partir do segundo inclui uma conexão espontânea com algo já dito.
  - Fluxo 2 (passo 9), Fluxo 3.1, Fluxo 4 (passo 1) e Fluxo 10 (passos 3–4) atualizados para gerar/exibir a justificativa em linguagem de negócio.
  - Palavra "entrevista" removida do corpo vivo do documento.

- **`docs/ux-design.md`:**
  - §1 ganha a subseção **1.1 — Princípio do Consultor Permanente (aplicado à interface)**, com 6 novas regras de UX.
  - §3.2 (telas ONB) reescrita: ONB-1 "Convite para a conversa" (era "Boas-vindas à entrevista"), ONB-2 "Conversa com o Consultor" (era "Entrevista (chat)"), ONB-3 "O que a Ayon entendeu até agora" (era "Resumo gerado").
  - §4.2 (componente da conversa) totalmente reescrito: 5 temas nunca expostos como etapas, reação obrigatória a cada turno (micro-reação + reflexo de tema com callback obrigatório), correção imediata, entrada opcional de link de site/Instagram, retomada com recapitulação específica (nunca "pergunta X de Y"), encerramento em duas etapas (checagem de entendimento → mensagem de integração de equipe).
  - Novo §4.10 — **Painel "O que a Ayon já sabe"**: substitui qualquer indicador de progresso por contagem; cresce com insights sintetizados, cabeçalho muda qualitativamente.
  - Novo §4.11 — **Bloco de Justificativa de Marca**: componente reutilizável aplicado a CAMP-2 (§4.1), CAMP-3, CAMP-5 (§4.6) e TREND-2.
  - §2.1 (sitemap), §3.1 (nota AUTH-3), §6 (microinterações) e §8 (responsividade) atualizados para remover "entrevista" e refletir os novos componentes.
  - §10 ganha 3 novos itens: persona da Ayon, atalho de contexto por link, e se o painel "O que a Ayon já sabe" fica sempre visível ou é sob demanda.

**Fora de escopo desta revisão:** nenhuma tela nova além das já previstas para a Missão 2; nenhuma mudança de stack ou de modelo de dados além dos campos citados acima.

**Decisões pendentes de aprovação:** ver PRD.md §13 (itens 7–9), architecture.md §10, database.md §10, ux-design.md §10 (itens 7–9).

**Próximo passo:** revisão de alinhamento entre todos os documentos (ver entrada seguinte, se aplicável) e aprovação do dono do produto antes de iniciar a implementação de código da Missão 2.

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
