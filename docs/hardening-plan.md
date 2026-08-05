# Plano de Hardening — Ayon Creator (rumo à v1.0)

> **Status:** **Missão H1 (P0 — segurança crítica) encerrada — `v0.8.2`.** **Missão H2 (fundação de qualidade: testes automatizados + CI) implementada, validada e encerrada — `v0.9.0`.** Repositório publicado em `github.com/aionnewtech-afk/Ayon-Creator`, CI rodando no GitHub Actions. H3–H5 seguem como rascunho, aguardando priorização. Este documento é o resultado de uma auditoria completa do repositório (código, migrations, dependências, histórico de `docs/changelog.md`/`CHANGELOG.md`) feita após a conclusão do MVP (Missões 1–8, `v0.8.0`).
> **Metodologia:** cada achado abaixo é verificável — vem de leitura direta de código/schema, `pnpm audit`, ou de um "Observado, não corrigido" já registrado em release anterior (citado com a versão onde foi encontrado). Nenhum item é especulação.
> **Prioridade:** **P0** = bloqueia o lançamento da v1.0 · **P1** = fortemente recomendado antes da v1.0 · **P2** = aceitável adiar para pós-v1.0.
> **Próximo passo:** após sua aprovação, cada item (ou grupo de itens relacionados) vira uma missão pequena e isolada, seguindo o mesmo processo doc-first + validação real já usado em todas as missões anteriores.

---

## Resumo executivo

O MVP está funcionalmente completo — os 6 Core Engines (Brand Brain, Trend Engine, Intelligence Hub, Asset Engine, Learning Engine, Knowledge Base) estão implementados e cada um foi validado manualmente com Supabase + Anthropic reais. Essa mesma disciplina de validação, porém, nunca foi automatizada: **não existe um único teste automatizado, nem um único pipeline de CI, em todo o repositório.** Toda garantia de qualidade até aqui depende de alguém lembrar de rodar `typecheck`/`lint`/`build` e de refazer manualmente, do zero, uma bateria de cliques no browser a cada nova missão.

Os achados mais graves não são de funcionalidade — são de **fundação**: duas race conditions reais (uma já reproduzida ao vivo, criando organizações duplicadas), uma policy de Storage que permite a um usuário `viewer` escrever arquivos que a aplicação pretende restringir a `editor+`, zero índices de banco além de um, e 25 vulnerabilidades de dependência conhecidas (10 `high`) concentradas quase todas no Next.js desatualizado — justamente o framework por trás de toda a camada de Server Actions que este produto usa em todo lugar.

Nenhum desses itens exige rearquitetura. São, na maioria, correções pequenas e isoladas — mas coletivamente são exatamente o tipo de coisa que devia estar resolvido **antes**, não depois, de uma v1.0 pública.

---

## 1. Bugs conhecidos

| # | Bug | Prioridade | Evidência |
|---|---|---|---|
| 1.1 | **Race condition no Provisionamento Inicial** (`ensureInitialProvisioning`) — checagem "check-then-act" sem lock. Duas requisições quase simultâneas do mesmo usuário novo podem criar 2 `organizations`/`brands` distintas, ambas com o usuário como owner. | **P0** | Reproduzido ao vivo durante a validação da Missão 4 (`CHANGELOG.md [0.4.0]`, "Observado, não corrigido"). Nunca corrigido desde então. |
| 1.2 | **Race condition no portão de crédito** (`ensureSufficientCredits` → operação → `recordConsumption`) — mesmo padrão check-then-act, sem transação/lock. Duas requisições concorrentes da mesma organização perto do limite de saldo podem ambas passar na checagem antes de qualquer uma debitar, permitindo gasto além do saldo real. | **P0** | `packages/core/src/billing/credit-gate.ts` — `ensureSufficientCredits` lê o saldo, retorna; quem chama decide se prossegue; só depois `recordConsumption` grava. Nenhuma constraint de banco impede saldo negativo. |
| 1.3 | **Bug de citações trocadas** na tela "O que eu entendi até agora" (ONB-3, Missão 2) — nunca corrigido, decisão explícita de não misturar com a tag de outra missão. | **P1** | `CHANGELOG.md [0.3.0]`, "Observado, não corrigido": *"Decisão explícita do dono do produto: (...) não foi corrigido agora — fica registrado como tarefa isolada"*. |
| 1.4 | **Falha transiente de JSON inválido do LLM** — nenhum Engine tem retry. Já sugerido como tarefa desde a Missão 3 ("retry com backoff no Provider Gateway") e nunca implementado; reapareceu na validação da Missão 8. | **P1** | `CHANGELOG.md [0.3.0]` e `docs/changelog.md` (v2.10, Missão 8). |
| 1.5 | Warning **"Maximum update depth exceeded"** (React, dev mode) em `/painel` — dívida pré-existente da Sprint 1, nunca investigada. | **P2** | `CHANGELOG.md [0.2.0]`, "Observado, não corrigido". |
| 1.6 | ~~`admin.auth.admin.deleteUser()` falha consistentemente~~ — **causa raiz encontrada e resolvida no fechamento pós-H1** (`v0.8.2`): a falha não era da API em si, e sim de uma linha órfã em `user_profiles` (nunca removida pelos scripts de cleanup de missões anteriores, que limpavam `organizations`/`brands`/`organization_members` mas esqueciam `user_profiles`) bloqueando a exclusão em cascata do usuário. Removendo a linha de `user_profiles` primeiro, `deleteUser()` funciona normalmente — confirmado limpando os 2 usuários de teste órfãos do H1. | ~~P2~~ resolvido | Reproduzido e corrigido na auditoria pós-H1 (`docs/changelog.md`, fechamento H1). Scripts de cleanup futuros devem incluir `user_profiles` na lista de tabelas limpas antes de tentar `deleteUser()`. |

---

## 2. Dívidas técnicas

