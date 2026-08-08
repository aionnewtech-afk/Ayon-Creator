# Changelog

Histórico de releases do código da Ayon Creator. Para o histórico de decisões de escopo/documentação, ver [docs/changelog.md](docs/changelog.md).

## [0.13.1] — 2026-08-08

### Sprint de Estabilização da Missão 12

Sem funcionalidade nova planejada — auditoria completa do estado real da aplicação contra os problemas relatados em uso real, causa raiz identificada e corrigida para cada um, validação com dados/execuções reais (nunca mocks) em todos os itens. Uma única exceção autorizada pelo dono do produto ao final da sprint: alerta de divergência de cor na Identidade Visual (ver "Adicionado" abaixo).

### Corrigido (achados reais)

- **Pipeline de vídeo narrava sem roteiro válido, mesmo após inserido manualmente**: causa raiz — a peça de vídeo nunca tem `.script` próprio; a única fonte real do roteiro é a peça "Roteiro" (`is_primary=true`), e uma cópia pontual feita só no momento da aprovação da campanha ficava desatualizada (ou nunca acontecia, se a geração do roteiro falhasse). `narrateVideoContentPiece`/`triggerVideoGeneration` passam a resolver a peça primária **ao vivo** a cada chamada (`ContentPieceRepository.findPrimaryByCampaignId`, novo), com falha explícita (`MissingScriptError`) antes de qualquer chamada à ElevenLabs se não houver roteiro. Removida a cópia pontual (código morto).
- **Workflow n8n apontava para a porta errada** (`3000` em vez da `3010` real do `next dev`) em todos os 9 nós HTTP — causa raiz separada do bug acima, mas com o mesmo sintoma ("geração trava para sempre"). Corrigido via API REST do n8n.
- **Campanhas geradas não apareciam em nenhum histórico**: causa raiz — o item de navegação "Campanhas" nunca foi implementado (placeholder "em breve"); a tela de revisão do pacote de conteúdo só existia como estado efêmero de componente cliente, perdido ao sair da página. Novas telas `/campanhas` (histórico, todas as campanhas da marca) e `/campanhas/[id]` (detalhe persistido, reaproveita `ContentPackageReview`). Auditoria de persistência encontrou 2 campanhas reais com `status` avançado e zero `content_pieces` — guarda defensiva adicionada em `approveCampaignStrategyAction` (nunca avança o status da campanha sem confirmar que as peças persistiram).
- **Reunião dos especialistas (Intelligence Hub)**: respostas longas, sem resumo executivo, com datas desatualizadas (ex. maio de 2025). Contexto temporal real (data/mês/ano/estação/país) passa a ser injetado em todo prompt do Intelligence Hub e do Trend Engine (`buildTemporalContextBlock`, novo, `packages/core/src/shared/temporal-context.ts`); instrução de objetividade adicionada; `executive_summary` novo campo no schema de resposta do Coordinator, exibido em destaque na UI.
- **"Buscar novidades" (Trend Engine) sempre retornava as mesmas tendências**: nenhuma exclusão contra pesquisas anteriores. `runTrendDiscovery` passa a buscar as últimas 5 pesquisas concluídas da marca e excluir os títulos já mostrados do prompt de busca (`excludeTitles`, novo).
- **Busca de imagens genérica**: já corrigida em turno anterior à sprint via consulta derivada por LLM; esta sprint adiciona um campo de nicho opcional por peça (ex. "praia", "shows") que o usuário pode informar ao regenerar, propagado por toda a cadeia (app → rota interna → n8n → Media Provider), sobrepondo a derivação automática quando preenchido. Validado ao vivo: regeneração com "praia" produziu foto de praia real (antes: resultado genérico/irrelevante).
- **Mensagens de erro de geração eram genéricas** ("não conseguimos gerar agora"), sem indicar em qual etapa o pipeline parou. `ContentPieceView` passa a carregar `pipelineStage` também em `status: "failed"` (antes só em `"generating"`); a UI monta uma mensagem específica por etapa (ex. "não conseguimos concluir a etapa 'Gerando narração'"), nunca expondo nome de fornecedor/API (mesma convenção já usada em `STAGE_LABELS`).
- **Peças de texto com falha na geração ficavam marcadas como `"draft"`** (indistinguíveis de uma peça nunca gerada) — `generate-text-piece.ts` agora marca `"failed"` no catch.

