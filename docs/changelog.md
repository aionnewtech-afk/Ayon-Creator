# Changelog de Documentação — Ayon Creator

> Todo pedido de nova funcionalidade gera uma entrada aqui, junto com as atualizações correspondentes em PRD.md, architecture.md, database.md e flows.md. Nenhuma implementação é feita sem uma entrada aprovada aqui.

---

## v2.4 (revisão 21) — 2026-08-03 — Missão 6 implementada e validada (Billing)

**Status:** implementado e validado com Supabase + Mercado Pago reais (sandbox) — aguardando decisão do dono do produto sobre commit/tag/changelog de release (mesmo processo de fechamento das Missões 2-5.

**O que foi implementado:**

- **Migrations:** `0008_billing.sql` (`subscriptions`, `credit_ledger`, `credit_pricing` com seed 1/2/4 e 5/10/20, `credit_packages` com seed de 3 pacotes), `0009_drop_organizations_plan.sql` (remove coluna morta desde a Sprint 1, nunca usada em código — `subscriptions.plan` passa a ser a única fonte da verdade), `0010_plans.sql` (**nova tabela, achado durante a implementação** — ver abaixo).
- **`packages/core`**: `SubscriptionRepository`, `CreditLedgerRepository`, `CreditPricingRepository`, `CreditPackageRepository`, `PlanRepository`; `OrganizationRepository` ganhou `update` (não existia). Módulo `billing/`: `mercado-pago-client.ts` (adapter sobre o SDK oficial `mercadopago`, fora do barrel de `@ayon/core` pelo mesmo motivo de `pdf-parse` — depende de Node, quebraria bundle de Client Component), `credit-gate.ts` (`ensureSufficientCredits`/`recordConsumption`, exportado no barrel), `mercado-pago-webhook-handler.ts` (processa `payment` e `subscription_preapproval`, fora do barrel).
- **Server Actions**: `createCampaignStrategyAction`/`runTrendDiscoveryAction` ganharam o portão de crédito (checagem antes, débito só após sucesso); novo `apps/web/app/(platform)/configuracoes/actions.ts` (`subscribeToPlanAction`, `buyCreditsAction`), gated a `admin+`.
- **UI**: `/configuracoes` (CFG-2 + CFG-4 numa página só — planos com preço/créditos/marcas, saldo, pacotes avulsos, histórico), link de bloqueio "Ir para Configurações" em Criar Campanha e O que está em Alta. Nav "Configurações" passa a `implemented: true`, `minRole: admin`.
- **Webhook**: `apps/web/app/api/webhooks/mercado-pago/route.ts`, assinatura validada via `WebhookSignatureValidator` do SDK oficial antes de processar qualquer payload.
- **Dependência nova**: `mercadopago` (SDK oficial, `^3.2.1`).

**Achado durante a implementação (fora do doc-first original) — nova tabela `plans`:** o handler de webhook (`packages/core`, nunca importa de `apps/web`) precisa saber quantos créditos conceder por plano na ativação — mas isso vivia só em `apps/web/config/plans.ts` (hardcoded, inacessível ao pacote core). Resolvido criando `plans` (migration `0010`) como fonte única da verdade para os números de cada plano (créditos/mês, marcas, tier, preço), lida tanto pelo webhook handler quanto pela UI — mesmo padrão de dado-não-código já usado em `credit_pricing`/`credit_packages`/`provider_configs`/`specialists`. `apps/web/config/plans.ts` foi reduzido a só rótulos/descrições de UI.

**Validado com Supabase + Mercado Pago reais (sandbox)** — marca de teste "Clínica Bemviver", organização "Clinica Bemviver":

- Criação real de assinatura (Preapproval) e preferência de compra (Preference) via UI — `init_point` genuíno do Mercado Pago, `back_url`/`notification_url` validados pela API real (erro real de formato capturado e corrigido: `NEXT_PUBLIC_APP_URL` local não é aceito como `back_url`, documentado como limitação de teste, não bug de produção).
- Processamento do webhook de assinatura contra um Preapproval real: transição `pending → past_due` (sem conceder crédito, correto) e `→ active` (grant_plan de 500 créditos para o plano Pro, correto).
- Portão de crédito bloqueando corretamente por saldo insuficiente e por assinatura inativa, com CTA "Ir para Configurações" nos dois casos, testado nas duas Server Actions (Criar Campanha e O que está em Alta).
- Consumo de crédito debitado corretamente após sessão bem-sucedida do Intelligence Hub, vinculado à sessão certa.
- Idempotência de webhook confirmada contra o constraint real do Postgres (`credit_ledger_external_payment_id_key`, erro `23505` na segunda tentativa).
- UI de `/configuracoes` conferida visualmente (planos, saldo, "Plano atual" desabilitado corretamente, histórico).

**Limitação de escopo da validação, documentada com transparência:** o Mercado Pago exige que **tanto vendedor quanto comprador sejam contas de teste dedicadas** para completar um checkout de sandbox de ponta a ponta — a conta vendedora usada (token `TEST-...` de uma conta real em modo de teste) não se qualifica, e criar uma conta vendedora de teste completa exige configuração adicional no painel do Mercado Pago (fora do escopo desta sessão). Por isso, o ramo "pagamento aprovado/assinatura autorizada" do webhook foi validado por injeção direta do handler real (`handleMercadoPagoWebhook`) contra um Preapproval real (para o mapeamento pending→past_due) e por chamada direta às mesmas repositories reais que o handler usa (para o ramo active→grant_plan+sync de tier, incluindo o bug abaixo) — nunca por um payload inventado à mão. O transporte HTTP do webhook em si (assinatura `x-signature`) usa a implementação oficial do SDK do Mercado Pago, não código próprio.

**Bug encontrado e corrigido durante a validação:**

- **`organizations.provider_tier` nunca sincronizado com o plano ativo.** PRD §8 promete "Pro inclui tier Balanceado", "Business inclui tier Premium" — mas nada no código atualizava `organizations.provider_tier` quando uma assinatura era ativada. Reproduzido ao vivo: assinatura Pro ativada, primeira campanha debitou 5 créditos (preço de tier Econômico) em vez de 10 (preço de tier Balanceado) porque a organização continuava com o tier padrão da Sprint 1. Corrigido em `mercado-pago-webhook-handler.ts` — `activatePlan` (renomeado de `grantPlanCredits`) agora também atualiza `organizations.provider_tier` para o `tier_included` do plano, na mesma transição que concede os créditos. Confirmado corrigido: segunda campanha de teste debitou os 10 créditos corretos.

**Achado incidental de infraestrutura, sem relação com o código da Missão 6:** o projeto tem dois arquivos `.env.local` (raiz e `apps/web/.env.local`), mantidos manualmente em sincronia — `apps/web/.env.local` é o que o `next dev` de fato lê. Isso já existia desde a Sprint 1, mas causou confusão real durante esta validação (as credenciais do Mercado Pago foram adicionadas só na raiz primeiro). Registrado aqui para consciência futura, não corrigido nesta missão (mudar isso é decisão de tooling, não de produto).

**Próximo passo:** aguardando decisão do dono do produto — commit das funcionalidades, commit separado da correção encontrada na validação, tag `v0.6.0`, atualização do `CHANGELOG.md` raiz, e autorização para a próxima missão (Asset Engine).

---

## v2.3 (revisão 20) — 2026-08-03 — Preparação doc-first da Missão 6 (Billing)

**Status:** documentação pronta — **aguardando confirmação final do dono do produto antes do código**, seguindo o mesmo processo doc-first já usado nas Missões 2-5.

**Auditoria prévia — o que já existia:** `subscriptions`/`credit_ledger`/`credit_pricing` já documentadas desde a revisão 2 (só `credit_pricing` como placeholder, "a desenhar"); Fluxo 6 já existia em esqueleto; CFG-1 a CFG-6 já especificadas desde a revisão 4, incluindo CFG-2 (Plano e Cobrança) e CFG-4 (Créditos e Uso). Nunca existiu nenhuma menção a um gateway de pagamento concreto em nenhum documento.

**Duas inconsistências encontradas e resolvidas antes de escrever qualquer doc final:**

1. **Colisão de nomes:** o pedido inicial da Missão 6 nomeava os planos como Starter/**Premium**/Business, mas todos os documentos existentes (PRD §8, `database.md` §8, `ux-design.md` CFG-2, o enum `subscriptions.plan`) já usam **"Pro"** para o plano do meio — e "Premium" já é o nome do tier de qualidade mais alto (Econômico/Balanceado/**Premium**), um conceito diferente. **Decisão do dono do produto: manter "Pro"** — zero retrabalho de documentação, zero ambiguidade entre plano de assinatura e tier de qualidade de IA.
2. **Nenhuma decisão de arquitetura para pagamento:** a regra de modularidade/vendor-agnostic do produto (Provider Layer) nunca havia sido testada contra um gateway de pagamento, que é estruturalmente diferente de LLM/Avatar/Voice (checkout, webhooks e ciclo de assinatura são específicos do fornecedor, não escondíveis atrás de um contrato genérico do mesmo jeito). **Decisão do dono do produto: módulo de Billing dedicado, fora do Provider Layer e fora dos Core Engines** — ver [architecture.md §12](architecture.md#12-billing-módulo-dedicado-★-novo-missão-6).

**Números de negócio propostos e aprovados (com um ajuste do dono do produto sobre a proposta inicial):**

- **Créditos/mês por plano:** Starter 100, Pro 500, Business 1.500 (dono do produto aumentou os valores propostos inicialmente — 30/150/400 — para dar mais fôlego de uso).
- **Preço em créditos por operação:** `trend_ranking` 1/2/4 (Econômico/Balanceado/Premium), `campaign_strategy` 5/10/20 — **mantidos exatamente como propostos**. Princípio explícito do dono do produto: "o maior consumo de créditos deve ficar concentrado no Asset Engine (carrosséis, vídeos, avatar, imagens etc.), não no raciocínio da IA" — incentivar uso intenso do Intelligence Hub, cobrar principalmente pelo que tem custo computacional real (geração de mídia, ainda não implementada).
- **Marcas por plano:** 1 em Starter/Pro, até 5 em Business, sem cobrança incremental por marca extra por enquanto.
- Sem contador de cota separado: o limite de cada plano é só o tamanho do `grant_plan` de créditos — um único mecanismo (`credit_ledger`) cobre tanto o "limite" do Starter quanto o "ilimitado sujeito a fair use" do Pro/Business.

**O que mudou nos documentos:**

- **`docs/architecture.md`:** nova §12 — módulo de Billing (Mercado Pago: Preapproval para assinaturas, Checkout Pro para créditos avulsos; portão de crédito obrigatório antes de qualquer sessão do Intelligence Hub, enforçado na Server Action, nunca dentro do Core Engine; idempotência de webhook via `credit_ledger.external_payment_id` único, sem tabela nova de eventos). Novos itens 10-11 em §10 (cobrança por marca extra, tratamento de downgrade/cancelamento — este último com proposta pendente de confirmação: créditos já concedidos no ciclo corrente não são revogados retroativamente).
- **`docs/database.md`:** §7 finalizada — `subscriptions`/`credit_ledger` com colunas ajustadas (`related_intelligence_hub_session_id` no lugar de `related_content_piece_id`, que não existe; `external_payment_id` único); `credit_pricing` com chave `trigger_reason` + `tier` (não `capability` + `tier` — `campaign_strategy` e `trend_ranking` usam a mesma capability `llm` mas custam diferente) e seed concreto; nova tabela `credit_packages` (catálogo de créditos avulsos, dado não hardcoded). §8 (RLS) ganha notas para as 4 tabelas novas — todas de escrita restrita a service role, nunca o client gravando saldo diretamente.
- **`PRD.md`:** §8 finalizada com a tabela de planos completa; resolve o item 5 de §13 (decisão em aberto desde a revisão 2). Mercado Pago adicionado à stack (§10).
- **`docs/flows.md`:** Fluxo 6 finalizado (checagem antes/cobrança só após sucesso, nunca após falha); novo Fluxo 12 (assinatura e compra de créditos via Mercado Pago), deixando explícito que o webhook — não o redirect do navegador de volta à aplicação — é a fonte de verdade do pagamento.
- **`docs/ux-design.md`:** CFG-2/CFG-4 detalhadas com os estados reais do Mercado Pago; estado global "Créditos insuficientes" ampliado para cobrir também assinatura inativa.

**Última decisão confirmada antes do código:** créditos já concedidos (`grant_plan`) não são revogados retroativamente ao trocar de plano ou cancelar no meio do ciclo — mudança só afeta o próximo ciclo (architecture.md §10, item 11, resolvido).

**Próximo passo:** aguardando aprovação explícita do dono do produto para iniciar a implementação de código da Missão 6.

---

## v2.2 (revisão 19) — 2026-08-03 — Missão 5 implementada e validada (O que está em Alta / Trend Engine)

**Status:** implementado e validado com Supabase + Anthropic reais — aguardando decisão do dono do produto sobre commit/tag/changelog de release (mesmo processo de fechamento das Missões 2, 3 e 4).

**O que foi implementado:**

- **Migration `0006_trend_engine.sql`:** tabela `trend_research` (schema idêntico ao já especificado desde a revisão 2); FK real de `campaigns.trend_research_id`; seed de `provider_configs` para o capability `trend_source` (3 tiers, mesmo `provider_key` da Anthropic); `applies_to` de `marketing_strategy` e `branding` ampliado para incluir `trend_ranking` (Copywriting ficou de fora — mensagem de peça não é decisão de ranqueamento).
- **`packages/core`:** `TrendSourceProvider` (contrato) + `AnthropicWebSearchTrendSourceProvider` (adapter sobre a ferramenta de busca web nativa da API da Anthropic, `web_search_20250305`); `resolveTrendSourceProvider` no Provider Gateway; `TrendResearchRepository`; módulo `trend-engine/` (`trend-ranking-prompts.ts`, `run-trend-ranking-panel.ts`, `run-trend-coordinator.ts`, `trend-engine.ts` com `runTrendDiscovery`) — mesmo padrão de orquestração do Intelligence Hub (Missão 3), adaptado para `trend_research` em vez de `campaigns`.
- **Server Actions** (`apps/web/app/(platform)/o-que-esta-em-alta/actions.ts`): `runTrendDiscoveryAction`, gated a `editor+` para disparar busca, leitura liberada a qualquer papel.
- **UI:** TREND-1 (lista de tendências ranqueadas) e TREND-2 (detalhe com "Por que fiz assim?" e link para a fonte), como estados dentro do mesmo componente cliente (`trend-list.tsx`) — não como rotas separadas, já que candidatos de tendência não têm `id` próprio no schema (vivem dentro do jsonb `trend_research.summary`). Handoff para "Criar Campanha" com o tema pré-preenchido via query string (`?tema=`), completando a navegação TREND-2 → CAMP-1 de `ux-design.md`. Nav "O que está em Alta" passa a `implemented: true`.
- **Dependência:** `@anthropic-ai/sdk` atualizado de `0.32.1` para `^0.65.0` — versão instalada não tinha suporte de tipos para a ferramenta de busca web; upgrade não quebrou nenhum uso existente (`AnthropicLlmProvider`), confirmado por typecheck limpo antes de qualquer mudança de código nova.

**Parada técnica durante a implementação (antes de qualquer código de produto):** ver v2.1 (revisão 18) acima — generalização do `system_prompt` do Coordinator, aprovada pelo dono do produto antes de prosseguir.

**Validado com Supabase + Anthropic reais** (marca de teste "Trilha Verde Turismo", ecoturismo, provisionada via Supabase Admin API para a validação):

- Busca de tendências reais via web (4 candidatos genuínos: crescimento do ecoturismo, disposição a pagar mais por sustentabilidade, Brasil como destino de aventura, turismo + bem-estar), ranqueados pelo painel (Marketing + Branding) + Coordinator, com justificativa ancorada no Brand Brain de teste.
- TREND-2 exibindo "Por que fiz assim?" e link para a fonte.
- Handoff TREND-2 → Criar Campanha com o tema pré-preenchido, confirmado via inspeção do DOM.
- "Buscar novidades" (nova busca sobre uma marca que já tinha `trend_research`) — segundo conjunto de tendências, todas frescas.
- Teste de regressão em Criar Campanha (Missão 3) após a generalização do Coordinator — painel de 3 especialistas + Coordinator consolidando corretamente no formato de estratégia de campanha, sem nenhuma diferença de comportamento.
- Estado do banco inspecionado diretamente: `trend_research`, `intelligence_hub_sessions` (`trigger_reason = trend_ranking`) e `campaigns` (`trigger_reason = campaign_strategy`) todos persistidos corretamente.

**Bugs encontrados e corrigidos durante a validação:**

1. **Coordinator retornava o formato errado para `trend_ranking`:** a generalização do `system_prompt` (revisão 18) delega o formato de saída para a mensagem do usuário de cada tarefa — mas `buildTrendRankingCoordinatorMessage` nunca declarava esse formato explicitamente, só descrevia a tarefa em prosa. Corrigido adicionando a instrução de formato JSON explícita na mensagem. **Achado o mesmo problema, por herança, em `buildCoordinatorUserMessage` (Missão 3)** — só funcionava até aqui porque o `system_prompt` antigo fixava o formato; deixou de funcionar assim que o prompt foi generalizado. Corrigido do mesmo jeito, validado com teste de regressão em Criar Campanha (ver acima). Nenhuma mudança de comportamento visível ao usuário — só corrige uma falha de parsing que teria acontecido na primeira execução real de `campaign_strategy` pós-generalização.
2. **Sessão do Intelligence Hub não marcada como `failed`** quando `runTrendDiscovery` falhava depois da sessão já criada (ex.: erro de parsing do Coordinator) — só `trend_research` era marcado como `failed`, deixando a sessão presa em `running` para sempre. Reproduzido ao vivo pelo bug #1 acima. Corrigido em `trend-engine.ts`: o `catch` agora também marca a sessão como `failed` quando ela existe.

**Próximo passo:** aguardando decisão do dono do produto — commit das funcionalidades, commit separado das correções encontradas na validação, tag `v0.5.0`, atualização do `CHANGELOG.md` raiz, e autorização para a próxima missão (Billing).

---

## v2.1 (revisão 18) — 2026-08-03 — Coordinator generalizado (achado durante a implementação da Missão 5)

**Status:** aprovado — parada técnica durante a implementação de código, conforme regra explícita do dono do produto ("se surgir qualquer inconsistência arquitetural, pare imediatamente, apresente um relatório e aguarde nova aprovação").

**O que foi encontrado:** ao implementar o ranqueamento de tendências (`trend_ranking`), ficou claro que o único Coordinator do Specialist Registry (`SpecialistRepository.findCoordinator()` — "assume-se um único registro com este papel") tinha, desde a Missão 3, um `system_prompt` com formato de saída JSON fixo no próprio texto do prompt (`{"consolidated_strategy", "rationale", "divergences"}`), específico de estratégia de campanha. Isso competiria diretamente com qualquer instrução de formato dada na mensagem do usuário para `trend_ranking`, arriscando falha real de parsing em produção — não uma questão de estilo.

**Três saídas possíveis foram apresentadas ao dono do produto** (reescrever o `system_prompt` para ser agnóstico de formato; permitir mais de um Coordinator no registry, filtrado por tipo de decisão; ou não resolver, deixando `trend_ranking` sem Coordinator funcional). **Aprovada a primeira:** generalizar o `system_prompt` do Coordinator.

**O que mudou:**

- **Migration `0007_coordinator_decision_agnostic.sql`:** `system_prompt` do Coordinator reescrito — comportamento idêntico (nunca faz média, reconhece divergência real, ancora no Brand Brain, trata especialista ausente sem jargão técnico), mas o formato de saída fixo foi removido; o JSON exato esperado agora é definido pela tarefa que invoca o Coordinator, via instrução explícita na mensagem do usuário montada por cada Engine chamador. Nenhuma mudança de schema — um único Coordinator no registry, como antes.
- **`docs/architecture.md`** (revisão 16), **`docs/prompts/coordinator.md`:** atualizados para refletir o novo `system_prompt`, com o antigo preservado como histórico, e a nova seção de Entradas/Saídas organizada por tarefa (`campaign_strategy`, `trend_ranking`).

**Próximo passo:** prosseguir com a implementação de código da Missão 5 (Trend Engine, TrendResearchRepository, Server Actions, telas TREND-1/TREND-2), agora que o Coordinator suporta as duas tarefas.

---

## v2.0 (revisão 17) — 2026-08-03 — Missão 5 aprovada (Trend Engine / "O que está em alta")

**Status:** aprovado — dono do produto confirmou as duas decisões técnicas pendentes e liberou o início da implementação de código, seguindo o mesmo processo doc-first já usado nas Missões 2, 3 e 4.

**Contexto:** ao contrário das missões anteriores, a maior parte da especificação do Trend Engine já existia (schema `trend_research` completo desde a revisão 2, telas TREND-1/TREND-2 em `ux-design.md` desde a revisão 4, Fluxo 2 e comportamento em `engine-behavior.md` §4). Restavam duas lacunas reais impedindo o início do código — ambas resolvidas nesta revisão.

**O que mudou:**

- **`docs/architecture.md`:** §3.3 (Trend Engine) resolvida:
  1. **Trend Source Provider do MVP:** adapter de `trend_source` implementado sobre a ferramenta de busca web nativa da API da Anthropic, resolvido pelo Provider Gateway pelo contrato `(capability: "trend_source", tier)` — o Trend Engine nunca conhece o fornecedor concreto, só o contrato. Candidatos futuros de substituição (sem mudança no Trend Engine, só um novo adapter): Google Trends, SerpAPI, Exploding Topics, Glimpse, Similarweb.
  2. **Sem n8n no Fluxo 2:** confirmado Server Action direta, mesmo padrão já validado nos Fluxos 1, 10 e 11 (Missões 2, 3 e 4) — nenhuma delas precisou de n8n de fato.
  - **Nova regra inegociável (pedida explicitamente pelo dono do produto):** nenhuma tendência entra em estratégia ou é exibida ao usuário sem passar pelo Intelligence Hub. Fluxo obrigatório: Trend Source Provider → Trend Engine → Intelligence Hub → Brand Brain (contexto) → Painel de Especialistas → Coordinator → estratégia final.
  - **§8 (Papel do n8n) reescrita:** deixa explícito que n8n segue não implementado em nenhuma missão até aqui (nem a sessão do Intelligence Hub, nem agora a descoberta de tendências, que a v1.0 original previa para ele) — decisão deliberada de não adicionar infraestrutura antes dela gerar valor real. Papel futuro do n8n mantido, mas restrito a necessidades genuinamente assíncronas ainda não implementadas: geração de vídeo (Asset Engine), processamento de mídia, publicações (pós-MVP), automações longas, integrações externas, workflows agendados.
  - §10, itens 8 e 9, marcados como resolvidos.
- **`docs/flows.md`:** Fluxo 2 reescrito refletindo as três decisões acima (Server Action direta, Provider Gateway para `trend_source`, regra inegociável do Intelligence Hub).
- **`docs/database.md`:** **nenhuma mudança necessária** — `trend_research` já está totalmente especificada desde a revisão 2 e não exige nenhuma migration nova, mesmo padrão de reaproveitamento de schema já visto na Missão 4.
- **`docs/ux-design.md`:** **nenhuma mudança necessária** — TREND-1/TREND-2 já cobrem os estados relevantes (carregando, vazio, erro parcial).
- **`PRD.md`:** revisão 12, aprovada, referenciando as três decisões acima.

**Próximo passo:** implementação de código da Missão 5 — migration de `trend_research` (schema já especificado em `database.md` §4.3, sem mudança), adapter `trend_source` sobre busca web da Anthropic, `TrendResearchRepository`, módulo `trend-engine/` em `packages/core`, Server Actions e telas TREND-1/TREND-2, seguindo o mesmo padrão de validação real (Supabase + Anthropic) das missões anteriores antes de fechar a tag.

---

## v1.9 (revisão 16) — 2026-08-03 — Auditoria técnica pré-Missão 5 e fechamento formal da Missão 4

**Status:** aprovado — auditoria completa do repositório (docs, migrations, código) solicitada pelo dono do produto antes de autorizar a Missão 5 (Trend Engine). Encontradas inconsistências entre documentação e código; corrigidas, sem nenhuma mudança de escopo de produto ou arquitetura.

**Inconsistências encontradas e corrigidas:**
1. `CHANGELOG.md` (raiz) não tinha entrada `[0.4.0]` apesar da Missão 4 estar completa e validada em código — adicionada, espelhando `docs/changelog.md` v1.8.
2. `README.md` ainda descrevia a Missão 4 como roadmap futuro — atualizado para refletir a Missão 4 como implementada; roadmap a partir daqui passa a ser Trend Engine → Billing → Asset Engine → Learning Engine.
3. **`PRD.md` nunca havia sido atualizado para a Missão 4** (permanecia na revisão 10, sem nenhuma menção à Missão 4) — violação da própria ordem de atualização exigida pelo README. Corrigido com a revisão 11.
4. `docs/architecture.md` tinha "Última atualização: 2026-08-02", um dia anterior à própria validação da Missão 4 que o documento já descrevia — corrigido para 2026-08-03.
5. `docs/engine-behavior.md` listava como "em aberto" (§8, item 1) a aprovação dos `system_prompt`s do Specialist Registry, que `architecture.md` e este changelog (v1.6) já registravam como resolvida desde a revisão 13 — corrigido; documento promovido de "aguardando aprovação" para "aprovado".

**Inconsistências menores identificadas, registradas para resolução futura (fora do escopo desta correção):** seed de `provider_configs` ainda resolve o mesmo modelo para os 3 tiers (ligado à decisão em aberto PRD §13.2); ordem de prioridade dos especialistas (`priority DESC`) não declarada explicitamente em nenhum documento; `docs/flows.md` Fluxo 6 (créditos) não sinaliza que ainda não tem implementação, ao contrário de outras seções do mesmo documento; telas de Configurações (`CFG-1` a `CFG-6`) aprovadas em `ux-design.md` mas não construídas, sem nota disso no documento.

**Próximo passo:** com a documentação realinhada ao código, aguardando aprovação explícita do dono do produto para iniciar o processo doc-first da Missão 5 (Trend Engine) — auditoria → relatório → atualização de PRD/architecture/database/flows/ux-design → changelog → aprovação → código.

---

## v1.8 (revisão 15) — 2026-08-03 — Missão 4 implementada e validada (Ensine sua Empresa para a IA)

**Status:** implementado e validado com Supabase real — fechado formalmente com a tag `v0.4.0` (ver revisão 16 acima).

**O que foi implementado:**

- **`packages/core`:** `extract-document-text.ts` (extração síncrona de PDF via `pdf-parse`, DOCX via `mammoth`, TXT direto), `knowledge-source-labels.ts` (rótulos em linguagem de negócio); `KnowledgeBaseItemRepository` ganhou `findById`/`update`/`softDelete`.
- **Server Actions** (`apps/web/app/(platform)/ensine-sua-empresa/actions.ts`): upload de arquivo, nota manual, editar tags, remover (soft delete) — todos gated a `editor+`.
- **UI:** KB-1 (Biblioteca de Conhecimento), KB-2 (Adicionar Conhecimento — arquivo ou nota), KB-3 (Detalhe/edição de tags/remoção). Nav "Ensine sua Empresa para a IA" passa a `implemented: true`.
- **Correção estrutural durante a implementação (não é bug de validação, é uma decisão de arquitetura de módulos):** `extract-document-text.ts` foi **excluído do barrel de exports** de `@ayon/core` porque `pdf-parse` depende de `fs`, e o barrel único (`index.ts`) é importado por Client Components (ex.: `sidebar.tsx`, só por causa de `hasMinimumRole`) — isso quebrava o build do Next.js tentando empacotar `pdf-parse` no bundle do client. Resolvido importando o módulo por caminho direto (`@ayon/core/src/knowledge-base/extract-document-text`) só de onde é realmente usado (a Server Action de upload).

**Validado com Supabase real (upload de PDF, DOCX e TXT reais, nota manual, edição de tags, remoção):**
- Extração de texto correta nos 3 formatos (confirmado lendo `content_text` gravado no banco).
- Arquivo persistido corretamente no bucket `knowledge-base` (path `{organization_id}/{brand_id}/{uuid}-{filename}`, confirmado via listagem do Storage).
- Erro amigável e específico para tipo de arquivo não suportado (testado com PNG).
- Edição de tags e remoção (soft delete, `deleted_at` preenchido, linha preservada) confirmadas via leitura direta do banco.

**Bug encontrado incidentalmente (fora do escopo da Missão 4) — não corrigido de propósito:** `ensureInitialProvisioning` (Sprint 1) tem uma race condition de "check-then-act" sem lock — duas requisições quase simultâneas para o mesmo usuário novo podem criar duas organizações/marcas distintas, ambas com o usuário como owner. Reproduzido ao vivo durante o teste (dois logins de teste próximos no tempo geraram 2 organizations). Dados de teste já limpos; correção registrada como tarefa isolada para não misturar uma correção de Sprint 1 dentro da tag da Missão 4.

**Próximo passo:** aguardando decisão do dono do produto — limpar dados de teste (já feito), commit exclusivo, tag `v0.4.0`, atualização do `CHANGELOG.md` raiz, e autorização para a próxima missão (Trend Engine).

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