| # | Item | Prioridade | Evidência |
|---|---|---|---|
| 2.1 | **Zero validação de schema de variáveis de ambiente** — nenhum `zod` (ou equivalente) valida `process.env` na inicialização. Uma env var faltando só aparece como erro genérico em runtime, no pior momento possível. | **P1** | Nenhum arquivo `env.ts`/schema encontrado no repositório. |
| 2.2 | **Dois arquivos `.env.local`** (raiz e `apps/web/.env.local`) mantidos manualmente em sincronia desde a Sprint 1 — só o de `apps/web` é lido por `next dev`. Já causou confusão real documentada em pelo menos 2 missões (credenciais do Mercado Pago adicionadas só na raiz primeiro). | **P1** | `docs/changelog.md` (v2.4, Missão 6) e observação recorrente em sessões de E2E. |
| 2.3 | **Nenhum LLM Provider tem retry, backoff ou timeout.** Uma chamada lenta ou com erro transitório da API da Anthropic falha a operação inteira sem segunda tentativa. | **P1** | `packages/core/src/providers/anthropic-llm-provider.ts` — chamada direta ao SDK, sem `timeout`, sem wrapper de retry. Já sinalizado como pendente desde `CHANGELOG.md [0.3.0]`. |
| 2.4 | **Geração de peças de texto é sequencial, não paralela** — `approveCampaignStrategyAction` roda um `for (const piece of pieces)` com `await generateTextPiece(...)` dentro, uma peça de cada vez (5 chamadas de LLM em série). | **P2** (vira P1 se combinado com 4.1) | `apps/web/app/(platform)/criar-campanha/actions.ts`, loop de geração. Tempos de 60–90s+ observados empiricamente em toda validação de Missão 7/8. |
| 2.5 | **`getBalance()` do `credit_ledger` é um `SUM()` completo** sobre todas as linhas da organização, a cada chamada — sem saldo materializado/cacheado. Funciona hoje (poucas linhas por org), degrada com o tempo. | **P2** | `packages/core/src/repositories/credit-ledger.repository.ts`. |
| 2.6 | **Apenas 1 índice em todo o schema** (`credit_ledger_organization_id_idx`) além de PKs/UNIQUEs, em 25 tabelas. Toda consulta por `brand_id`/`campaign_id`/`session_id`/`content_piece_id` hoje depende de sequential scan. | **P0** (ver §4 e §6) | `grep -c "create index" supabase/migrations/*.sql` → 1. |
| 2.7 | **`next@14.2.35`** está desatualizado — origem de 23 das 25 vulnerabilidades do `pnpm audit` (ver §5). | **P0** | `pnpm audit --prod`. |
| 2.8 | **Nenhum teste automatizado, nenhum CI** — tratado em detalhe nas seções 7 e 8, mas é dívida técnica estrutural, não só ausência de processo. | **P0** | Nenhum arquivo `*.test.ts`/`*.spec.ts`, nenhum `.github/workflows`, nenhum framework de teste em nenhum `package.json`. |

---

## 3. Melhorias de UX

| # | Item | Prioridade | Evidência |
|---|---|---|---|
| 3.1 | **Sem feedback progressivo em nenhuma geração de IA** — telas de "Analisando..."/"Gerando..." estáticas por até 90s, sem streaming nem indicação de progresso por etapa. Decisão em aberto desde a Missão 2/3, nunca fechada. | **P1** | `CHANGELOG.md [0.2.0]`: *"resposta em streaming melhoraria a sensação de fluidez"*; `docs/ux-design.md` §10. |
| 3.2 | **CFG-1/3/5/6 nunca implementadas** (Perfil da Conta, Nível de Qualidade/tier, Marcas, Time e Permissões) — plano Business promete múltiplas marcas e convite de time, mas não há UI para nenhum dos dois. | **P1** (CFG-1) / **P2** (CFG-3/5/6, dependem de multi-brand real) | `docs/ux-design.md` §3.9, nota "seguem apenas especificadas, sem código correspondente" desde a Missão 6. |
| 3.3 | **HIST-1/2 (histórico de campanhas) nunca implementadas** — usuário não tem como revisitar uma campanha depois que sai da tela onde ela foi criada. | **P1** | `docs/ux-design.md` §3.6, mesma lacuna sinalizada desde a auditoria pré-Missão 5. |
| 3.4 | **Biblioteca de Mídia nunca implementada** — cada upload de `own_media` é isolado por peça; não há reaproveitamento de arquivo entre peças/campanhas. | **P2** | Nav item `implemented: false` desde sempre. |
| 3.5 | **Central de Notificações (GLOBAL-1) documentada, nunca implementada** — eventos assíncronos (estratégia pronta, pacote pronto, nova sugestão) não têm nenhum agregador visual. | **P2** | `docs/ux-design.md` §3.10. |
| 3.6 | **Sem atalhos de teclado na revisão de peças** — decisão em aberto documentada, nunca fechada. | **P2** | `docs/ux-design.md` §10, item 2. |
| 3.7 | **Nenhuma forma de arquivar/excluir permanentemente** uma campanha ou peça rejeitada. | **P2** | Ausência confirmada em toda a superfície de Server Actions atual. |

---

## 4. Performance (latência, consultas, custo de IA)

| # | Item | Prioridade | Evidência |
|---|---|---|---|
| 4.1 | **Geração de 5 peças textuais em série** (não paralela) — cada campanha aprovada leva 60–90s+ até todas as peças ficarem prontas para revisão. | **P1** | Ver 2.4. Especialistas do painel já rodam em paralelo (`Promise.allSettled`) — o mesmo padrão não foi aplicado à geração de peças. |
| 4.2 | **Sem timeout configurado nas chamadas ao Anthropic SDK** — uma chamada anormalmente lenta trava o Server Action inteiro sem teto de tempo, arriscando timeout da própria função serverless (se o host tiver limite de duração). | **P1** | `anthropic-llm-provider.ts`, sem opção de timeout no `client.messages.create()`. |
| 4.3 | **Zero índices em colunas de FK** usadas em praticamente toda consulta do produto (`brand_id`, `campaign_id`, `session_id`, `content_piece_id`, etc.). | **P0** | Ver 2.6. |
| 4.4 | **`getBalance()` sem materialização** — recalcula o saldo inteiro a cada checagem de crédito (toda geração de IA chama isso). | **P2** hoje, escala para **P1** com volume real | Ver 2.5. |
| 4.5 | **Nenhuma métrica real de custo de IA** — o produto cobra créditos do cliente (`credit_pricing`), mas não há nenhum registro do custo real em tokens/USD gasto por chamada, nem agregação por engine/tier. Sem isso, não há como saber se a precificação de créditos cobre o custo real de operação. | **P1** | `generation_metadata` grava `llm_provider_key`/tier, mas não tokens consumidos nem custo estimado. |
| 4.6 | **Tempo médio de sessão do Intelligence Hub ~45s** (painel + Coordinator), com variação alta — funciona, mas sem streaming a sensação de lentidão é maior que o tempo real. | **P2** | `CHANGELOG.md [0.3.0]`, "Observado, não corrigido". |

---

## 5. Segurança (RLS, Service Role, uploads, validações)