### Adicionado

- **Retry automático para falhas transitórias de provedores externos**: `fetchWithRetry` (novo, `packages/core/src/shared/fetch-with-retry.ts`) — 3 tentativas, backoff exponencial, aplicado a ElevenLabs, Pexels, Shotstack (submit e polling) e aos 2 pontos de disparo do pipeline via n8n (vídeo e foto). Anthropic já coberto pelos defaults do SDK oficial.
- **Alerta de divergência de identidade visual** (único item autorizado como funcionalidade nova nesta sprint, a pedido explícito do dono do produto após o fechamento da auditoria): `detectBrandColorMismatch` (novo, `packages/core/src/asset-engine/detect-brand-color-mismatch.ts`) analisa as cores predominantes reais da logo enviada (via `sharp`) e compara com `primary_color_hex`/`secondary_color_hex` cadastrados — **só detecta e avisa, nunca extrai ou aplica cor automaticamente** (decisão explícita). Banner de aviso não bloqueante em Perfil da Marca quando alguma cor cadastrada não corresponde à logo. Validado com o caso real da Todo Canto: cor primária corretamente reconhecida, cor secundária corretamente sinalizada como divergente — mesmo problema visual relatado originalmente pelo usuário.

### Auditado, causa raiz não é um bug de código (documentado, sem correção nesta sprint)

- **Identidade visual "parece só sobreposta"**: o pipeline aplica corretamente logo/cores configuradas (`resolveBrandBranding` → `ShotstackVideoRenderProvider`) — a causa real, para a conta real auditada, é que a cor secundária cadastrada não corresponde à paleta real da logo enviada, e a logo em si não tem transparência (fundo sólido embutido no arquivo). Dados de conta, não defeito de pipeline — endereçado via o alerta acima, correção dos dados fica a critério do usuário.
- **Sandbox do Shotstack sempre aplica marca d'água** (`SHOTSTACK_HOST=.../edit/stage/render`) — decisão deliberada e pré-existente da Missão 9 (ambiente gratuito de testes), não um bug introduzido; migrar para produção (paga, sem marca d'água) é uma decisão de billing que cabe ao usuário.
- **Ordem segura do pipeline** ("nenhuma etapa inicia antes da anterior estar concluída e persistida"): já garantida pela arquitetura existente + pelas correções desta sprint (falha explícita de roteiro ausente antes do disparo, guarda de 0 peças persistidas antes de avançar status) — confirmado com dados reais de `pipeline_runs` mostrando progressão sempre ordenada (`narrating` → `selecting_scenes` → `rendering`).

### Corrigido (infraestrutura de build, achado durante a implementação do alerta de cor)

- **`sharp` (dependência nativa usada pela detecção de divergência de cor) vazava para bundles de cliente**: o barrel plano de `packages/core/src/index.ts` (`export *`) fazia até um client component que só precisa de `hasMinimumRole` puxar o módulo inteiro, incluindo `sharp` — webpack falhava ao tentar empacotar dependências nativas (`node:child_process`, `node:crypto`) no bundle do navegador. Corrigido excluindo o módulo do barrel, importado por caminho direto no único consumidor (Server Component) — mesmo padrão já usado para `build-content-package`/`verify-n8n-webhook-secret`.
- **`sharp` não resolvia durante `next build`** mesmo depois do fix acima: o `require` externalizado (`serverExternalPackages`) do webpack resolve relativo à localização do bundle de saída (`apps/web/.next/...`), não do arquivo-fonte original — e sob o isolamento estrito do pnpm, `sharp` só estava linkado em `packages/core/node_modules`. Corrigido adicionando `sharp` também como dependência direta de `apps/web`.

### Adicionado

- **Missão 12 — Super Admin (plataforma administrativa completa)**: papel novo de escopo de plataforma inteira (`platform_admins`, 2 níveis — `super_admin`/`support_admin`), desacoplado do papel por organização. 13 telas administrativas, menu dedicado (`/admin`), Design System já existente (nenhum componente visual novo fora do sistema).
  - **Migrations `0020_super_admin.sql`/`0021_pipeline_runs_actor.sql`**: `platform_admins`, `admin_audit_logs`, `provider_call_logs` (tabelas novas); extensão centralizada de `is_org_member`/`is_org_admin`/`is_org_editor` para conceder acesso automático a qualquer `platform_admin`, sem tocar em nenhuma policy individual; `plans` ganha 11 campos novos (limites/capacidade/flags de recurso, preparando o modelo de negócio para migrar de "só crédito" para "crédito + limite por recurso" sem migration futura); `organizations`/`user_profiles` ganham `status`; `subscriptions` ganha `trialing`/`trial_ends_at`; `provider_configs` ganha `credential_value`/`maintenance`; `user_feedback` vira CRM interno (`status`/`internal_response`/`archived_at`); `pipeline_runs.actor_user_id` (achado real — webhook assíncrono do n8n não tinha como saber quem disparou o pipeline).
  - **Portão de crédito centralizado**: `ensureSufficientCredits`/`recordConsumption` ganham bypass automático de "ilimitado" para qualquer `platform_admin` — único ponto de decisão de cobrança, nenhuma Server Action de geração ganha lógica própria de admin.
  - **Impersonação real** ("Entrar como organização"): RLS concede acesso via a mesma extensão centralizada, sem client de service role nem lógica especial por Server Action; banner fixo obrigatório, sem botão de fechar; identidade do ator nunca muda (auditoria sempre com o admin real).
  - **Instrumentação real dos 4 providers** (Anthropic/ElevenLabs/Pexels/Shotstack): `provider_call_logs` com latência/status/custo estimado/tokens/request_id por chamada real, sem alterar nenhum dos 14 call sites existentes.
  - **Auditoria administrativa obrigatória**: toda ação grava em `admin_audit_logs` (ator, papel no momento da ação, antes/depois, IP, User-Agent lidos no servidor).
  - **13 telas**: Dashboard (MRR/ARR/trials/conversão/margem estimada/providers mais usados), Organizações (visão operacional + editar/bloquear/plano/créditos/trial/impersonar/excluir), Usuários (papel/status/reset de senha via Admin API), Planos (preço/créditos/limites/flags, só `super_admin`), Trials (criar/renovar/cancelar/converter), Créditos (saldo/histórico/ajuste), Mercado Pago (sincronizar webhook/cancelar assinatura via API real), Feedbacks (CRM interno — arquivar/responder/resolver/excluir/exportar CSV), Providers (observabilidade real + gestão de config, escrita só `super_admin`), Logs (visão unificada de pipelines/auditoria/providers/pagamentos), Branding (cross-organização, mesmos campos do Perfil da Marca), Auditoria (trilha completa, leitura), Configurações (preço em créditos por ação/flags de recurso/gestão de administradores, só `super_admin`).
  - `packages/ui` ganha 4 componentes (Badge/Table/Select/Tabs), mesmo padrão dos existentes (sem dependência nova).

### Corrigido durante a implementação (achados reais)

- **`/admin` sempre redirecionava para `/painel`**: `getCurrentSession()` consultava `platform_admins` com o client de sessão, mas a tabela não tem nenhuma policy de RLS para `authenticated` (mesmo padrão de `provider_configs`/`specialists`) — o papel do admin nunca era encontrado. Corrigido consultando via client de service role; achado documentado em `docs/architecture.md` (revisão 37) junto com o mesmo gap em `admin_audit_logs`/`provider_call_logs`/`user_feedback`.
- **"Criar admins" nunca tinha sido exposto em nenhuma tela**: uma das 4 ações exclusivas de `super_admin` do pedido original, com o repository já pronto desde o início da missão, mas sem nenhuma Server Action ou UI conectada — encontrado na revisão completa antes do fechamento. Adicionada a seção "Administradores da plataforma" em Configurações (criar/revogar, nunca permite auto-revogação).
- **Menu administrativo inteiro inacessível em telas estreitas**: `AdminSidebar` usa `hidden md:flex` sem nenhum fallback abaixo do breakpoint — encontrado na revisão de responsividade. Adicionado menu hambúrguer (`AdminMobileNav`) reaproveitando a mesma fonte de navegação, escopo restrito ao layout administrativo.
- Ver [docs/changelog.md](docs/changelog.md) (entradas v2.29/v2.30) para o relato completo da auditoria de arquitetura e das 9 decisões de ajuste do dono do produto.