| # | Item | Prioridade | Evidência |
|---|---|---|---|
| 5.1 | **Policies de Storage permitem escrita a qualquer `is_org_member`, não só `editor+`** — as 3 policies de `storage.objects` (`brand-media`, `knowledge-base`, `content-output`) usam `for all` gated só por `is_org_member`. Isso significa que um usuário com papel `viewer` pode enviar/sobrescrever/apagar arquivos diretamente via API do Supabase Storage, contornando o `hasMinimumRole(..., "editor")` que hoje só existe na camada de Server Action — não no banco. | **P0** | `supabase/migrations/0001_init.sql`, policies `brand_media_org_access`/`knowledge_base_org_access`/`content_output_org_access`. |
| 5.2 | **25 vulnerabilidades de dependência conhecidas** (`pnpm audit --prod`): 10 `high`, 13 `moderate`, 2 `low`. 23 delas são do `next@14.2.35`, incluindo múltiplas advisories especificamente sobre **DoS e SSRF em Server Actions/RSC** — exatamente o mecanismo que sustenta toda a aplicação. As outras 2 são do `postcss` (leitura arbitrária de arquivo via source map). | **P0** | `pnpm audit --prod` rodado nesta auditoria; patch disponível em `next@>=15.5.16`. |
| 5.3 | **Sem limite de tamanho nem validação de tipo MIME real em uploads** — `criar-campanha/asset-actions.ts` (`uploadContentPieceMediaAction`) e `ensine-sua-empresa/actions.ts` só checam `file.size === 0` (arquivo vazio); não há teto de tamanho nem verificação server-side do conteúdo real do arquivo (o `file.type` usado como `contentType` vem do cliente, não é inspecionado). | **P0** | Grep direto nos dois arquivos de upload. |
| 5.3b | ★ **Achado durante a auditoria técnica da H1:** `next.config.js` nunca configurou `serverActions.bodySizeLimit` — default do Next.js 14 é **1MB**. Nenhum upload real (foto, vídeo, PDF/DOCX de tamanho normal) passaria disso hoje; nunca foi pego em validação porque todo teste de upload usou arquivos sintéticos minúsculos (PNGs de 4×4 pixels). Resolvido junto com 5.3 — limite configurado explicitamente + validação de tamanho/tipo na Server Action. | **P0** | `apps/web/next.config.js`, ausência de `serverActions.bodySizeLimit`. |
| 5.4 | **Race condition no portão de crédito** — risco de segurança/negócio, não só bug funcional (permite gastar além do saldo pago). | **P0** | Ver 1.2. |
| 5.5 | **Nenhum rate limiting em nenhuma Server Action** — nenhuma proteção contra abuso/spam de geração de IA além do saldo de créditos (que, combinado com 5.4, pode ser furado). Cada chamada de IA tem custo real em tokens. | **P1** | Ausência confirmada em toda a árvore `apps/web`. |
| 5.6 | **Nenhuma validação de schema de variáveis de ambiente** (mesmo item de 2.1, relevante aqui como superfície de erro de configuração em produção). | **P1** | Ver 2.1. |
| 5.7 | Uso de **Service Role concentrado e tecnicamente correto** (10 chamadas, todas em Server Actions/webhook, nunca em Client Components) — mas sem auditoria formal de que cada uso é estritamente necessário e sem teste automatizado que garanta que RLS realmente bloqueia o que deveria. | **P1** | Confirmado via grep — nenhuma chamada em código client-side. Item de risco é ausência de verificação automatizada, não uso indevido observado. |
| 5.8 | Tabelas administrativas (`specialists`, `provider_configs`, `credit_pricing`, `credit_packages`, `plans`) **corretamente** sem nenhuma policy de usuário final — confirmado, sem achado. | — | Verificado nesta auditoria, sem ação necessária. |
| 5.9 | Webhook do Mercado Pago **valida assinatura corretamente** antes de processar qualquer notificação — confirmado, sem achado. | — | `apps/web/app/api/webhooks/mercado-pago/route.ts`. |

---

## 6. Escalabilidade

| # | Item | Prioridade | Evidência |
|---|---|---|---|
| 6.1 | **Ausência de índices** é o ponto mais crítico de escalabilidade — toda consulta core do produto degrada de forma previsível com o crescimento de dados. | **P0** | Ver 2.6/4.3. |
| 6.2 | **Nenhuma paginação real** em listagens além do histórico de créditos (limitado a 50) — peças, campanhas e insights carregam tudo de uma vez por marca. | **P2** hoje, **P1** com volume real | Confirmado nos repositories (`findByBrandId`/`findByCampaignId` sem `limit`/`offset`). |
| 6.3 | **Nenhuma estratégia de retenção/arquivamento** — `intelligence_hub_sessions`, `specialist_opinions`, `credit_ledger`, `learning_signals` crescem indefinidamente, sem soft-delete nem política de expiração. | **P2** | Ausência confirmada no schema. |
| 6.4 | **Tudo é síncrono dentro do request/response** — decisão de produto consciente até aqui ("sem n8n ainda"), mas em escala isso vira gargalo real (timeouts de função serverless, especialmente combinado com 4.1). | **P1** para monitorar, não necessariamente implementar agora | Documentado como decisão intencional em `architecture.md` §8 — registrado aqui como risco de escala, não como erro. |
| 6.5 | **Multi-brand (plano Business) sem cobertura real** — `CFG-5` nunca implementada, então o caminho de múltiplas marcas por organização nunca foi exercitado de ponta a ponta em nenhuma validação. | **P1** | Ver 3.2. |

---

## 7. Testes automatizados

| # | Item | Prioridade | Evidência |
|---|---|---|---|
| 7.1 | **Zero testes automatizados em todo o repositório** — nenhum arquivo `*.test.ts`/`*.spec.ts`, nenhum framework (`vitest`/`jest`/`playwright`/`cypress`) em nenhum `package.json`. | **P0** | Busca exaustiva nesta auditoria, sem nenhum resultado. |
| 7.2 | **Toda validação até hoje foi manual**, via browser, refeita do zero a cada missão — nada garante que a Missão 8 não quebrou algo da Missão 3. Não há rede de segurança de regressão. | **P0** | Padrão observado em todo o histórico de `docs/changelog.md`. |
| 7.3 | **Nenhum teste de RLS** — as próprias afirmações de segurança deste relatório (§5) vêm de leitura de código, não de teste automatizado que prove que um `viewer` de fato não consegue o que não deveria. | **P0** | Ausência confirmada. |
| 7.4 | **Nenhum teste de credit gate** — a race condition de 1.2/5.4 seria pega por um teste de concorrência simples, que não existe. | **P0** ★ corrigido na auditoria do H2 (antes P1 — inconsistente com a própria "Priorização consolidada" abaixo, que já incluía "teste de concorrência do credit gate" no item P0 nº 8) | Ausência confirmada; teste ad hoc já escrito e usado para validar a correção do H1 (item 1.2/5.4), nunca formalizado como teste automatizado comitado ao repositório. |

---

## 8. CI/CD