## [0.12.0] — 2026-08-05

### Adicionado

- **Missão 11 — Refinamento da experiência de geração de conteúdo**: sem novos formatos, o pipeline existente (vídeo, e agora também stories/thumbnail/carrossel) passa a produzir conteúdo com qualidade de agência antes de investir em avatar (HeyGen).
  - **Identidade visual como ativo permanente**: `brands` ganha `logo_storage_path`, `primary_color_hex`, `secondary_color_hex`, `font_family`, `visual_style` — configurados uma vez em Perfil da Marca, aplicados automaticamente a todo conteúdo visual gerado depois. Sem logo cadastrada, o layout se adapta sozinho (nunca deixa espaço vazio reservado).
  - **Legenda removida do vídeo** (decisão explícita do dono do produto): `VoiceProvider`/`VideoRenderProvider` perdem o contrato de `captionCues`; a legenda textual do pacote (formato "Legenda", texto gerado por LLM) não é afetada.
  - **Seleção automática de voz por marca**: o Asset Engine escolhe a voz mais adequada (catálogo curado, 7 vozes) considerando nicho/público/tom da marca, persistida em `brand_brain_profiles.default_voice_ref`, que continua servindo de override manual.
  - **Seleção de cena por trecho do roteiro**: o roteiro é segmentado (LLM) em trechos com termo de busca próprio — cada trecho busca sua cena específica no banco de vídeo, com deduplicação entre trechos, em vez de uma única busca genérica repetida.
  - **Stories/thumbnail/carrossel ganham geração automática** (`production_mode: "licensed_stock_photo"`): foto de banco licenciado (Pexels) composta com identidade visual da marca via Shotstack (timeline em camadas — não o asset `html`, descontinuado e nunca capaz de imagem). Múltiplas opções por rodada quando o tier permite (1/2/3 conforme econômico/balanceado/premium), usuário escolhe; identidade visual consistente entre todas as peças de uma campanha (`campaigns.visual_brief`, resolvido uma vez, reaproveitado pelas demais peças). Upload manual continua disponível como alternativa, sempre visível.
  - **Progresso granular**: `pipeline_runs` ganha `stage`/`progress_percent`/`estimated_remaining_seconds`; a UI mostra etapa atual ("Gerando narração...", "Buscando cenas...", "Renderizando...") com barra aproximada e ETA.
  - **Player melhor**: baixar, copiar link, compartilhar (Web Share API com fallback de copiar link) — para vídeo e para foto.
  - **Migration `0019_asset_engine_refinement.sql`**: campos acima + `content_pieces.selected_version_id` (seleção de versão) + `production_mode` aceitando `licensed_stock_photo` + `credit_pricing` seedado para `image_generation`.

### Corrigido durante a implementação (achados reais)

- **`stories`/`carousel`/`thumbnail` continuavam com `production_mode: "own_media"`** em campanhas novas — `initialize-campaign-content-pieces.ts` nunca foi atualizado para a Missão 11, resquício da Missão 9. O botão "Gerar automaticamente" nunca aparecia. Encontrado ao validar a UI com uma campanha real; corrigido.
- **Seleção de cena sem contexto de destino gerava clipes de estoque desalinhados**: um trecho de fechamento do roteiro sem menção a lugar concreto ("a gente cuida de cada detalhe") produzia buscas genéricas ("planejamento de viagem"), trazendo um clipe com um cartão escrito "USA" numa campanha brasileira. Corrigido injetando destino/nicho da campanha no prompt de segmentação.
- **Vídeo podia exceder o limite de tamanho do Supabase Storage**: cenas de água/cachoeira produziram um MP4 acima do limite do projeto (variável, dependente do bitrate dos clipes sorteados a cada tentativa — `quality: "medium"` sozinho não foi suficiente nem confiável). Corrigido com `resolution: "sd"` no Shotstack, com folga para qualquer combinação de cenas.
- Ver [docs/changelog.md](docs/changelog.md) (entrada v2.28) para o relato completo da validação com 5 vídeos reais.

## [0.11.0] — 2026-08-05

### Adicionado

- **Missão 10 — botão global "Enviar feedback"**: modal simples (categoria Sugestão/Bug/Dificuldade de uso/Outro + descrição) acessível em qualquer tela autenticada, grava direto em `user_feedback` (sem interface administrativa nesta missão).
  - **Migration `0018_user_feedback.sql`**: tabela `user_feedback` (`organization_id`, `user_id`, `category`, `description`, `pathname`, `app_version`, `user_agent`, `created_at`), RLS de `insert` restrita ao próprio usuário membro da organização, sem `select`/`update`/`delete` para `authenticated`/`anon` (leitura só via service role).
  - **Contexto automático**: `pathname` capturado no client (`usePathname()`); `app_version` (a partir de `package.json`) e `user_agent` (`headers()`) sempre lidos no servidor, nunca confiados a um valor enviado pelo client.
  - `Dialog` (novo, `@ayon/ui`) — primeiro modal do produto, sobre o elemento `<dialog>` nativo, sem dependência nova (sem Radix/shadcn no pacote).
  - `UserFeedbackRepository`, `sendFeedbackAction` (`apps/web/app/(platform)/feedback-actions.ts`), `FeedbackButton` integrado à `Topbar`.
  - `package.json` (raiz, `apps/web`, `packages/core`) sincronizado com a tag de release (`0.10.2` → refletido aqui) — corrige o achado registrado em `docs/architecture.md` §13.1.2 (versão nunca era bumpada desde o início do projeto).

### Corrigido durante a implementação (achado real)

- **RLS bloqueava o próprio insert que deveria ser permitido**: `UserFeedbackRepository.create` encadeava `.insert(input).select().single()`, mas `user_feedback` não tem policy de `select` para `authenticated` (decisão deliberada, leitura só via service role). O PostgREST tenta ler a linha recém-criada para montar a resposta (`RETURNING`), e o Postgres recusa isso com o mesmo erro `42501` do `WITH CHECK` — mesmo o `INSERT` em si sendo permitido pela policy de `insert`. Encontrado ao enviar um feedback real pelo navegador; corrigido removendo o `.select()` (`create` passa a retornar `void`).

## [0.10.1] — 2026-08-04

### Adicionado

- `docs/GETTING_STARTED.md`: guia de uso do zero (Docker/n8n, variáveis de ambiente, criação de conta, assinatura de plano, primeira campanha, primeiro vídeo automático) — cada passo executado de verdade no navegador antes de documentado.
- `content-package-review.tsx` (CAMP-5) ganha o fluxo de vídeo automático (`licensed_stock_video`): botão "Gerar vídeo automaticamente", estado de progresso, player de vídeo, "Tentar novamente". `getContentPieceAction` (novo) faz polling simples enquanto o pipeline assíncrono roda.

### Corrigido

- **Peça de vídeo nunca chegava à interface** — `generateVideoContentPieceAction` existia desde o fechamento da Missão 9 mas nenhum componente a chamava; a peça `video` caía no fluxo de upload manual de `own_media`. Corrigido.
- **Bug real de narração** — `approveCampaignStrategyAction` nunca preenchia `content_pieces.script` para a peça de vídeo (só gera texto para formatos `text_only`), fazendo o pipeline falhar com "não tem script para narrar". Corrigido reaproveitando o script da peça principal "Roteiro" como narração do vídeo — mesma narrativa em dois formatos, sem chamada de LLM redundente. Encontrado e corrigido durante validação real no navegador (campanha real da Todo Canto Turismo).

## [0.10.0] — 2026-08-04

### Adicionado