| # | Item | Prioridade | Evidência |
|---|---|---|---|
| 8.1 | **Nenhum pipeline de CI** — `.github/workflows` não existe; `typecheck`/`lint`/`build` só rodam quando alguém lembra de rodar localmente antes de commitar. | **P0** | `find .github` → vazio. |
| 8.2 | **Nada impede um commit quebrado de entrar em `master`** — não há branch protection nem gate automatizado de nenhum tipo. | **P0** | Consequência direta de 8.1. |
| 8.3 | **Nenhum ambiente de staging/preview** — toda validação usa o mesmo projeto Supabase remoto (não há separação dev/staging/prod visível no repositório). | **P1** | `supabase/config.toml` aponta para um único projeto. |
| 8.4 | **Aplicação de migration é sempre manual** (`npx supabase db push`), sem automação nem changelog de deploy. | **P1** | Padrão usado em toda missão até aqui. |

---

## 9. Observabilidade (logs, métricas, monitoramento)

| # | Item | Prioridade | Evidência |
|---|---|---|---|
| 9.1 | **Logger é `console.log`/`console.error` puro** — JSON estruturado (bom formato), mas não integrado a nenhuma plataforma real (Sentry, Datadog, Axiom, Logtail, etc.). Logs só existem no stdout do processo em execução — perdidos ao reiniciar, sem busca, sem alerta. | **P0** | `packages/core/src/logger.ts` — implementação completa lida nesta auditoria. |
| 9.2 | **Nenhuma métrica de negócio agregada** — quantas gerações por dia, taxa de erro por engine, custo real de tokens, tempo médio por operação: nada disso é coletado hoje. | **P1** | Ausência confirmada. |
| 9.3 | **Nenhum alerta configurado** — falha de webhook, falha de geração de IA, saldo de créditos negativo (se a race condition de 1.2 ocorrer) passariam despercebidos até um cliente reclamar. | **P0** | Ausência confirmada. |
| 9.4 | **Nenhum health-check endpoint** — sem forma programática de verificar se a aplicação/Supabase/Anthropic estão saudáveis. | **P1** | Ausência confirmada. |
| 9.5 | **Sem tracking de erro client-side** — não confirmada integração de nenhum serviço de monitoramento de erros de frontend. | **P1** | Ausência confirmada. |

---

## Priorização consolidada

### P0 — bloqueiam o lançamento da v1.0

1. Atualizar `next` (resolve 23/25 vulnerabilidades, incluindo todas as `high`) — **5.2**
2. Corrigir policies de Storage para `is_org_editor` em operações de escrita — **5.1**
3. Resolver a race condition do portão de crédito (transação/lock ou constraint de saldo não-negativo) — **1.2 / 5.4**
4. Resolver a race condition do Provisionamento Inicial — **1.1**
5. Corrigir validação de upload (tamanho + tipo MIME real) — **5.3**
6. Adicionar índices nas colunas de FK mais consultadas — **2.6 / 4.3 / 6.1**
7. Configurar CI mínimo (typecheck + lint + build em todo PR/push) — **8.1 / 8.2**
8. Escrever testes automatizados mínimos: smoke test dos fluxos críticos (login → onboarding → campanha → aprovação → pacote) + teste de RLS + teste de concorrência do credit gate — **7.1 / 7.2 / 7.3**
9. Integrar logger a uma plataforma real de observabilidade + alerta mínimo para falhas de webhook/pagamento — **9.1 / 9.3**

### P1 — fortemente recomendados antes da v1.0

- Retry/backoff/timeout no LLM Provider (**2.3 / 4.2**)
- Validação de schema de env vars + consolidar os dois `.env.local` (**2.1 / 2.2 / 5.6**)
- Paralelizar geração de peças de texto (**2.4 / 4.1**)
- Corrigir o bug de citações trocadas (ONB-3) (**1.3**)
- Streaming/feedback progressivo nas gerações de IA (**3.1**)
- CFG-1 (Perfil da Conta) — mínimo necessário mesmo sem multi-brand (**3.2**)
- HIST-1/2 (histórico de campanhas) (**3.3**)
- Métrica de custo real de IA por operação (**4.5**)
- Rate limiting básico nas Server Actions que chamam LLM (**5.5**)
- Ambiente de staging separado + changelog de migration (**8.3 / 8.4**)
- Métricas de negócio + health-check + error tracking client-side (**9.2 / 9.4 / 9.5**)

### Novo item (encontrado na validação do H1, fora do escopo aprovado)

- **5.10 (novo):** `postcss` (via `next`) e `sharp`/`libvips` — 5 vulnerabilidades (2 `moderate`, 3 `high`) remanescentes após o upgrade do Next, confirmadas via `pnpm audit --prod` re-executado. Nenhuma é do Next.js em si. **P1** — recomendado antes da v1.0, não bloqueante como o restante do H1.

### P2 — aceitável adiar para pós-v1.0

- Materializar saldo do credit ledger (**2.5 / 4.4**)
- Biblioteca de Mídia, Central de Notificações, atalhos de teclado, arquivar peça/campanha (**3.4–3.7**)
- Paginação real, retenção/arquivamento de dados (**6.2 / 6.3**)
- CFG-3/5/6 (dependem de multi-brand real) (**3.2 / 6.5**)
- Corrigir warning "Maximum update depth exceeded" (**1.5**)

---

## 10. Checklist para lançar a versão 1.0

Marcado como bloqueante (☐ P0) ou recomendado (○ P1) — usar como gate de release, não como lista de features.

**Segurança**
- [x] `next` atualizado para versão sem vulnerabilidades `high`/`critical` (Missão H1 — `next@15.5.22`)
- [x] Policies de Storage corrigidas para `is_org_editor` em escrita (Missão H1)
- [x] Upload com limite de tamanho e validação de tipo real (Missão H1)
- [x] Race condition do credit gate resolvida (testada sob concorrência) (Missão H1)
- [x] Race condition do provisionamento inicial resolvida (testada sob concorrência) (Missão H1)
- [ ] `pnpm audit --prod` sem `high`/`critical` pendente (não re-executado após o upgrade — recomendado antes da v1.0)

**Qualidade e processo**
- [ ] CI rodando typecheck + lint + build em todo push/PR
- [ ] Suite mínima de smoke tests dos fluxos críticos, rodando no CI
- [ ] Teste automatizado confirmando RLS nos pontos críticos (Storage, credit_ledger, specialists)
- [ ] Índices criados nas colunas de FK mais consultadas

**Observabilidade**
- [ ] Logger integrado a uma plataforma real (não só stdout)
- [ ] Alerta mínimo para falha de webhook de pagamento e falha de geração de IA
- [ ] Health-check endpoint

**Produto (P1, recomendado mas não necessariamente bloqueante)**
- [ ] Bug de citações trocadas (ONB-3) corrigido
- [ ] CFG-1 (Perfil da Conta) implementada
- [ ] HIST-1/2 (histórico de campanhas) implementadas
- [ ] Retry/timeout no LLM Provider
- [ ] Rate limiting básico nas gerações de IA