- **Missão 9, Etapa 1 — Asset Engine ganha geração automática de vídeo** (`licensed_stock_video`): pipeline completo roteiro → narração → cenas → composição → MP4 vertical 9:16 com legenda, orquestrado por n8n (primeira ativação real da infraestrutura de pipelines assíncronos do produto).
  - **Providers novos**: `ElevenLabsVoiceProvider` (narração + timestamps por caractere, usados para legenda sem capacidade de transcrição separada), `PexelsMediaProvider` (banco de vídeo licenciado), `ShotstackVideoRenderProvider` (composição final). Resolvidos via Provider Gateway (`resolveVoiceProvider`/`resolveMediaProvider`/`resolveVideoRenderProvider`), `provider_configs` seedado por migration `0017`.
  - **Migration `0017_asset_engine_video_pipeline.sql`**: `provider_configs.capability` += `video_render`; `content_pieces.status` += `failed`; **`pipeline_runs` criada pela primeira vez** (documentada desde revisões antigas, nunca migrada até agora); `credit_ledger` += `related_pipeline_run_id` (idempotência); `credit_pricing` += `video_generation` (15/30/50, placeholder).
  - **Pipeline** (`packages/core/src/asset-engine/video-pipeline-*.ts`): `narrateVideoContentPiece`, `selectVideoScenes`, `renderVideoContentPiece`, `completeVideoPipelineSuccess`/`Failure`, `triggerVideoGeneration`.
  - **4 rotas HTTP novas** (`apps/web/app/api/pipeline/video/{narrate,scenes,render}`, `apps/web/app/api/webhooks/n8n`), autenticadas por segredo compartilhado.
  - **n8n provisionado** como instância própria e isolada do Ayon Creator (Docker, `n8n/docker-compose.yml`, porta 5679) — nunca reaproveitando uma instância de outro projeto encontrada rodando localmente. Workflow "Ayon Creator - Fluxo 13 (Pipeline de Vídeo)" criado e ativado via API, documentado em `n8n/README.md`.
  - `generateVideoContentPieceAction` (novo, `criar-campanha/asset-actions.ts`) — entrada da Server Action para CAMP-5.

### Corrigido durante a implementação (achados reais)

- **`apps/web/middleware.ts`**: o `matcher` de autenticação cobria `/api/**` inteiro, redirecionando (307→`/login`) qualquer chamada sem sessão de usuário — inclusive `/api/webhooks/mercado-pago`, que tem autenticação própria por assinatura. Bug pré-existente desde a Missão 6, nunca pego por falta de teste HTTP real contra o webhook. Corrigido com bypass explícito para `/api/webhooks/*` e `/api/pipeline/*`.
- **Nó "Busca dados da campanha" do workflow n8n**: headers errados (`x-ayon-webhook-secret`, específico do Ayon Creator, em vez de `apikey`/`Authorization: Bearer` que o Supabase exige) — `401` na primeira validação real. Corrigido; o branch de falha do workflow capturou e reportou o erro corretamente (sem cobrança de crédito), validando o desenho de tratamento de erro mesmo durante o bug.
- **`packages/core/src/index.ts`**: `verify-n8n-webhook-secret.ts` (usa `node:crypto`) foi exportado pelo barrel geral, quebrando o build do Next.js ao ser puxado por um Client Component. Mesma classe de bug já documentada no arquivo para `pdf-parse`/Mercado Pago/`jszip` — corrigido seguindo o mesmo padrão (removido do barrel, importado direto pelos 4 call sites).

## [0.9.0] — 2026-08-04

### Adicionado

- **Missão H2 — Fundação de qualidade**: zero teste automatizado e zero pipeline de CI em todo o repositório até aqui. Repositório publicado em `github.com/aionnewtech-afk/Ayon-Creator`.
  - **Testes**: Vitest para unitários (`packages/core`) e para RLS/concorrência (`supabase/tests/`, novo pacote do workspace, formaliza os testes ad hoc do H1 como suíte comitada rodando contra Postgres local efêmero). Playwright para o smoke test de browser do fluxo crítico completo (`apps/web/e2e/`), com um `LlmProvider` fake (`packages/core/src/providers/fake-llm-provider.ts`, `LLM_PROVIDER_MODE=fake`) — determinístico, sem custo de token nem dependência da API da Anthropic estar no ar.
  - **CI**: `.github/workflows/ci.yml` — 3 jobs no GitHub Actions (`quality`, `integration-tests`, `e2e`), os 2 últimos em paralelo, cada um sobe seu próprio Supabase local isolado.
  - **`supabase/seed.sql`** (novo): corrige grants ausentes num Postgres local criado só a partir das migrations (a plataforma Supabase concede isso automaticamente no projeto remoto; nenhuma migration deste repositório precisava até agora) — roda só em `supabase start`/`db reset`, nunca contra o remoto.