**Infraestrutura**
- [ ] `.env.local` consolidado num único arquivo, com validação de schema
- [ ] Ambiente de staging separado do projeto Supabase de produção
- [ ] Processo de migration documentado/automatizado (não mais "lembrar de rodar `db push`")

---

## Próximos passos

Após sua aprovação deste plano, cada bloco de itens relacionados vira uma missão de hardening pequena e isolada — mesmo processo já usado em todas as missões anteriores (auditoria pontual → doc-first se necessário → implementação → validação real → commits separados `fix`/`feat`/`docs` → changelog). Sugestão de agrupamento (a confirmar com você):

1. **Missão H1 — Segurança crítica:** itens 5.1, 5.2, 5.3/5.3b, 1.1, 1.2/5.4 (as 5 correções P0 de segurança/race condition).
2. **Missão H2 — Fundação de qualidade:** CI mínimo + testes de smoke/RLS/concorrência (itens P0 de §7/§8).
3. **Missão H3 — Índices + observabilidade:** índices de banco + logger real + alertas mínimos.
4. **Missão H4 — Dívidas P1:** retry/timeout, env validation, paralelização de geração, rate limiting.
5. **Missão H5 — Produto P1:** citações trocadas, CFG-1, HIST-1/2.

---

## Missão H1 — Segurança crítica: escopo técnico aprovado

**Status:** aprovado pelo dono do produto (todas as opções recomendadas) — pronto para implementação.

| Item | Abordagem técnica |
|---|---|
| 5.1 (RLS de Storage) | As 3 policies `for all` de `storage.objects` (`brand_media_org_access`/`knowledge_base_org_access`/`content_output_org_access`) são substituídas por policies separadas por operação: `select` continua `is_org_member`; `insert`/`update`/`delete` passam a exigir `is_org_editor`. Migration nova, sem mudança de comportamento para nenhum fluxo já existente (todo upload já passa por Server Action gated a `editor+`). |
| 5.2 (Next.js) | Migração para **Next 15.5.x** (última estável da série, resolve todas as vulnerabilidades `high`/`moderate` do `pnpm audit`). **React permanece em 18** (Next 15 suporta `^18 \|\| ^19`) para isolar a migração a uma única variável. Uso do codemod oficial (`npx @next/codemod@latest upgrade 15.5.x`) para os breaking changes mecânicos (`cookies()`/`headers()` assíncronos — afeta os 19 arquivos que chamam `createClient()` — e `params`/`searchParams` como Promise nas 6 páginas que os usam), seguido de validação manual de cada ponto que o codemod não conseguir resolver sozinho. |
| 5.3 / 5.3b (Uploads) | `next.config.js` ganha `serverActions.bodySizeLimit` explícito (cobrindo o maior limite aceito, 20MB). Validação de tamanho + tipo MIME adicionada nas duas Server Actions de upload (`uploadContentPieceMediaAction`: **20MB**, imagens/vídeo comuns; `ensine-sua-empresa` mantém os **10MB** já documentados em `ux-design.md` §3.3 para PDF/DOCX/TXT), com mensagem de erro específica (mesmo padrão já usado para KB — "Esse arquivo é maior que 20MB..."). Upload direto ao Storage para vídeos maiores (bypassando a Server Action) fica registrado como decisão arquitetural futura, fora do escopo do H1. |
| 1.1 (Provisionamento inicial) | As 5 escritas hoje feitas via chamadas separadas do PostgREST (sem transação) são consolidadas numa função Postgres única (`ensure_initial_provisioning`), usando `pg_advisory_xact_lock(hashtext(user_id))` + checagem dupla de membership antes de criar. Atômico, sem mudar a assinatura pública de `ensureInitialProvisioning` no TypeScript — só a implementação interna passa a chamar a função via `db.rpc(...)`. |
| 1.2 / 5.4 (Portão de crédito) | Trigger `before insert` em `credit_ledger` que trava a linha da organização (`select ... for update`) e recalcula o saldo antes de aceitar a gravação — vira a garantia real e atômica contra saldo negativo. `ensureSufficientCredits` continua existindo como checagem otimista (evita chamar a IA à toa quando o saldo já está obviamente insuficiente); `recordConsumption` passa a capturar o erro do trigger e traduzir para `InsufficientCreditsError`, mantendo o contrato já usado por todo Server Action existente. **Trade-off aceito e documentado:** numa corrida genuína entre duas requisições da mesma organização, o "perdedor" pode ter a geração de IA já executada com a cobrança rejeitada depois — cenário raro, não resolvido por completo nesta sprint (exigiria um padrão de compensação desproporcional ao risco atual). |

---

## Missão H1 — Segurança crítica: concluída e validada (`v0.8.1`)

**Status:** os 5 itens P0 implementados exatamente conforme o escopo técnico acima, validados com testes reais de concorrência/permissão contra o Supabase remoto do projeto e com validação E2E completa no browser (Supabase + Anthropic reais). Nenhum item de escopo foi ampliado durante a implementação.

**Validação real:**

- **5.1 (RLS de Storage):** as 3 policies `for all` substituídas por 12 policies (select/insert/update/delete × 3 buckets). Testado com sessão real de `viewer`: tentativa de `.remove()` em `content-output` retorna array vazio (sem erro) — confirmado via `.list()` com service role que o arquivo **não** foi removido. RLS bloqueando corretamente.
- **1.1 (Provisionamento inicial):** consolidado em `ensure_initial_provisioning` (função Postgres única, `pg_advisory_xact_lock` por `user_id`, checagem `auth.uid()` contra impersonação). Testado com 5 chamadas concorrentes do mesmo usuário novo — exatamente 1 organização criada, as outras 4 chamadas retornam `already_provisioned = true` com o mesmo `organization_id`.
- **1.2 / 5.4 (Portão de crédito):** trigger `enforce_credit_ledger_balance` (`select ... for update` + recalcula saldo antes do insert). Testado com 10 débitos concorrentes contra um saldo insuficiente para todos — só o número exato de débitos que o saldo suporta é aceito, o restante rejeitado com `insufficient_credit_balance`, saldo final nunca negativo.
- **5.3 / 5.3b (Upload):** `bodySizeLimit` configurado em 20MB (`experimental.serverActions`, confirmado que continua nessa chave mesmo no Next 15.5). Validação de tamanho + tipo MIME adicionada em `uploadContentPieceMediaAction`. Testado no browser: arquivo de 21MB rejeitado com mensagem amigável; arquivo de tipo não aceito (ex: `.txt` como mídia) rejeitado; upload válido de imagem aceito e persistido no Storage.
- **5.2 (Next.js 15.5.22):** upgrade de `14.2.35`. `cookies()` migrado para `async`/`await` de forma própria em `lib/supabase/server.ts` (rejeitado deliberadamente o atalho `UnsafeUnwrappedCookies` do codemod oficial, por ser dívida técnica documentada como temporária pelo próprio Next.js) — `createClient()` agora `async`, `await` propagado a 32 call sites em 17 arquivos. `serverComponentsExternalPackages` → `serverExternalPackages` (chave estável). `params`/`searchParams` como `Promise<T>` nas páginas afetadas. Validado ponta a ponta no browser com a marca de teste "Padaria Trigo Dourado": login/provisionamento, todas as 6 telas principais, fluxo completo de campanha (painel de especialistas com divergência real entre Marketing e Branding corretamente reportada pelo Coordinator, 5 peças de texto geradas via Anthropic real, upload de mídia própria para as 4 peças visuais, aprovação de todas as 9 peças, montagem automática do pacote e download real do `.zip` assinado — `200 OK`, `application/zip`) — nenhuma regressão encontrada.