### Corrigido durante a validação real (primeira execução do CI no GitHub Actions)

- CI falhava no bootstrap do próprio `pnpm` (`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`) — `pnpm@11.18.0` exige Node.js ≥22.13, o workflow fixava `node-version: 20`. Corrigido para 22; `engines.node` do `package.json` raiz corrigido de `>=20` (nunca foi verdade) para `>=22.13`.

## [0.8.2] — 2026-08-04

### Corrigido

- **Fechamento da Missão H1**: 2 achados de uma auditoria rápida pós-H1 (verificação direta contra o Postgres remoto), fechados antes de autorizar o H2.
  - **Guarda da RPC `ensure_initial_provisioning` incompleta**: `revoke all ... from public` não removia o `EXECUTE` que o Supabase concede por padrão a `anon`; e `p_user_id != auth.uid()` retornava `NULL` (não bloqueava) quando os dois lados eram `NULL`. Corrigido com `revoke execute ... from anon` explícito + `is distinct from`. Migration `0016_hardening_provisioning_grant_fix.sql`. Validado ao vivo: chamada autenticada → sucesso; chamada anônima (com e sem `p_user_id`) → `permission denied` (`42501`); impersonação → `não autorizado` (`42501`).
  - **Ambiente de desenvolvimento**: organização de teste `h1test.upload`, não removida numa sessão anterior, limpa por completo. Causa raiz do `deleteUser()` "sempre falhando" (item 1.6 de `docs/hardening-plan.md`, aberto desde a Missão 6) encontrada: linha órfã em `user_profiles` nunca removida pelos scripts de cleanup, bloqueando a exclusão em cascata — corrigido, os 2 usuários de teste órfãos do H1 foram genuinamente excluídos.

## [0.8.1] — 2026-08-04

### Corrigido

- **Missão H1 — Sprint de Hardening, segurança crítica (P0)**: os 5 itens de segurança/race condition mais graves da auditoria pré-v1.0 (`docs/hardening-plan.md`), todos validados sob concorrência/permissão real e com regressão completa no browser.
  - **RLS de Storage**: as 3 policies `for all` de `storage.objects` (`brand-media`/`knowledge-base`/`content-output`) — que permitiam escrita a qualquer `viewer`, não só `editor+` — viram 12 policies por operação (`select` = `is_org_member`; `insert`/`update`/`delete` = `is_org_editor`). Migration `0013_hardening_storage_rls.sql`.
  - **Race condition no Provisionamento Inicial**: as 5 escritas separadas via PostgREST (sem transação, reproduzida criando organizações duplicadas desde a Missão 4) viram uma função Postgres única (`ensure_initial_provisioning`) com `pg_advisory_xact_lock` por usuário + checagem `auth.uid()` contra impersonação. Migration `0014_hardening_provisioning_lock.sql`.
  - **Race condition no portão de crédito**: trigger `enforce_credit_ledger_balance` (`select ... for update` + recálculo do saldo antes do insert) substitui o check-then-act antigo — garantia atômica contra saldo negativo mesmo sob concorrência real. Migration `0015_hardening_credit_ledger_balance.sql`.
  - **Validação de upload**: `next.config.mjs` ganha `serverActions.bodySizeLimit` explícito (20MB — o default do Next.js era 1MB e nunca tinha sido configurado). `uploadContentPieceMediaAction` passa a validar tamanho e tipo MIME real, com mensagens específicas.
  - **Next.js `14.2.35` → `15.5.22`** (React mantido em 18): resolve as 23 vulnerabilidades de dependência específicas do framework encontradas em `pnpm audit --prod` (10 `high`, incluindo DoS/SSRF em Server Actions/RSC). `cookies()` migrado para `async`/`await` próprio (não o atalho temporário `UnsafeUnwrappedCookies` do codemod oficial) em todos os 17 arquivos afetados.

### Observado durante a validação real (não é bug de código)

- `pnpm audit --prod` re-executado após o upgrade: 25 → 5 vulnerabilidades (2 `moderate`, 3 `high`), nenhuma relacionada ao Next.js — as 5 remanescentes (`postcss` transitivo, `sharp`/`libvips`) ficam registradas como novo item de follow-up em `docs/hardening-plan.md`, fora do escopo desta missão.

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