**Nenhum bug novo encontrado durante a validação** (só os dois erros de implementação autocorrigidos antes de qualquer teste de usuário: posicionamento de `serverActions` no config e o atalho `UnsafeUnwrappedCookies` do codemod — ver `docs/changelog.md`).

**`pnpm audit --prod` re-executado após o upgrade:** 25 → **5 vulnerabilidades** (2 `moderate`, 3 `high`). As 23 vulnerabilidades do `next@14.2.35` (incluindo todas as de DoS/SSRF em Server Actions/RSC citadas em 5.2) foram eliminadas. As 5 remanescentes são de dependências transitivas fora do escopo aprovado do H1: `postcss` (via `next`, XSS/path traversal em source map — upgrade de dependência isolado, sem breaking change esperado) e `sharp`/`libvips` (4 CVEs herdadas). Registradas como item novo de follow-up, não bloqueiam o H1.

---

## Fechamento pós-H1 (`v0.8.2`)

Uma auditoria rápida pós-H1 (verificação direta contra o Postgres remoto, não apenas leitura de migration) encontrou 2 achados residuais, ambos fechados nesta revisão antes de autorizar o início do H2:

**1. Guarda da RPC `ensure_initial_provisioning` incompleta.** `revoke all ... from public` (migration `0014`) não removia o `EXECUTE` que o Supabase concede por padrão a `anon` no schema `public` — `anon` continuava tecnicamente autorizado a chamar a função. Além disso, `if p_user_id != auth.uid()` retorna `NULL` (não `TRUE`) quando ambos os lados são `NULL`, então uma chamada anônima com `p_user_id = null` não era barrada por essa checagem especificamente (a chamada ainda falhava adiante, por `organization_members.user_id` ser `NOT NULL`, mas o guard em si não se comportava como o comentário da função promete). **Não era explorável de ponta a ponta**, mas divergia do comportamento documentado.

Corrigido pela migration `0016_hardening_provisioning_grant_fix.sql`: `if p_user_id is distinct from auth.uid()` (comparação segura contra `NULL` dos dois lados) + `revoke execute ... from anon` explícito + `grant execute ... to authenticated, service_role`.

**Validado ao vivo contra o Supabase remoto (3 cenários, usuários de teste reais, descartados após o teste):**
- Chamada autenticada real (usuário provisiona a si mesmo): sucesso, 1 organização criada.
- Chamada anônima (client com `anon` key, sem sessão) — com `p_user_id` válido e com `p_user_id = null`: **ambas rejeitadas na camada de grant** (`permission denied for function ensure_initial_provisioning`, `42501`) — `anon` não consegue mais nem invocar a função, então o caso de borda do `NULL` deixou de ser relevante.
- Tentativa de impersonação (usuário A autenticado chama com `p_user_id` de um usuário B): rejeitada pelo guard (`não autorizado`, `42501`).
- Confirmado por leitura direta da tabela `organizations`: zero organizações criadas pelas tentativas anônima e de impersonação; exatamente 1 criada pela chamada legítima.

**2. Ambiente de desenvolvimento com dados de teste órfãos.** A organização `h1test.upload` (criada durante a validação de upload do H1) não tinha sido removida, apesar de reportada como limpa numa sessão anterior — brand, membership e o registro em `organizations` ainda existiam. Removida por completo nesta revisão (nenhum dado relacionado em campanhas/peças/`learning_signals`/`credit_ledger`/Storage — a organização não chegou a gerar esse tipo de dado).

**Causa raiz do `deleteUser()` "sempre falhando" (item 1.6) finalmente encontrada:** não é uma falha da API do Supabase Auth, e sim uma linha órfã em `user_profiles` que os scripts de cleanup de missões anteriores nunca removiam (limpavam `organizations`/`brands`/`organization_members`, mas não `user_profiles`), bloqueando a exclusão em cascata do usuário. Removendo `user_profiles` primeiro, `deleteUser()` funcionou normalmente nos dois usuários de teste do H1 (`h1test.full@ayoncreator.dev`, `h1test.upload@ayoncreator.dev`) — **zero usuários órfãos remanescentes**, corrigindo a suposição registrada desde a Missão 6 de que essa falha era "P2, aceitável adiar". Scripts de cleanup futuros devem incluir `user_profiles` na lista de tabelas limpas antes de tentar `deleteUser()`.

**Validação de ambiente limpo (checagem final):** zero organizações/usuários com `h1test`/`h1-fix` no nome ou e-mail; `typecheck`/`lint`/`build` re-executados do zero, todos limpos; `supabase migration list --linked` confirma `0016` aplicada (`local == remote`).

**Itens do checklist §10 marcados como concluídos por esta missão:** todos os 5 itens de "Segurança" exceto "`pnpm audit --prod` sem `high`/`critical` pendente" — reduzido de 25 para 5 vulnerabilidades (zero relacionadas ao Next.js), mas ainda não zerado; ver nota acima.

---

## Missão H2 — Fundação de qualidade: auditoria e escopo técnico aprovado

**Status:** auditoria concluída, decisões arquiteturais aprovadas pelo dono do produto — aguardando aprovação final antes da implementação. Escopo: itens P0 de §7 (Testes automatizados) e §8 (CI/CD) — **7.1, 7.2, 7.3, 7.4** (corrigido de P1 para P0 nesta auditoria — ver nota no item da tabela) **, 8.1, 8.2**.

### Achados da auditoria (verificação direta do repositório, não apenas leitura de código)

1. **Repositório sem remote git.** `git remote -v` vazio, só existe a branch local `master`; o CLI `gh` não está instalado neste ambiente. GitHub Actions é **literalmente impossível hoje** — não é uma questão de configuração, é ausência total de repositório remoto. Bloqueia 8.1/8.2 por completo até ser resolvido.
2. **Zero framework de teste, zero arquivo de teste** — confirmado de novo (mesmo resultado da auditoria original que gerou o item 7.1).
3. **`docs/hardening-plan.md` tinha uma inconsistência interna:** o item 7.4 (teste de concorrência do credit gate) estava listado como **P1** na tabela §7, mas a "Priorização consolidada" (P0 item nº 8) já o incluía como parte do bloco de testes automatizados obrigatório para a v1.0. Corrigido nesta revisão: 7.4 agora é **P0**, alinhado ao agrupamento da própria Missão H2 (`docs/hardening-plan.md` §"Próximos passos").
4. **Nenhuma outra menção a testes/CI em nenhum dos 5 documentos de produto** (PRD.md, architecture.md, database.md, flows.md, ux-design.md) nem em CONVENTIONS.md além da linha já existente sobre o prefixo `test:` de Conventional Commits (§7, sem infraestrutura correspondente até agora) — nenhuma correção necessária nesses documentos, H2 não muda nada product-facing.
5. **`resolveLlmProvider` (`packages/core/src/providers/provider-gateway.ts`) não tem nenhum ponto de injeção de teste** — sempre instancia `AnthropicLlmProvider` a partir de `provider_configs` + `ANTHROPIC_API_KEY`. Um provider fake para o smoke test do CI precisa de um gate explícito dentro dessa função (não um mock injetado de fora).
6. **Docker Desktop está instalado localmente, mas o daemon não está rodando** (`failed to connect to the docker API`, mesmo erro observado ao aplicar migrations no H1) — `supabase start` (Postgres+Auth+Storage+PostgREST locais) não funciona nesta máquina até o Docker Desktop ser iniciado. Não bloqueia CI (runners do GitHub Actions têm Docker por padrão), mas bloqueia rodar a suíte de RLS/concorrência localmente até isso ser corrigido.
7. **As 16 migrations nunca foram testadas aplicando do zero** contra um Postgres vazio — todo o histórico foi aplicado incrementalmente contra o mesmo projeto Supabase remoto desde a Sprint 1. `supabase start` no CI (decisão aprovada abaixo) valida isso de brinde, na primeira execução.

### Decisões arquiteturais aprovadas pelo dono do produto

1. **Hosting do CI:** você cria um repositório no GitHub (público ou privado) e me passa a URL — eu configuro o remote, faço o push do histórico atual e escrevo o workflow do GitHub Actions. **Isso é um pré-requisito da implementação — a URL do repositório é necessária antes de qualquer código deste item ser escrito.**
2. **Frameworks:** **Vitest** (testes de RLS/concorrência batendo direto no Supabase local via client, sem browser, mais testes unitários de `packages/core`) + **Playwright** (smoke test de browser real, único jeito de exercitar Server Actions de ponta a ponta como as validações manuais de toda missão já fazem).
3. **Banco de teste para RLS/concorrência:** **Postgres local efêmero via Supabase CLI** (`supabase start`, Docker) — sobe Postgres+Auth+Storage+PostgREST, aplica as 16 migrations do zero, roda os testes, derruba tudo. Isolado por completo do projeto real; não exige `SUPABASE_SERVICE_ROLE_KEY` do projeto de produção como secret de CI.
4. **LLM no smoke test:** **provider fake**, selecionável por variável de ambiente só em modo de teste — determinístico, instantâneo, zero custo de token, zero flakiness. A validação com Anthropic real continua manual a cada missão, como já é hoje; o smoke test garante que o encanamento (Server Actions, credit gate, RLS) não quebrou, não que o texto gerado é bom.

### Escopo técnico planejado (para implementação, após sua aprovação final)

| Item | Abordagem técnica |
|---|---|
| 7.1 / 7.2 (fundação de testes) | `vitest` adicionado como devDependency em `packages/core` (testes unitários co-localizados, ex. `slug.test.ts`) e num novo diretório `supabase/tests/` (testes de integração que precisam de Postgres real). `playwright` adicionado em `apps/web/e2e/`. Scripts `test`/`test:e2e` no `package.json` raiz. |
| 7.3 (RLS) | `supabase/tests/rls.test.ts` — formaliza os testes ad hoc já escritos e validados durante o H1 (viewer não consegue escrever em Storage, member vs. editor, isolamento entre organizações) como suíte comitada, rodando contra o Postgres local efêmero. |
| 7.4 (concorrência do credit gate) | `supabase/tests/concurrency.test.ts` — formaliza o teste de 10 débitos concorrentes contra saldo insuficiente (já validado ad hoc no H1) como suíte comitada. Mesmo arquivo ou um segundo (`provisioning.test.ts`) formaliza o teste de 5 provisionamentos concorrentes do mesmo usuário (item 1.1, já corrigido no H1, nunca testado de forma automatizada). |
| 8.1 / 8.2 (CI) | `.github/workflows/ci.yml`: job 1 (`typecheck`+`lint`+`build`, rápido, sem Docker) roda sempre; job 2 (`supabase start` + Vitest) e job 3 (Playwright com o provider fake) rodam em paralelo. Branch protection em `master` (exigir os 3 jobs verdes antes de merge) é uma configuração manual do dono do produto nas Settings do GitHub — não é algo que um commit resolve sozinho, fica registrado aqui como passo pendente pós-implementação. |
| Provider fake (suporte ao smoke test) | `packages/core/src/providers/fake-llm-provider.ts`, implementando `LlmProvider` com resposta fixa e instantânea. `resolveLlmProvider` ganha um gate explícito no início (`if (process.env.LLM_PROVIDER_MODE === "fake") return new FakeLlmProvider();`) — nome de env var deliberadamente inequívoco, nunca setada em `.env.local`/produção. |

**Fora do escopo do H2** (registrados para H3+ ou além): 8.3 (staging separado), 8.4 (automação de deploy de migration), retry/timeout no LLM Provider (2.3/4.2 — relevante para reduzir flakiness do smoke test real manual, mas não bloqueia o H2 porque o smoke test de CI usa o provider fake), item 5.10 (postcss/sharp, achado do H1).

---

## Missão H2 — Fundação de qualidade: concluída e validada (`v0.9.0`)

**Status:** os 6 itens P0 (7.1, 7.2, 7.3, 7.4, 8.1, 8.2) implementados exatamente conforme o escopo técnico aprovado acima, validados localmente (Docker + Supabase CLI) e depois numa execução real do GitHub Actions — não só simulados.

**Repositório publicado:** `https://github.com/aionnewtech-afk/Ayon-Creator` — remote configurado, histórico completo (todos os commits e as 9 tags de `v0.1.0` a `v0.8.2`) enviado antes da implementação do H2.

**Achados durante a implementação (fora do que qualquer migration anterior previa):**

1. **Grants ausentes num Postgres local criado só a partir das migrations.** `supabase start` aplicou as 16 migrations sem erro (confirmando de brinde que elas aplicam limpo do zero, nunca testado antes), mas `anon`/`authenticated`/`service_role` ficaram sem `select`/`insert`/`update`/`delete` em nenhuma tabela — o projeto remoto tem esses grants porque a própria plataforma Supabase os concede ao provisionar um projeto novo, algo que nenhuma migration deste repositório jamais precisou fazer. Corrigido com `supabase/seed.sql` (convenção oficial do CLI — roda só em `start`/`db reset`, nunca em `db push` contra o remoto).
2. **CI quebrou na primeira execução real:** `pnpm@11.18.0` exige Node.js ≥22.13, mas o workflow fixava `node-version: 20` — os 3 jobs falhavam no bootstrap do próprio pnpm (`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`). Não pego na validação local porque a máquina de desenvolvimento já tinha Node 24 instalado por outros motivos. Corrigido para `node-version: 22`; `engines.node` do `package.json` raiz corrigido de `>=20` (nunca foi verdade) para `>=22.13`.
3. **Kong (gateway local) com IP de upstream desatualizado após `supabase db reset`** — reproduzido uma vez durante o desenvolvimento (uploads de Storage retornavam 502), resolvido com `supabase stop && supabase start` completo. Não afeta CI (cada job sobe a stack do zero, sem histórico de `db reset` no meio).
4. **`slugify()` remove underscore em vez de tratá-lo como separador** — descoberto pelo primeiro teste unitário real do repositório, que assumia o comportamento errado. Corrigido o teste, não a função (comportamento já em produção, fora do escopo do H2 mudar).
5. **Cleanup do smoke test esquecia `learning_signals`** (aprovar peça emite sinal, Missão 8) — bloqueava a exclusão de `content_pieces` por FK. Corrigido antes do primeiro commit.

**Validação real:**

- **7.1/7.2 (fundação de testes):** `pnpm --filter core test` (Vitest, `packages/core/src/slug.test.ts`, 7 casos) e a suíte de `supabase/tests/` rodando contra Postgres local efêmero — ambos verificados localmente e no CI.
- **7.3 (RLS):** `supabase/tests/rls.test.ts` — editor sobe arquivo (sucesso), viewer lê (sucesso, `select` continua `is_org_member`), viewer tenta subir (bloqueado), viewer tenta apagar (bloqueado — `.remove()` retorna array vazio, confirmado via `.list()` com service role que o arquivo não foi removido, mesma pegadinha documentada no H1).
- **7.4 (concorrência):** `supabase/tests/concurrency.test.ts` — 5 provisionamentos concorrentes → exatamente 1 organização; chamada anônima e tentativa de impersonação rejeitadas (`42501`); 10 débitos concorrentes contra saldo de 5 → exatamente 5 aceitos, saldo nunca negativo.
- **Smoke test (Playwright):** login → objetivo de campanha → painel de especialistas + Coordinator (via `LlmProvider` fake) → aprovação da estratégia → 5 peças de texto → upload de mídia própria nas 4 peças visuais → aprovação das 9 peças → pacote montado automaticamente → link de download visível. Rodou 2× localmente e 1× no CI real, todas verdes.
- **8.1/8.2 (CI):** `.github/workflows/ci.yml` executado de ponta a ponta no GitHub Actions (não só localmente) após a correção do item 2 acima — os 3 jobs (`quality`, `integration-tests`, `e2e`) terminaram verdes.

**Itens do checklist §10 marcados como concluídos por esta missão:**
- [x] CI rodando typecheck + lint + build em todo push/PR
- [x] Suite mínima de smoke tests dos fluxos críticos, rodando no CI
- [x] Teste automatizado confirmando RLS nos pontos críticos (Storage — `credit_ledger`/`specialists` ficam para H3, que cobre índices/observabilidade e pode ampliar a suíte)

---

## Incidente de ambiente — crash transiente de `pnpm build` durante a Missão 11

**Sintoma:** durante a implementação da Missão 11 (task 9, pipeline de geração automática de foto), `pnpm build` falhou com o worker do Next.js morrendo em `"Collecting page data"`:

```
[low_level_alloc.cc : 554] RAW: Check new_pages != nullptr failed: VirtualAlloc failed
⨯ Next.js build worker exited with code: 3221226505 and signal: null
```

**Investigação (pedido explícito do dono do produto: causa raiz antes de qualquer correção, sem "alterações aleatórias"):**

1. `git stash` de todas as mudanças da Missão 11 + build limpo contra o último commit → passou. Confirma que o crash era uma regressão de código introduzida pela Missão 11, não um problema pré-existente do ambiente.
2. `git stash pop` + build com a Missão 11 inteira, exceto as 2 rotas novas do pipeline de foto (`/api/pipeline/photo/select`, `/api/pipeline/photo/compose`) → passou. Isola o problema a essas 2 rotas.
3. Cada rota isolada sozinha (a outra temporariamente renomeada para `route.ts.bak`, fora do roteamento do Next) → **as duas passaram individualmente**, sem crash.
4. As duas rotas juntas, no mesmo estado de arquivo que originalmente crashou → **passou 3 vezes seguidas**, sem nenhuma mudança de código entre as tentativas.

**Conclusão:** não há regressão determinística de código — nenhuma rota, import ou componente específico reproduz o crash de forma consistente. A causa mais provável é pressão de memória transiente no momento exato do build original: uma sequência de scripts `npx tsx`/`node -e` fazendo chamadas reais a fornecedores (ElevenLabs, Shotstack, download de imagens compostas) rodou imediatamente antes, somada aos 5 containers Docker já ativos em segundo plano (`ayon-creator-n8n`, `n8n`, `evolution_api`, `evolution_postgres`, `evolution_redis`) — provavelmente o suficiente para o Windows recusar uma alocação de memória naquele instante específico (`VirtualAlloc failed`), sem qualquer relação com o código em si.

**Registrado para referência futura:** se `pnpm build` voltar a falhar com esse mesmo sintoma (`VirtualAlloc failed` / worker exit code `3221226505`) neste ambiente, tratar como suspeita de pressão de memória transiente primeiro (tentar de novo, opcionalmente fechando containers Docker não essenciais ao projeto) — só investigar como regressão de código se o crash **reproduzir de forma consistente** com o mesmo estado de arquivos em múltiplas tentativas, como foi feito aqui.

**Pendente, não bloqueante:** branch protection em `master` (exigir os 3 jobs verdes antes de merge) é uma configuração manual nas Settings do GitHub — registrada aqui como passo pendente, fora do alcance de qualquer commit.
