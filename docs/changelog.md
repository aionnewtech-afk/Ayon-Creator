# Changelog de Documentação — Ayon Creator

> Todo pedido de nova funcionalidade gera uma entrada aqui, junto com as atualizações correspondentes em PRD.md, architecture.md, database.md e flows.md. Nenhuma implementação é feita sem uma entrada aprovada aqui.

---

## v2.23 (revisão 40) — 2026-08-04 — Missão 10 aprovada, escopo ajustado (categoria "Outro" + contexto automático)

**Status:** documentação aprovada pelo dono do produto, com 2 ajustes pedidos antes do código:

1. **Categoria `other`** ("Outro") — 4ª opção, além de Sugestão/Bug/Dificuldade de uso.
2. **Contexto automático** — `pathname`, `app_version`, `user_agent` gravados junto de todo envio, sem exigir nada do usuário.

**Decisões de arquitetura para o contexto automático** (arch. §13.1.1): `pathname` só existe no client (`usePathname()`); `user_agent` e `app_version` são lidos **no servidor** (`headers()` e `package.json`, respectivamente), nunca confiados de um valor enviado pelo client.

**Achado durante este ajuste:** `package.json` (raiz, `apps/web`, `packages/core`) nunca foi sincronizado com as tags de release — parado em `0.1.0` desde o início do projeto, apesar do repositório já estar em `v0.10.2`. Corrigido como parte desta missão; bumpar `package.json` passa a fazer parte do fechamento de toda missão a partir daqui, junto de `CHANGELOG.md` e da tag `git`.

**Documentos atualizados:** PRD.md (revisão 24), docs/architecture.md (revisão 31, nova §13.1.1/§13.1.2), docs/database.md (revisão 26, 3 colunas novas em `user_feedback`), docs/flows.md (revisão 27, Fluxo 14 passos 2/3), docs/ux-design.md (revisão 25, Modal de Feedback).

**Próximo passo:** implementação completa (migration, RLS, repository, Server Action, botão global, modal, validação real, typecheck/lint/build, testes, limpeza, commits, tag) — nesta mesma sessão.

---

## v2.22 (revisão 39) — 2026-08-04 — Preparação Missão 10 (Feedback do Usuário)

**Status:** documentação preparada — **aguardando aprovação explícita do dono do produto antes do início do código**, mesmo processo doc-first de toda missão anterior.

**Auditoria (antes de qualquer redação):** busca exaustiva por "feedback" em todo o código e documentação — zero resultado. Funcionalidade genuinamente nova, nenhum mecanismo equivalente já existente para reaproveitar ou entrar em conflito.

**Pedido do dono do produto:** botão "Enviar feedback" dentro da plataforma, abrindo um modal simples (categoria + descrição) que grava direto no banco (`user_feedback`) — sem interface administrativa nesta missão.

**Decisões de arquitetura tomadas (sem ambiguidade a resolver com o dono do produto — escopo já estava claro no pedido):**

1. **Não é um Core Engine nem Provider Layer** — é um utilitário transversal, mesmo raciocínio de exclusão já usado para justificar o Billing como módulo dedicado (arch. §12), aplicado a algo ainda mais simples.
2. **3 categorias fechadas**, exatamente como pedido: `suggestion` (Sugestão), `bug` (Bug), `difficulty` (Dificuldade de uso) — `check` constraint no banco, nunca uma lista aberta.
3. **`user_feedback` com `organization_id` e `user_id`**, mesmo padrão de isolamento multi-tenant de toda tabela do produto — mesmo sem interface administrativa agora, evita uma tabela "solta" sem RLS coerente com o resto do schema.
4. **Sem `select` de usuário final** — nem quem enviou vê o próprio feedback de volta pela aplicação (mesmo padrão de `provider_configs`/`specialists`, tabelas administrativas internas). Leitura é direta no banco (Supabase Studio/SQL), consistente com "sem interface administrativa nesta missão".
5. **Append-only** — sem `update`/`delete` de ninguém além de service role, mesmo espírito de `credit_ledger`/`audit_logs`.

**Documentos atualizados nesta revisão:**

1. **PRD.md** (revisão 23) — nova §9.3, escopo do MVP desta missão e o que fica explicitamente fora (sem interface administrativa, sem status, sem resposta ao usuário, sem anexos).
2. **docs/architecture.md** (revisão 30) — nova §13, justificativa de não ser Core Engine/Provider Layer, responsabilidade, onde vive no código (`UserFeedbackRepository`, sem Core Engine intermediário), segurança (RLS).
3. **docs/database.md** (revisão 25) — nova `user_feedback` (§9.3, ao lado de `audit_logs`/`feature_flags` — mesma família de tabela de plataforma), RLS documentada em §8. Nenhuma migration aplicada ainda.
4. **docs/flows.md** (revisão 26) — novo **Fluxo 14 — Enviar Feedback**, 6 passos, disponível em qualquer tela autenticada.
5. **docs/ux-design.md** (revisão 24) — novo **GLOBAL-4** (§3.10) e **Modal de Feedback** (§4.9).

**Nenhuma migration aplicada, nenhum código escrito.** Próximo passo: aprovação do dono do produto antes do primeiro commit de código.

---

## v2.21 (revisão 38) — 2026-08-04 — Missão 9, Etapa 1: gap de UI fechado + bug real de narração corrigido + guia de uso do zero

**Contexto:** ao preparar um passo a passo de uso "como usuário normal" (`docs/GETTING_STARTED.md`), a verificação real revelou que a Missão 9 nunca tinha sido conectada à interface — `generateVideoContentPieceAction` existia e estava validada por testes automatizados desde o fechamento formal da Etapa 1, mas nenhum componente de UI a chamava. `content-package-review.tsx` (CAMP-5) tinha só um branch binário (`text_only` vs. "qualquer outra coisa"), então a peça `video` caía no fluxo de upload manual pensado para `own_media`.

**UI conectada:**
- `content-package-review.tsx` ganha um terceiro branch para `licensed_stock_video`: botão **"Gerar vídeo automaticamente"** (`draft`), estado **"Gerando vídeo automaticamente..."** (`generating`), player de vídeo + Aprovar/Gerar de novo (`ready_for_review`), erro + **"Tentar novamente"** (`failed`).
- Polling simples (decisão de UX que estava em aberto desde `ux-design.md` §10, resolvida aqui): `getContentPieceAction` (novo, `asset-actions.ts`) consultado a cada 4s enquanto alguma peça de vídeo está `generating` — sem Realtime, sem infraestrutura nova.
- `ContentPieceView` ganha `mediaUrl` (signed URL da última `content_version`) — usado tanto pelo vídeo automático quanto, de brinde, pelo preview de `own_media` já enviado (nunca existia antes).

**★ Bug real encontrado e corrigido durante a validação end-to-end real (navegador de verdade, campanha real da Todo Canto Turismo):** o pipeline falhava com `"content_piece ... não tem script para narrar"`. Causa raiz: `approveCampaignStrategyAction` só chama `generateTextPiece` para formatos `text_only` — a peça `video` (agora `licensed_stock_video`, não mais `own_media`) nunca tinha `content_pieces.script` preenchido, e `narrateVideoContentPiece` exige um script para sintetizar a narração. Corrigido reaproveitando o texto já gerado da peça principal "Roteiro" (`is_primary`) como narração do vídeo — mesma narrativa central em dois formatos, sem chamada de LLM redundante, e sem risco do vídeo narrado divergir do roteiro escrito exibido ao usuário. Confirmado corrigido com uma segunda execução real do pipeline (mesma peça, script agora presente): `completed`, MP4 real de 37,5MB gravado no Storage, `content_versions` correta.

**`docs/GETTING_STARTED.md` (novo):** guia completo do zero — Docker/n8n, variáveis de ambiente, comando de start, criação de conta, confirmação de e-mail, assinatura de plano (Mercado Pago sandbox — achado real: sem assinatura ativa a criação de campanha é bloqueada), onboarding conversacional, criação de campanha e geração do primeiro vídeo. Todos os passos executados de verdade no navegador antes de serem documentados — inclusive o próprio achado do bug acima, encontrado durante essa execução real.

**Validação real:** `pnpm typecheck`/`lint`/`build` limpos nos 5 workspaces. Fluxo completo repetido no navegador (Anthropic real para o painel de especialistas + 5 peças de texto; ElevenLabs + Pexels + Shotstack + n8n reais para o vídeo) usando um objetivo real da Todo Canto Turismo — vídeo automático gerado, revisado e aprovável na tela, exatamente como um usuário final experimentaria.

---

## v2.20 (revisão 37) — 2026-08-04 — Missão 9, Etapa 1: ENCERRADA — n8n provisionado, Fluxo 13 validado de ponta a ponta em ambiente real

**Status: Missão 9, Etapa 1, completa e fechada.** Todos os critérios de aceite cumpridos com validação real (nenhum mock, nenhuma simulação):

- [x] Vídeo MP4 gerado automaticamente (Shotstack real, cenas do Pexels, narração do ElevenLabs)
- [x] `pipeline_runs` atualizado corretamente (`queued` → `running` → `completed`)
- [x] `content_versions` criada com `output_storage_path`/`generation_metadata` corretos
- [x] Créditos debitados **uma única vez** — idempotência confirmada (Fluxo 13, passo 6)
- [x] Workflow do n8n funcionando de ponta a ponta, ativo, disparado via webhook real
- [x] Documentação atualizada (`architecture.md` revisão 29, `n8n/README.md` novo)
- [x] Changelog atualizado (esta entrada)
- [x] Validação completa em ambiente real: ElevenLabs, Pexels, Shotstack, Supabase, pipeline completo e n8n — todos com chamada real, não simulada

### 1. Auditoria do ambiente (antes de qualquer alteração)

Confirmado via `docker ps`/`docker inspect`: já existia um container `n8n` rodando localmente (porta 5678, `unless-stopped`, criado há 3 semanas), mas pertencente a **outro projeto** do dono do produto (`atendimento-ai-plataform` — volume `atendimento-ai-plataform_n8n_data`, rede `atendimento-ai-plataform_default`, ao lado de uma stack Evolution API/WhatsApp). Reachable (`/healthz` → 200) mas com login próprio (`/rest/workflows` sem sessão → 401) — sem acesso, e sem motivo para ter. Nenhum `docker-compose.yml` existia no repositório do Ayon Creator. **Decisão do dono do produto, apresentada explicitamente antes de qualquer ação:** nova instância isolada, nunca reaproveitar a existente.

### 2. Provisionamento — n8n dedicado (Docker)

- `n8n/docker-compose.yml` (novo) — container `ayon-creator-n8n`, imagem `docker.n8n.io/n8nio/n8n:latest`, porta **5679** (5678 já ocupada pelo outro projeto), volume/rede próprios (`ayon_creator_n8n_data`), `N8N_SECURE_COOKIE=false` (instância só em http local).
- `n8n/.env.local.example` (novo, committed) / `n8n/.env.local` (gitignored, `N8N_ENCRYPTION_KEY` gerado).
- Setup do owner account: **não há bootstrap 100% headless** na versão atual do n8n (2.29.11) — feito uma vez via browser automation (Claude Browser), e uma API key gerada em Settings → n8n API para criar/gerenciar o workflow via script. Credenciais em `n8n/.env.local` (gitignored).
- **Conectividade container ↔ host confirmada antes de montar o workflow:** dentro do container, nosso app Next.js (rodando no host, fora de Docker) só é alcançável via `http://host.docker.internal:3010`, nunca `localhost` (que dentro do container aponta para o próprio container). Testado com `docker exec ... wget http://host.docker.internal:3010/...` antes de qualquer nó do workflow ser criado.

### 3. Workflow "Ayon Creator - Fluxo 13 (Pipeline de Vídeo)"

Construído e ativado via API pública do n8n (`POST /api/v1/workflows` + `/activate`), não pela UI manualmente — reprodutível por script. **Schema dos nós validado empiricamente antes do workflow real:** um workflow de teste mínimo (Webhook + HTTP Request) foi criado, ativado e disparado primeiro, confirmando a estrutura JSON exata (tipos de nó, `typeVersion`, formato de `headerParameters`/`jsonBody`) e o comportamento real de `onError: "continueErrorOutput"` (item roteado para o segundo output com `$json.error.message` populado) — mesma disciplina de "verificar antes de assumir" já usada para as APIs do ElevenLabs/Pexels/Shotstack.

Nós (documentados em detalhe em [n8n/README.md](../n8n/README.md)): **Webhook** (trigger) → **Busca dados da campanha** (Supabase REST) → **ElevenLabs** → **Pexels** → **Shotstack** → **Webhook de retorno (sucesso)**, com um nó paralelo **Webhook de retorno (falha)** recebendo o branch de erro de qualquer uma das 4 etapas anteriores. Cada nó de fornecedor é independente (`onError: continueErrorOutput`) — trocar um fornecedor futuro é editar um nó, não redesenhar o workflow.

### 4. Bug real encontrado e corrigido durante a integração (pedido explícito: parar, explicar, corrigir antes de continuar)

**Causa:** o nó "Busca dados da campanha" (consulta direta ao Supabase) usava o header `x-ayon-webhook-secret` (que só as rotas do Ayon Creator entendem) em vez do que o Supabase PostgREST exige (`apikey` + `Authorization: Bearer <service_role_key>`) — erro de copy-paste no script que montou o workflow (uma função helper aplicava o mesmo header a todos os nós HTTP, inclusive o que fala com um serviço externo diferente). Resultado: `401 - "No API key found in request"`.

**Efeito colateral positivo:** essa falha real validou o branch de erro do workflow antes mesmo do caminho feliz — o erro foi capturado (`continueErrorOutput`), roteado para "Webhook de retorno (falha)", que chamou `/api/webhooks/n8n` com `status: "failed"`; `pipeline_runs`/`content_pieces` foram marcados como `failed` corretamente, **sem nenhuma cobrança de crédito**. O desenho de tratamento de erro funcionou exatamente como projetado.

**Correção:** headers do nó "Busca dados da campanha" atualizados para `apikey`/`Authorization: Bearer <service_role_key>` via `PUT /api/v1/workflows/{id}`. Reexecutado — sucesso completo (ver §5).

**Segundo bug real, encontrado no `pnpm build` (não no runtime do workflow):** `packages/core/src/shared/verify-n8n-webhook-secret.ts` usa `node:crypto` (`timingSafeEqual`) e foi exportado pelo barrel geral (`packages/core/src/index.ts`) — que é importado por um Client Component (`apps/web/components/layout/sidebar.tsx`, só por causa de `hasMinimumRole`). Build do Next.js quebrou: `UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins`. **Mesma classe de bug que o próprio barrel já documentava e evitava** para `pdf-parse`, o SDK do Mercado Pago e `jszip` — desta vez eu mesmo cometi o erro que o comentário do arquivo já alertava. Corrigido seguindo exatamente o padrão já estabelecido: `verify-n8n-webhook-secret` removido do barrel geral, as 4 rotas que precisam dele importam direto de `@ayon/core/src/shared/verify-n8n-webhook-secret`. `pnpm build` limpo depois da correção.

### 5. Validação real de ponta a ponta (`video-pipeline-trigger-real.test.ts`, novo)

Fixture própria (organização/marca/campanha/sessão/peça, criada e removida a cada execução) chamando `triggerVideoGeneration` de verdade — que dispara o webhook do n8n real, o workflow processa narrate → scenes → render → completion, o teste faz polling em `pipeline_runs` até um estado terminal. **Rodado 3 vezes** (1ª: bug do header, capturado corretamente como `failed`; 2ª e 3ª, após as duas correções: `completed` em ambas, ~33-40s cada). Confirmado: `content_versions.output_storage_path` correto, `generation_metadata.video_render_provider_key = "shotstack"`, exatamente 1 lançamento em `credit_ledger` de -15 créditos (tier econômico) vinculado a `related_pipeline_run_id`.

**Suíte completa reexecutada ao final** (`pnpm --filter core exec vitest run`, sem filtro): 5 arquivos, 13 testes, todos passando — os 3 providers isolados, a resolução via Provider Gateway, o pipeline direto (sem n8n) e o pipeline via n8n real.

### 6. Checklist de disciplina de missão (pedido explícito)

- [x] Auditoria antes de alterar (§1)
- [x] Documentar antes quando necessário (decisão de nova instância apresentada ao dono do produto antes de provisionar)
- [x] Validação real em cada etapa (schema do n8n testado isoladamente antes do workflow real; conectividade container↔host testada antes dos nós; workflow testado após cada correção)
- [x] `pnpm typecheck` limpo (todos os 5 workspaces)
- [x] `pnpm lint` limpo
- [x] `pnpm build` limpo (depois da correção do bug do barrel)
- [x] Limpeza de dados de teste confirmada por query direta (zero linhas remanescentes desta sessão — um órfão pré-existente de uma sessão anterior, `missao8.learningtest`, identificado mas **não tocado**, fora do escopo desta missão, sinalizado à parte)
- [ ] Commits organizados + tag de release — próximo passo desta mesma sessão, após esta entrada de changelog

**Documentos atualizados nesta revisão:** `docs/architecture.md` (revisão 29), `docs/changelog.md` (esta entrada), `n8n/README.md` (novo).

**Missão 9, Etapa 1: encerrada.** Etapa 2 (avatar de IA, HeyGen, recurso Premium) permanece como trabalho futuro, sem código, aguardando priorização do dono do produto — nenhuma dependência bloqueante deixada pela Etapa 1.

---

## v2.19 (revisão 36) — 2026-08-04 — Missão 9, Etapa 1: pipeline completo implementado e validado (sem n8n provisionado ainda)

**Status:** todo o lado da aplicação está pronto e validado com chamadas reais de ponta a ponta (ElevenLabs + Pexels + Shotstack + Supabase reais) — falta só a peça externa: uma instância de n8n provisionada e o workflow em si configurado nela. Confirmado com o dono do produto antes de começar: **n8n ainda não está provisionado**, então o pipeline foi construído com a extremidade de disparo (nós → n8n) e a extremidade de recebimento (n8n → nós, 4 rotas HTTP) prontas e testadas separadamente — a orquestração real dentro do n8n é o próximo passo, pendente de infraestrutura externa ao código.

**Migration `0017_asset_engine_video_pipeline.sql` (aplicada e validada em produção):**
- `provider_configs.capability` ganha `video_render`; `content_pieces.status` ganha `failed`.
- **`pipeline_runs` criada pela primeira vez** — achado confirmado nesta implementação: a tabela estava documentada em `database.md` §4.8 desde revisões antigas como já existente, mas nenhuma migration a criou até agora (nenhuma missão anterior precisou de execução assíncrona de verdade). RLS por organização via novo helper `pipeline_run_organization_id`.
- `credit_ledger` ganha `related_pipeline_run_id` (único — idempotência do débito assíncrono).
- `credit_pricing` ganha `video_generation` (15/30/50 créditos por tier — **valores placeholder**, decisão final do dono do produto continua em aberto, PRD §13 item 11).
- `provider_configs` seed: `voice`/`media`/`video_render` × 3 tiers, um fornecedor cada (ElevenLabs/Pexels/Shotstack), confirmado pelo teste de resolução via Provider Gateway (`provider-gateway-video-real.test.ts`, v2.18).

**Implementação do pipeline (`packages/core/src/asset-engine/`):**
- `video-pipeline-narrate.ts` — Voice Provider (ElevenLabs), grava o áudio no bucket `content-output`, devolve signed URL + `captionCues`.
- `video-pipeline-scenes.ts` — Media Provider (Pexels), encadeia candidatos em sequência até cobrir a duração da narração (simplificação deliberada da Etapa 1 — seleção por trecho/caption-cue fica para refinamento futuro).
- `video-pipeline-render.ts` — Video Render Provider (Shotstack), baixa o MP4 final e regrava no nosso Storage (nunca depende de URL temporária de terceiro).
- `video-pipeline-complete.ts` — `completeVideoPipelineSuccess`/`completeVideoPipelineFailure`, chamadas pelo webhook de conclusão: cria `content_versions`, atualiza `content_pieces.status`/`pipeline_runs`, e só em caso de sucesso registra o consumo de crédito (`recordConsumption`, idempotente via `related_pipeline_run_id`).
- `video-pipeline-trigger.ts` — `triggerVideoGeneration`: portão de crédito, `content_pieces.status = generating`, cria `pipeline_runs` (`queued`), dispara o n8n via webhook autenticado. Falha de forma limpa e recuperável (`content_pieces.status = failed`) quando `N8N_WEBHOOK_URL`/`N8N_WEBHOOK_SECRET` não estão configuradas — comportamento esperado e testado enquanto o n8n não existe.
- `initializeCampaignContentPieces` atualizada: `production_mode` do formato `video` passa de `own_media` para `licensed_stock_video` — sem essa mudança, o pipeline novo nunca seria acionado por nenhuma campanha criada depois desta revisão.
- `generateVideoContentPieceAction` (novo, `criar-campanha/asset-actions.ts`) — entrada da Server Action para CAMP-5, mesmo padrão de erro/bloqueio de `regenerateContentPieceAction`.

**Rotas HTTP novas (`apps/web/app/api/`)** — todas autenticadas por segredo compartilhado (`x-ayon-webhook-secret`, comparação em tempo constante — `verifyN8nWebhookSecret`), nunca por sessão de usuário (chamadas servidor-a-servidor do n8n não carregam cookie):
- `pipeline/video/narrate`, `pipeline/video/scenes`, `pipeline/video/render` — uma por etapa, para que o n8n possa reexecutar uma etapa isoladamente sem repetir as anteriores (retentativa granular, arch. §8).
- `webhooks/n8n` — conclusão do pipeline (sucesso ou falha), mesmo princípio de sempre-200 do webhook do Mercado Pago (nunca causar reentrega indefinida por um erro já logado).

**★ Bug real encontrado e corrigido — `apps/web/middleware.ts`:** o `matcher` do middleware de autenticação cobria `/api/**` inteiro, redirecionando (307) para `/login` qualquer chamada sem sessão de usuário — inclusive `/api/webhooks/mercado-pago`, que tem autenticação própria por assinatura e nunca deveria depender de sessão do Supabase Auth. Confirmado com `curl` direto contra o Mercado Pago **antes** da correção: 307 para `/login` em vez de chegar à validação de assinatura. Bug pré-existente desde a Missão 6, nunca pego porque nenhum teste automatizado exercita esse webhook via HTTP real (só validação manual, que aparentemente nunca reproduziu esse caminho). Corrigido com um bypass explícito para `/api/webhooks/*` e `/api/pipeline/*` no início do middleware — confirmado depois com o mesmo `curl`: o Mercado Pago passou a responder `400` (chegando à validação de assinatura de verdade) em vez de `307`.

**Validação real (ponta a ponta, `video-pipeline-real.test.ts`):** fixture própria (organização/marca/campanha/sessão/peça de teste, criada e removida a cada execução) rodando a sequência completa narrate → scenes → render → complete contra ElevenLabs/Pexels/Shotstack/Supabase reais. Confirmado: `content_versions` criada com o MP4 final no Storage, `content_pieces.status = ready_for_review`, `pipeline_runs.status = completed`, exatos 15 créditos debitados (tier econômico), **idempotência confirmada** — uma segunda chamada de `completeVideoPipelineSuccess` com o mesmo `pipelineRunId` não debita de novo. Zero dados de teste remanescentes após a limpeza (confirmado por query direta pós-execução).

**Ainda pendente (não bloqueante para o código, bloqueante para o pipeline funcionar de ponta a ponta):** provisionar uma instância de n8n e montar o workflow que: recebe o webhook de disparo, chama em sequência `pipeline/video/narrate` → `pipeline/video/scenes` → `pipeline/video/render`, e por fim chama `webhooks/n8n` com o resultado. Nenhuma decisão de arquitetura nova necessária para isso — as 4 rotas já expõem exatamente o contrato que o workflow precisa orquestrar.

---

## v2.18 (revisão 35) — 2026-08-04 — Missão 9, Etapa 1: 3 providers implementados e validados com chamadas reais

**Status:** primeiro código real da Missão 9. Implementados e validados com ElevenLabs, Pexels e Shotstack reais (contas do dono do produto, sandbox do Shotstack) os 3 adapters da Etapa 1 — nenhum mock. **Nenhum bug encontrado na primeira validação** — os 3 passaram de primeira, sem precisar de correção no adapter.

**Implementação:**

- `packages/core/src/providers/voice-provider.ts` + `elevenlabs-voice-provider.ts` — `POST /v1/text-to-speech/{voice_id}/with-timestamps` (não o endpoint simples de TTS): a marcação de tempo por caractere que esse endpoint devolve é usada diretamente para montar `captionCues`, confirmando em produção real a decisão já registrada em [architecture.md §3.5.1](../docs/architecture.md#351-geração-automática-de-vídeo-★-novo-preparação-missão-9) (revisão 26) — nenhuma capacidade de transcrição separada foi necessária.
- `packages/core/src/providers/media-provider.ts` + `pexels-media-provider.ts` — `GET /videos/search` (endpoint correto confirmado por pesquisa antes de codar: **não** é `/v1/videos/search`, apesar de alguma documentação de terceiros sugerir isso) + `GET /videos/videos/{id}` para `fetchMedia`.
- `packages/core/src/providers/video-render-provider.ts` + `shotstack-video-render-provider.ts` — submete a `POST {host}/render`, faz polling em `GET {host}/render/{id}` até `status = "done"` (confirmado por pesquisa antes de codar: **não** é `"completed"`, valor que uma primeira leitura de documentação de terceiros sugeriu incorretamente — teria causado um bug de polling infinito se não verificado). Timeline monta 1 track de legenda (`asset.type = "title"`, um clip por `captionCue`) + 1 track de vídeo (cenas) + 1 `soundtrack` (narração).
- `SHOTSTACK_HOST` normalizado defensivamente no adapter (remove `/render` final e barras finais) — achado durante a configuração: o valor real configurado pelo dono do produto incluía `/render` no fim (`.../edit/stage/render`), divergente do formato documentado em `.env.local.example` (`.../edit/stage`); em vez de pedir para reconfigurar, o adapter passou a aceitar as duas formas.
- Teste de validação `video-providers-real.test.ts` — cada um dos 3 testes só roda quando a env var correspondente existe (`it.skipIf`), nunca entra no `pnpm test`/CI normal sem as 3 chaves reais configuradas. Confirmado que, sem as chaves, os 3 pulam (não falham) e o restante da suíte (`slug.test.ts`) continua passando.
- Env vars (`ELEVENLABS_API_KEY`, `PEXELS_API_KEY`, `SHOTSTACK_API_KEY`, `SHOTSTACK_HOST`) adicionadas a `.env.local.example` e configuradas pelo dono do produto nos dois `.env.local` (raiz e `apps/web`) — sincronizadas manualmente entre os dois arquivos (mesmo processo manual já documentado como dívida técnica em [hardening-plan.md, item 2.2](hardening-plan.md#2-dívidas-técnicas)).

**Validação real (contas do dono do produto) — latência e custo, pedido explícito para embasar a precificação de `video_generation` (PRD §13, item 11, ainda em aberto):**

| Provider | Operação testada | Tempo medido (chamada real) | Custo |
|---|---|---|---|
| **ElevenLabs** | `synthesizeVoice` — roteiro de 97 caracteres → 7.338s de áudio | 5.25s | Cobrado por **caractere de entrada**, não por tempo de resposta nem duração de saída: US$0,09–0,20 por 1.000 caracteres, conforme o plano (Free US$0,10 · Starter US$0,20 · Creator US$0,09 · Pro/Scale/Business ~US$0,17). Um roteiro de 97 caracteres custa **~US$0,01–0,02** na tabela pública. |
| **Pexels** | `searchMedia` (3 candidatos) + `fetchMedia` (1 candidato específico) | 2.06s (search) + 0.24s (fetch) | **Gratuito** — sem custo monetário, sujeito a rate limit por API key (não medido nesta validação). |
| **Shotstack** | `composeVideo` — 1 cena (5s) + narração + 1 cue de legenda, submit → `done` | 16.32s | **Sandbox (stage), usado nesta validação:** sem cobrança monetária direta, mas consome créditos de teste (10 grátis por conta, expiram em 30 dias) e o vídeo final sai com marca d'água — não representativo do custo real de produção. **Produção (`v1`):** US$0,20/min (plano Subscription) a US$0,30/min (Pay-as-you-go), arredondado para o segundo — um clipe de 5s equivale a **~US$0,017–0,025** na tabela pública. |

**Nota de honestidade sobre os números de custo:** valores de tabela pública consultados nesta revisão (preços dos fornecedores podem mudar sem aviso), não faturamento real confirmado nas contas do dono do produto — suficientes para uma primeira estimativa de precificação de `video_generation`, mas não uma fonte de verdade de billing. Tempo de resposta é de uma única chamada por fornecedor, ambiente de desenvolvimento, sem repetição estatística — indicativo de ordem de grandeza (ElevenLabs ~5s, Pexels ~2s, Shotstack sandbox ~16s para um clipe curto), não uma média formal com desvio padrão.

**Ainda não iniciado:** montagem do pipeline completo (Fluxo 13 — upload do áudio sintetizado ao Storage, n8n, `pipeline_runs`, webhook de conclusão, credit gate assíncrono). Próximo passo, conforme combinado com o dono do produto.

---

## v2.17 (revisão 34) — 2026-08-04 — Missão 9 dividida em 2 etapas (Etapa 1: sem avatar)

**Status:** decisão de escopo do dono do produto, antes de qualquer código escrito. Enquanto as contas/API keys de ElevenLabs, HeyGen, Pexels e Shotstack são providenciadas, o dono do produto revisitou o tamanho da fatia vertical da Missão 9 e decidiu reduzi-la — mesma disciplina de "uma fatia por vez" já usada em todas as missões anteriores.

**Decisão:** Missão 9 passa a ser implementada em 2 etapas:

- **Etapa 1 (próxima implementação):** só `production_mode = licensed_stock_video`. Pipeline completo de ponta a ponta — roteiro → narração (ElevenLabs) → cenas (Pexels) → composição (Shotstack) → MP4 vertical 9:16 com legenda — sem depender de avatar em nenhum ponto.
- **Etapa 2 (futura, recurso Premium):** `ai_avatar` (HeyGen) e `hybrid` (que depende de avatar). A Provider Layer permanece preparada para HeyGen desde já (contrato `avatar` documentado em [architecture.md §5](../docs/architecture.md#5-provider-layer-adapters-plugáveis-resolvidos-por-tier)), mas **zero código de avatar nesta etapa** — nenhuma implementação de HeyGen bloqueia o fechamento da Etapa 1. Quando implementado, avatar de IA passa a ser um recurso exclusivo do tier Premium (decisão de produto nova, não só adiamento técnico).

**Por que isso reduz risco de retrabalho:** a Etapa 1 já entrega o pipeline assíncrono completo (n8n, `pipeline_runs`, webhook de conclusão, credit gate assíncrono, legendas) com só 2 fornecedores externos novos (ElevenLabs, Pexels) em vez de 3 (+ HeyGen) — menos superfície para validar de uma vez, e a peça mais arquiteturalmente nova do produto (execução assíncrona) fica provada com menos variáveis simultâneas. A Etapa 2 herda a mesma infraestrutura (Fluxo 13, Provider Gateway, credit gate) sem redesenho — só um adapter novo + um branch a mais no passo 3 do pipeline.

**Documentos atualizados nesta revisão:** PRD.md (revisão 22), docs/architecture.md (revisão 27), docs/database.md (revisão 24 — sem mudança de schema, só nota de escopo), docs/flows.md (revisão 25), docs/ux-design.md (revisão 23). docs/engine-behavior.md **não precisou de mudança** — os princípios de narração/seleção de cena já documentados na §5.1 não fazem nenhuma menção específica a avatar que precisasse ser removida ou adiada.

**Nenhuma mudança de schema.** `content_pieces.production_mode` já suportava `ai_avatar`/`hybrid` desde a revisão 3 do banco — a Etapa 1 simplesmente não grava nenhuma linha com esses valores ainda; nenhuma migration é afetada por essa divisão.

**Ainda sem código.** Próximo passo inalterado: obtenção de contas/API keys de ElevenLabs, Pexels e Shotstack (HeyGen adiado para quando a Etapa 2 for aprovada) antes do primeiro commit.

---

## v2.16 (revisão 33) — 2026-08-04 — Missão 9 aprovada, fornecedores concretos definidos

**Status:** documentação da Missão 9 (v2.15/revisão 32) **aprovada pelo dono do produto**. Fornecedores concretos escolhidos para o MVP, fechando as últimas decisões que bloqueavam o início do código. Ainda sem nenhuma linha de código escrita — próximo passo é a resolução operacional (contas/API keys dos 4 fornecedores) antes do primeiro commit.

**Decisões do dono do produto nesta rodada:**

1. Nome interno mantido **Asset Engine** (confirmado novamente).
2. Modos `stock_video`/`ai_avatar`/`hybrid` confirmados, somados a `text_only`/`own_media` já existentes desde a Missão 7 — mapeados no schema a `licensed_stock_video`/`ai_avatar`/`hybrid`/`text_only`/`own_media` (PRD §4.2).
3. n8n confirmado como orquestrador oficial dos pipelines assíncronos (já havia sido decidido na rodada anterior — reafirmado).
4. `video_render` confirmado como capacidade nova do Provider Gateway (idem — reafirmado).
5. **Fornecedores concretos definidos, um por capability, desacoplados via Provider Gateway** (nenhum Core Engine os conhece diretamente):
   - **Voice Provider = ElevenLabs** — já era o fornecedor documentado desde a revisão 3 da arquitetura, nunca implementado. Achado favorável durante esta rodada: a API já retorna marcação de tempo por caractere junto do áudio sintetizado, resolvendo de quebra a decisão em aberto sobre mecanismo de legenda (PRD §13, item 10) — usada diretamente para `captionCues`, sem precisar de uma capacidade de transcrição própria.
   - **Avatar Provider = HeyGen** — idem, já documentado desde a revisão 3, nunca implementado.
   - **Media Provider = Pexels** — resolve PRD §13, item 6 (decisão em aberto desde a revisão original do documento). Escolhido por ser API de banco de vídeo licenciado gratuita para uso comercial, coerente com a filosofia de custo do produto (§8).
   - **Video Render Provider = Shotstack** — resolve PRD §13, item 10 (parte do fornecedor). Composição de vídeo via API com timeline em JSON, suporta formato vertical 9:16 e burn-in de legenda — contrato compatível com `composeVideo` já especificado.
6. **Mapeamento tier → fornecedor resolvido para o MVP:** um único fornecedor por capability, o mesmo em todos os tiers (Econômico/Balanceado/Premium) — diferenciação por tier dentro de cada capability fica para quando houver demanda real, mesmo raciocínio já usado para os modelos de LLM dos especialistas do Intelligence Hub. Resolve PRD §13, item 2 (aberto desde a revisão original do PRD, nunca antes bloqueava nenhuma implementação em andamento).
7. **Precificação em créditos (`video_generation`) permanece em aberto** por decisão explícita — não bloqueia migration nem implementação (linha com placeholder, ajustável por `UPDATE`, mesmo padrão de `asset_generation`/`trend_ranking`).
8. **Confirmado, sem mudança de schema:** `pipeline_runs.status` já tinha o ciclo `queued → running → completed`/`failed` desde a definição original da tabela (revisões antigas do banco), e o Fluxo 13 (v2.15) já usava exatamente essa sequência — o pedido do dono do produto de um estado `queued` antes de `running` já estava satisfeito pelo desenho anterior.

**Documentos atualizados nesta revisão:** PRD.md (revisão 21), docs/architecture.md (revisão 26), docs/database.md (revisão 23) — §5/§10 (architecture) e stack/§13 (PRD) resolvidos com os 4 fornecedores; nenhuma mudança de schema em database.md além de uma nota confirmando o ciclo de `pipeline_runs.status` já existente. docs/flows.md, docs/ux-design.md e docs/engine-behavior.md **não precisaram de mudança nesta rodada** — descreviam o pipeline/contratos em termos de capability, não de fornecedor, então já estavam corretos.

**Único item real e não-bloqueante que permanece em aberto:** regra de segmentação do modo `hybrid` (quais trechos do roteiro usam avatar vs. banco de vídeo) — fallback simples (peça inteira em um dos dois modos) é suficiente para começar a implementação.

**Ainda sem código.** Próximo passo: obtenção de contas/API keys dos 4 fornecedores (ElevenLabs, HeyGen, Pexels, Shotstack) — pré-requisito operacional, não de documentação — antes do primeiro commit da Missão 9.

---

## v2.15 (revisão 32) — 2026-08-04 — Auditoria e preparação doc-first da Missão 9 (Asset Engine ganha geração automática de vídeo)

**Status:** documentação preparada — **aguardando aprovação explícita do dono do produto antes do início do código**, seguindo o mesmo processo doc-first de todas as missões anteriores. Fornecedores concretos de Avatar/Voice/Media/Video Render Provider e o mecanismo exato de legenda (quando o Voice Provider não suporta marcação de tempo nativa) seguem em aberto e **bloqueiam o início do código**, não a aprovação da documentação (PRD §13, itens 2/6/10).

**Objetivo da missão:** transformar a produção de vídeo do Asset Engine de "upload manual pelo cliente" (Missão 7) em geração automática — vídeo vertical 9:16, narração por IA, montagem automática (avatar de IA e/ou banco de vídeo licenciado), legendas, exportação em MP4, integrado ao pacote final da campanha.

**Auditoria técnica realizada antes de qualquer mudança de documento** (código e schema lidos diretamente, não por suposição):

- Confirmado: `production_mode` hoje só cobre `text_only`/`own_media` de fato ([initialize-campaign-content-pieces.ts](../packages/core/src/asset-engine/initialize-campaign-content-pieces.ts) hardcoda esse mapeamento). `ai_avatar`/`licensed_stock_video`/`hybrid` já existem no enum do schema desde a revisão 3 do banco, nunca usados em código.
- Confirmado: Provider Gateway (`provider-gateway.ts`) só resolve `llm` e `trend_source` — zero adapter de Avatar/Voice/Media em qualquer lugar do repositório (busca exaustiva, sem resultado).
- Confirmado: nenhuma biblioteca de renderização/composição de vídeo em nenhum `package.json` do monorepo — a capacidade de "compor cenas + narração + legenda em um MP4" não existia nem como conceito documentado antes desta revisão.
- **Contradição de documentação encontrada:** `docs/engine-behavior.md` §5 (Asset Engine) ainda dizia "Ainda sem código" — mas o Asset Engine foi implementado e validado desde a Missão 7; o próprio §8 do mesmo documento já registrava isso corretamente. Seção nunca atualizada quando a Missão 7 fechou — mesma classe de lacuna já encontrada 2x antes (Trend Engine, revisões 12/13 do mesmo documento). Corrigida nesta revisão.
- **Decisões de produto em aberto identificadas e levadas ao dono do produto antes de qualquer redação de documento** (regra do processo, mesmo padrão já usado nas Missões 5 e demais): o que é "banco de cenas" (Media Provider externo vs. biblioteca interna), se avatar é obrigatório no MVP, como o vídeo final é de fato renderizado, e como tratar a primeira operação genuinamente assíncrona do produto.

**Decisões do dono do produto (após apresentação das opções, antes de qualquer redação de documento):**

1. **Avatar não é obrigatório.** O Asset Engine passa a suportar três modos de produção de vídeo, todos igualmente válidos: `stock_video` (mapeado ao `licensed_stock_video` já existente no schema), `ai_avatar` e `hybrid`.
2. **Nova capacidade `video_render` na Provider Gateway** (não reaproveita nenhuma capacidade existente) — composição final de vídeo (cenas + narração + legenda → MP4), mantendo a Provider Layer desacoplada de fornecedor: o Asset Engine nunca sabe qual serviço externo está renderizando.
3. **Precificação em créditos própria para vídeo**, `trigger_reason` `video_generation` separado de `asset_generation` (texto) — valores exatos por tier ficam como decisão em aberto até o doc-first (não bloqueia migration, mesmo padrão já usado para `asset_generation`/`trend_ranking`: linha com placeholder, ajustável por `UPDATE`).
4. **n8n passa a fazer parte oficialmente da arquitetura** nesta missão — primeira ativação real (Missões 2 a 8 nunca precisaram dele), responsável pelos pipelines assíncronos de geração de vídeo. Resolve a decisão em aberto de longa data [architecture.md §10, item 2](../docs/architecture.md#10-decisões-em-aberto-arquitetura) ("composição de vídeos híbridos: n8n ou dentro do Asset Engine?").
5. **Nome interno do Core Engine mantido como "Asset Engine"** — não é um rebranding para "Multimedia Engine" apesar do objetivo da missão ser descrito assim; só a responsabilidade do módulo se expande.

**Documentos atualizados nesta revisão** (ordem do processo doc-first, [README.md](../README.md#regra-de-trabalho)):

1. **PRD.md** (revisão 20) — §4.2 (modos de produção passam de especificação para escopo aprovado), §9.1 (itens explícitos de geração de vídeo no MVP), §10 (stack ganha Video Render Provider + nota de ativação do n8n), §13 (itens 2/4/6 atualizados com nota de bloqueio; novos itens 10 e 11 — fornecedor/legenda e precificação).
2. **docs/architecture.md** (revisão 25) — nova §3.5.1 (pipeline completo de geração de vídeo: narração → cenas → composição), §5 (nova capacidade `video_render`), §8 reescrita (n8n ativado, papel real no pipeline de vídeo), §12.3/§12.4 (portão de crédito assíncrono, novo `trigger_reason`), §10 (item 2 resolvido, item 6 marcado como bloqueante, novo item 12).
3. **docs/database.md** (revisão 22) — `provider_configs.capability` ganha `video_render`; `content_pieces.status` ganha `failed`; `content_versions.generation_metadata` ganha `video_render_provider_key`; `pipeline_runs` (§4.8, existente desde revisões antigas, nunca usada) marcada para ativação real; `credit_ledger` ganha `related_pipeline_run_id` (idempotência de cobrança assíncrona); `credit_pricing` ganha `video_generation`; RLS de `pipeline_runs` documentada; novo item em §10.
4. **docs/flows.md** (revisão 24) — Fluxo 3 §3.2 reescrito para o formato `video`; novo **Fluxo 13 — Pipeline de Geração de Vídeo (n8n)**, passo a passo completo; Fluxo 6 atualizado (cobrança assíncrona via webhook); Convenções de Status ganha `failed`/`pipeline_runs`; 2 novos itens em Decisões em Aberto.
5. **docs/ux-design.md** (revisão 22) — CAMP-4/5 ganham estados de geração de vídeo assíncrona e falha/"tentar novamente"; §4.5/§4.6 atualizados; 2 novos itens em Decisões em Aberto (Realtime vs. polling, feedback de tempo estimado).
6. **docs/engine-behavior.md** (revisão 16) — §5 corrigida (contradição "ainda sem código") + nova §5.1, princípios de comportamento específicos de narração/seleção de cena para geração de vídeo.

**Nenhuma migration aplicada, nenhum código escrito** — esta revisão é só documentação, aguardando aprovação antes de qualquer implementação, exatamente como pedido.

**Próximo passo:** aprovação do dono do produto sobre esta preparação; depois, resolução dos fornecedores concretos (Media/Video Render/Avatar/Voice Provider) e do mecanismo de legenda antes do primeiro commit de código da Missão 9.

---

## v2.14 (revisão 31) — 2026-08-04 — Missão H2 (Fundação de qualidade) implementada, validada e encerrada

**Status:** implementado e validado — repositório publicado no GitHub, CI real rodando no GitHub Actions. Fecha os itens P0 de §7/§8 do plano de hardening (7.1, 7.2, 7.3, 7.4, 8.1, 8.2).

**Pré-requisito resolvido antes da implementação:** repositório criado em `github.com/aionnewtech-afk/Ayon-Creator`; remote `origin` configurado e histórico completo (todos os commits + as 9 tags de `v0.1.0` a `v0.8.2`) enviado.

**Implementação:**

- **Testes:** Vitest em `packages/core` (unitários, `slug.test.ts`) e no novo pacote de workspace `supabase/tests/` (RLS e concorrência, formalizando os testes ad hoc já validados no H1 — RLS de Storage, race condition do provisionamento, race condition do portão de crédito — como suíte comitada rodando contra Postgres local efêmero via `supabase start`). Playwright em `apps/web/e2e/` — smoke test do fluxo crítico completo (login → campanha → aprovação da estratégia → 5 peças de texto → upload de mídia própria → aprovação das 9 peças → pacote montado → download), usando um `LlmProvider` fake (`packages/core/src/providers/fake-llm-provider.ts`, selecionado só por `LLM_PROVIDER_MODE=fake`) — determinístico, sem custo de token; validação com Anthropic real continua manual a cada missão, como já era.
- **Decisão de escopo:** o smoke test semeia uma marca já onboarded direto via service role (`e2e/support/seed.ts`), pulando a conversa real de onboarding — mantém o smoke test rápido e determinístico; a conversa em si segue validada manualmente.
- **CI:** `.github/workflows/ci.yml` — 3 jobs (`quality`: typecheck+lint+build, sem Docker; `integration-tests`: Vitest de RLS/concorrência; `e2e`: Playwright), os 2 últimos em paralelo, cada um sobe seu próprio Supabase local isolado via `supabase/setup-cli`, credenciais capturadas dinamicamente via `supabase status -o json`.

**Achados durante a implementação (nenhum previsto por nenhuma migration/decisão anterior):**

1. Um Postgres local criado só a partir das nossas migrations não replica os grants que o projeto remoto hospedado recebe automaticamente da plataforma Supabase — corrigido com `supabase/seed.sql` (convenção oficial do CLI, roda só em `start`/`db reset`, nunca contra o remoto). De brinde, confirma que as 16 migrations aplicam limpo do zero pela primeira vez.
2. CI falhou na primeira execução real: `pnpm@11.18.0` exige Node.js ≥22.13, o workflow fixava `node-version: 20`. Corrigido para 22; `engines.node` do `package.json` raiz corrigido de `>=20` (nunca foi verdade) para `>=22.13`.
3. `slugify()` remove underscore em vez de tratá-lo como separador — descoberto pelo primeiro teste unitário do repositório, que assumia o comportamento errado. Teste corrigido, função não mudou (comportamento já em produção).
4. Cleanup do smoke test esquecia `learning_signals` (aprovar peça emite sinal, Missão 8), bloqueando a exclusão de `content_pieces` por FK — corrigido antes do primeiro commit.

**Validação real:** suíte completa (`packages/core` + `supabase/tests` + Playwright) rodando localmente (Docker + Supabase CLI) e depois numa execução real do GitHub Actions após a correção do achado 2 — os 3 jobs terminaram verdes.

**Documentação atualizada nesta revisão:** `docs/hardening-plan.md` (seção "Missão H2 — concluída e validada", checklist §10 atualizado), `CONVENTIONS.md` (já atualizado na preparação, sem mudança adicional), `README.md` (badge de CI, estado do projeto), `CHANGELOG.md` (`[0.9.0]`).

**Próximo passo:** H2 encerrada. H3 (índices de banco + observabilidade) fica para quando o dono do produto autorizar o início.

---

## v2.13 (revisão 30) — 2026-08-04 — Auditoria e preparação doc-first da Missão H2 (Fundação de qualidade)

**Status:** documentação pronta — **aguardando aprovação explícita do dono do produto antes do código**, seguindo o mesmo processo doc-first das missões anteriores. H2 não é escopo de produto (não muda PRD.md/architecture.md/database.md/flows.md/ux-design.md) — é fundação de engenharia, documentada em `docs/hardening-plan.md` e `CONVENTIONS.md`.

**Escopo:** itens P0 de §7 (Testes automatizados) e §8 (CI/CD) do plano de hardening — 7.1, 7.2, 7.3, 7.4, 8.1, 8.2.

**Achados da auditoria:**

1. **Repositório sem remote git** — `git remote -v` vazio, `gh` CLI não instalado neste ambiente. GitHub Actions é impossível hoje sem esse pré-requisito externo.
2. **Zero framework de teste, zero arquivo de teste** — confirmado de novo, mesmo resultado da auditoria original.
3. **Inconsistência interna corrigida:** item 7.4 (teste de concorrência do credit gate) estava marcado **P1** na tabela §7, mas a "Priorização consolidada" já o incluía no bloco P0. Corrigido para P0, alinhado ao agrupamento da própria Missão H2.
4. **Nenhuma outra correção necessária** nos 5 documentos de produto — H2 não introduz nem contradiz nenhuma decisão de produto já registrada.
5. **`resolveLlmProvider` sem ponto de injeção de teste** — precisa de um gate explícito por variável de ambiente para suportar um provider fake no smoke test.
6. **Docker Desktop instalado mas com o daemon parado** nesta máquina — não bloqueia CI (runners do GitHub Actions têm Docker por padrão), mas bloqueia rodar a suíte de RLS/concorrência localmente até ser iniciado.
7. **As 16 migrations nunca foram testadas aplicando do zero** contra um Postgres vazio — `supabase start` no CI valida isso de brinde.

**Decisões arquiteturais apresentadas ao dono do produto antes de qualquer doc-first — todas aprovadas como recomendado:**

1. **Hosting do CI:** dono do produto cria o repositório no GitHub e passa a URL — pré-requisito externo antes da implementação.
2. **Frameworks:** Vitest (RLS/concorrência + unitários de `packages/core`) + Playwright (smoke test de browser real).
3. **Banco de teste:** Postgres local efêmero via Supabase CLI (`supabase start`, Docker) — isolado do projeto real, migrations aplicadas do zero a cada execução.
4. **LLM no smoke test:** provider fake selecionável por variável de ambiente — determinístico, sem custo de token; validação com Anthropic real continua manual a cada missão.

**O que mudou nos documentos:**

- **`docs/hardening-plan.md`:** item 7.4 corrigido de P1 para P0. Nova seção "Missão H2 — Fundação de qualidade: auditoria e escopo técnico aprovado" com os achados, as 4 decisões aprovadas e a tabela de escopo técnico planejado (estrutura de arquivos de teste, workflow de CI, provider fake).
- **`CONVENTIONS.md`:** novo §10 "Testes automatizados" (frameworks, onde cada tipo de teste vive, banco de teste, provider fake, nomenclatura) e §11 "CI/CD" (workflow, branch protection como passo manual, migration continua manual). §10 "Histórico" renumerado para §12.

**Próximo passo:** aguardando (1) sua aprovação final para iniciar a implementação e (2) a URL do repositório GitHub que você criar — pré-requisito para os itens 8.1/8.2.

---

## v2.12 (revisão 29) — 2026-08-04 — Fechamento da Missão H1: correção da RPC de provisionamento + limpeza de ambiente

**Status:** implementado e validado. Fecha os 2 achados residuais de uma auditoria rápida pós-H1 (verificação direta contra o Postgres remoto), autorizando o início do H2.

**1. `ensure_initial_provisioning` — guarda de acesso corrigida (migration `0016_hardening_provisioning_grant_fix.sql`):**

- `if p_user_id != auth.uid()` → `if p_user_id is distinct from auth.uid()` — a comparação antiga retornava `NULL` (não `TRUE`) quando os dois lados eram `NULL`, deixando uma chamada anônima com `p_user_id = null` sem ser barrada por essa linha especificamente.
- `revoke execute ... from anon` explícito, além do `revoke all ... from public` já existente — o `revoke from public` não removia o grant que o Supabase concede por padrão a `anon` no schema `public`; `anon` continuava tecnicamente autorizado a chamar a função.
- `grant execute ... to authenticated, service_role` — mantém só os dois papéis que legitimamente precisam chamar a RPC.

**Validado ao vivo contra o Supabase remoto** (usuários de teste reais, descartados após o teste): chamada autenticada real → sucesso; chamada anônima (com `p_user_id` válido e com `p_user_id = null`) → `permission denied for function ensure_initial_provisioning` (`42501`) nos dois casos, barrada já na camada de grant; tentativa de impersonação (usuário A chama com `p_user_id` de usuário B) → `não autorizado` (`42501`). Ground truth em `organizations`: zero organizações criadas pelas tentativas anônima/impersonação, exatamente 1 pela chamada legítima.

**2. Limpeza completa do ambiente de desenvolvimento:**

- Organização `h1test.upload` (não removida numa sessão anterior, apesar de reportada como limpa) removida por completo — brand, membership, `organizations`.
- **Causa raiz do `deleteUser()` "sempre falhando" encontrada** (`docs/hardening-plan.md` item 1.6, aberto desde a Missão 6): não é falha da API do Supabase Auth — é uma linha órfã em `user_profiles` que os scripts de cleanup de missões anteriores nunca removiam, bloqueando a exclusão em cascata do usuário. Removendo `user_profiles` primeiro, `deleteUser()` funcionou normalmente. Os 2 usuários de teste órfãos do H1 (`h1test.full@ayoncreator.dev`, `h1test.upload@ayoncreator.dev`) foram genuinamente excluídos — zero usuários órfãos remanescentes.
- Validação final: zero organizações/usuários com `h1test`/`h1-fix` no nome ou e-mail; `typecheck`/`lint`/`build` limpos; `supabase migration list --linked` confirma `0016` aplicada.

**Documentação atualizada nesta revisão:** `docs/hardening-plan.md` (seção "Fechamento pós-H1", item 1.6 corrigido de "P2, causa raiz nunca investigada" para "resolvido"), `CHANGELOG.md` (`[0.8.2]`).

**Próximo passo:** H1 encerrada. H2 (Fundação de qualidade — CI mínimo + testes de smoke/RLS/concorrência) autorizada para início.

---

## v2.11 (revisão 28) — 2026-08-04 — Sprint de Hardening: auditoria completa + Missão H1 (segurança crítica) implementada e validada

**Status:** implementado e validado ponta a ponta. `docs/hardening-plan.md` criado com auditoria completa do MVP em 10 categorias (bugs, dívidas técnicas, UX, performance, segurança, escalabilidade, testes, CI/CD, observabilidade, checklist de v1.0) e priorização P0/P1/P2. Missão H1 (os 5 itens P0 de segurança/race condition) implementada e validada; H2–H5 seguem como plano aprovado, aguardando início.

**Decisões apresentadas ao dono do produto antes do H1 — todas aprovadas como recomendado:**

1. **Alvo do upgrade do Next.js:** 15.5.x (última estável da série, resolve as 23 vulnerabilidades relacionadas ao framework).
2. **Versão do React:** mantida em 18 (Next 15 suporta `^18 || ^19`), para isolar a migração a uma única variável.
3. **Limite de upload:** 20MB (cobre o maior limite já documentado, `own_media`).

**Achado novo durante a auditoria técnica do H1 (não estava no plano original):** `next.config.js` nunca configurou `serverActions.bodySizeLimit` — default do Next.js é 1MB, abaixo de qualquer upload real. Nunca foi pego em validação porque todo teste de upload usava arquivos sintéticos minúsculos. Resolvido junto com a validação de upload (item 5.3b).

**Implementação (H1 — os 5 itens P0):**

- Migration `0013_hardening_storage_rls.sql`: as 3 policies `for all` de `storage.objects` viram 12 policies por operação — `select` continua `is_org_member`, `insert`/`update`/`delete` passam a exigir `is_org_editor`.
- Migration `0014_hardening_provisioning_lock.sql`: `ensure_initial_provisioning`, função Postgres única com `pg_advisory_xact_lock(hashtext(user_id))`, substituindo as 5 escritas separadas via PostgREST que causavam a race condition documentada desde a Missão 4. Ganhou checagem `auth.uid()` contra impersonação (achado durante o próprio desenvolvimento, antes de qualquer teste).
- Migration `0015_hardening_credit_ledger_balance.sql`: trigger `enforce_credit_ledger_balance` (`select ... for update` + recálculo do saldo antes do insert) — garantia atômica contra saldo negativo, substituindo o check-then-act antigo do portão de crédito.
- `next.config.mjs`: `experimental.serverActions.bodySizeLimit = "20mb"`. `uploadContentPieceMediaAction` ganha validação de tamanho (20MB) e tipo MIME (`image/`/`video/`) com mensagens específicas.
- `next`/`eslint-config-next` `14.2.35` → `15.5.22`. `cookies()` migrado para `async`/`await` de forma própria em `lib/supabase/server.ts` — **atalho `UnsafeUnwrappedCookies` do codemod oficial rejeitado deliberadamente** (documentado pelo próprio Next.js como temporário); `createClient()` agora `async`, `await` propagado a 32 call sites em 17 arquivos. `serverComponentsExternalPackages` → `serverExternalPackages` (chave estável no Next 15).

**Validação real (testes de concorrência/permissão contra Supabase remoto + E2E completo no browser, Supabase + Anthropic reais, marca de teste "Padaria Trigo Dourado"):**

1. RLS de Storage: sessão real de `viewer` tenta remover arquivo em `content-output` — `.remove()` retorna sucesso com array vazio (comportamento do Supabase Storage quando RLS filtra todas as linhas-alvo); confirmado via `.list()` com service role que o arquivo **não** foi removido.
2. Provisionamento inicial: 5 chamadas concorrentes do mesmo usuário novo → exatamente 1 organização criada, as outras 4 retornam `already_provisioned = true` com o mesmo `organization_id`.
3. Portão de crédito: 10 débitos concorrentes contra saldo insuficiente para todos → só o número exato suportado pelo saldo é aceito, saldo final nunca negativo.
4. Upload: arquivo de 21MB rejeitado com mensagem amigável; tipo não aceito rejeitado; upload válido persistido.
5. Next.js 15: fluxo completo validado no browser — login/provisionamento, todas as 6 telas principais, campanha completa (painel de especialistas com divergência real entre Marketing e Branding relatada pelo Coordinator, 5 peças de texto via Anthropic real, upload das 4 peças visuais, aprovação das 9 peças, montagem automática do pacote, download real do `.zip` assinado). Nenhuma regressão.
6. `pnpm audit --prod` re-executado: 25 → 5 vulnerabilidades (2 `moderate`, 3 `high`), zero relacionadas ao Next.js. As 5 remanescentes (`postcss` via `next`, `sharp`/`libvips`) ficam registradas como novo item P1 em `docs/hardening-plan.md` (5.10), fora do escopo aprovado do H1.

**Dois erros de implementação autocorrigidos antes de qualquer teste de usuário (não são bugs encontrados em validação):** posicionamento de `serverActions` fora de `experimental` no config (Next 15 rejeitou, corrigido após grep no tipo `ExperimentalConfig` do pacote instalado); atalho `UnsafeUnwrappedCookies` do codemod revertido manualmente em favor de `async`/`await` próprio.

**Documentação atualizada nesta revisão:** `docs/hardening-plan.md` (Missão H1 marcada concluída, checklist §10 atualizado, novo item 5.10), `CHANGELOG.md` (`[0.8.1]`), `README.md`.

**Próximo passo:** H2 (Fundação de qualidade — CI mínimo + testes de smoke/RLS/concorrência) fica para uma missão futura; não iniciada nesta sprint por instrução explícita do dono do produto.

---

## v2.10 (revisão 27) — 2026-08-04 — Missão 8 (Learning Engine) implementada e validada

**Status:** implementado e validado ponta a ponta com Supabase + Anthropic reais. Documentação atualizada em todos os documentos doc-first + README.md + PRD.md.

**Implementação:**

- Migration `0012_learning_engine.sql`: `learning_signals`/`learning_insights` (sem mudança de coluna frente ao já documentado desde a Missão 4), `specialists.applies_to` de `marketing_strategy`/`branding` estendido para `learning_analysis` (mesmo padrão de `trend_ranking`).
- **Achado real durante a implementação, não decisão de produto:** `intelligence_hub_sessions.related_entity_type` era `not null` com CHECK restrito a `('trend_research', 'campaign', 'content_piece')` — `learning_analysis` não tem uma entidade única desse tipo, é análise em nível de marca. Apresentado ao dono do produto antes de qualquer código; aprovada a extensão aditiva do CHECK para incluir `'brand'` (`related_entity_id = brand_id`), preservando `learning_analysis` como mais um tipo de decisão do Intelligence Hub — mesma sessão, mesmos `specialist_opinions`, mesmo Coordinator, sem exceção arquitetural.
- **Segundo achado real:** `brand_brain_profiles.learned_preferences` (reservada desde a Missão 2) nunca era lida por nenhum Engine — "aceitar" um insight não teria efeito real algum. Apresentado ao dono do produto; aprovada a conexão aos 4 pontos que já montam contexto de marca: `buildBrandContextBlock` (`intelligence-hub/intelligence-hub-prompts.ts`) ganhou um parâmetro opcional `learnedPreferencesText`, agora passado por `campaign_strategy` (Missão 3), `trend_ranking` (Missão 5), `asset_generation` (Missão 7) e o novo `learning_analysis` (Missão 8) — mudança aditiva, sem alterar comportamento para nenhuma marca sem aprendizados aceitos.
- `packages/core/src/learning-engine/`: `runLearningAnalysis` (agrega `learning_signals` não usados desde a última análise, aciona o Intelligence Hub, cria até 5 `learning_insights`), painel Marketing + Branding (Copywriting fora), Coordinator reaproveitado sem mudança.
- `emitLearningSignal` (`criar-campanha/asset-actions.ts`) — aprovar/rejeitar/editar peça (Missão 7) agora emitem `learning_signals` de verdade; falha na emissão nunca bloqueia a ação principal do usuário.
- `acceptInsightAction`/`dismissInsightAction`/`runLearningAnalysisAction` (`o-que-funcionou/actions.ts`) — todos gated a `admin+`, mesmo nível de acesso da tela. Aceitar grava em `brand_brain_profiles.learned_preferences` (acumula, nunca sobrescreve aprendizados anteriores).
- UI `InsightList` (EVOL-1): cards de sugestão pendente com Aceitar/Descartar inline, seção de Histórico, estados "sinal insuficiente" e "analisando". Item de navegação "O que Funcionou" passa a `implemented: true`.

**Validação real (Supabase + Anthropic, marca de teste "Café Raiz"):**

1. Campanha real criada e aprovada (painel de especialistas + Coordinator, Fluxo 10) — sem regressão.
2. 5 `learning_signals` emitidos corretamente a partir de ações reais de revisão de peça: 3 `approved`, 1 `edited` (com `previousScript`/`newScript` no payload), 1 `rejected` (com `reason: null`).
3. Análise sob demanda confirmada: com exatamente 5 sinais não usados, `runLearningAnalysisAction` acionou o Intelligence Hub — `intelligence_hub_sessions` criada com `related_entity_type = 'brand'`, `related_entity_id = brand_id`, `trigger_reason = 'learning_analysis'`; 2 `specialist_opinions` gravadas (Marketing + Branding); Coordinator gerou 2 `learning_insights` (`pending_review`), específicos e honestos sobre amostra pequena — nenhuma sugestão genérica.
4. Aceitar um insight confirmado: `learning_insights.status = applied`, `reviewed_by` gravado, `brand_brain_profiles.learned_preferences` atualizado com `{insights: [{id, insightType, appliedTo, text, appliedAt}]}`. Descartar o outro confirmado: `status = dismissed`, **não** entra em `learned_preferences`.
5. **Confirmado que "aceitar" muda comportamento futuro de verdade** (o ponto central da Missão 8): uma nova sessão de `campaign_strategy` para a mesma marca, criada depois do aceite, trouxe os três especialistas e o Coordinator citando explicitamente o aprendizado aplicado ("O Brand Evolution mostra aprovação de 100% em formatos escritos...", "os Brand Evolution Learnings indicam...") — a informação genuinamente influenciou o raciocínio, não apenas apareceu no prompt.

**Observado, não corrigido (não é bug de código):** a primeira tentativa de análise falhou com `LlmJsonParseError` ("Resposta do LLM não era um JSON válido"); a segunda tentativa, com o mesmo código e os mesmos dados, teve sucesso. Mesma categoria de risco que qualquer chamada de LLM com saída estruturada estrita já existente no repositório (nenhum Engine hoje tem retry automático) — não reproduzido numa segunda tentativa, não há evidência de causa determinística no código.

**Documentação atualizada nesta revisão:** `architecture.md` (revisão 24), `database.md` (revisão 21), `flows.md` (revisão 23), `ux-design.md` (revisão 21), `engine-behavior.md` (revisão 15), `PRD.md` (revisão 19), `README.md`, `CHANGELOG.md` (`[0.8.0]`).

---

## v2.9 (revisão 26) — 2026-08-03 — Preparação doc-first da Missão 8 (Learning Engine)

**Status:** documentação pronta — **aguardando aprovação explícita do dono do produto antes do código**, seguindo o mesmo processo doc-first das missões anteriores.

**Decisões apresentadas ao dono do produto antes de escrever qualquer documento — todas aprovadas como recomendado:**

1. **Mecanismo de geração dos insights:** via Intelligence Hub — novo tipo de decisão `learning_analysis`, painel Marketing + Branding (Copywriting não participa), Coordinator generalizado reaproveitado sem mudança de schema (já antecipado em `docs/prompts/coordinator.md` desde a Missão 5).
2. **Cobrança em créditos:** gratuito, em todos os planos — nenhum `trigger_reason` novo em `credit_pricing`. Mesma filosofia de "não é feature paga de automação total" já registrada em `architecture.md` §3.6.
3. **Escopo de sinais do MVP:** só `approved`/`rejected`/`edited` — `engagement_metric` fica fora, sem mecanismo de captura definido ainda.
4. **Gatilho e cadência:** síncrono, sob demanda (sem cron/n8n), com mínimo de 5 `learning_signals` não usados antes de qualquer análise — resolve [PRD.md §13, item 3](../PRD.md#13-decisões-em-aberto-precisam-de-aprovação-antes-de-virar-escopo).

**O que mudou nos documentos:**

- **`docs/architecture.md`:** §3.6 ganha o escopo completo do MVP aprovado — mecanismo, cobrança, escopo de sinais, gatilho, e o esclarecimento de que `applied_to` é um rótulo descritivo, não um destino de escrita separado (todo insight aceito grava em `brand_brain_profiles.learned_preferences`).
- **`docs/database.md`:** §4.7 confirmada pronta para migrar sem mudança de coluna (nem `intelligence_hub_sessions.trigger_reason` nem `specialists.applies_to` têm enum/constraint — `learning_analysis` é só dado novo, mesmo padrão de `trend_ranking`).
- **`docs/flows.md`:** Fluxo 8 reescrito com o mecanismo completo (gatilho, limite mínimo, Intelligence Hub, aplicação via Brand Brain).
- **`docs/ux-design.md`:** §3.8 (EVOL) simplificada — EVOL-2 removida, EVOL-3 vira seção da EVOL-1, mesmo raciocínio de simplificação de CAMP-4/5/6 (Missão 7). Referências cruzadas corrigidas.
- **`docs/engine-behavior.md`:** §6 resolve o número mínimo de sinais e ganha nota de honestidade sobre sinal insuficiente.
- **`PRD.md`:** §13 item 3 resolvido.

**Sem novo `credit_pricing`** — análise gratuita, decisão de produto explícita (item 2 acima).

**Próximo passo:** iniciar a implementação de código da Missão 8 após aprovação explícita do dono do produto.

---

## v2.8 (revisão 25) — 2026-08-03 — Auditoria completa pré-Missão 8 (Learning Engine)

**Status:** documentação corrigida — **aguardando decisões arquiteturais e de produto + aprovação explícita do dono do produto antes de iniciar o doc-first da Missão 8**, seguindo o mesmo processo já usado antes de toda missão.

**Escopo da auditoria:** leitura completa de README.md, PRD.md, architecture.md, database.md, flows.md, ux-design.md, engine-behavior.md, CONVENTIONS.md, CHANGELOG.md, docs/changelog.md, docs/prompts/, todas as 11 migrations, `apps/web/config/navigation.ts` e toda a árvore `apps/web`/`packages/*` relevante a Fluxo 4/Fluxo 8 — mesmo padrão de rigor das auditorias pré-Missão 5/6/7.

**Inconsistências encontradas e corrigidas** (nenhuma delas é uma decisão de produto — só desalinhamento entre documentos ou documento não revisado após uma missão concluir):

1. **`architecture.md` §3.6** linkava para `database.md#46-learning_signals--learning_insights` (âncora da seção 4.6), mas `learning_signals`/`learning_insights` estão de fato documentadas em **§4.7**. Corrigido.
2. **`docs/engine-behavior.md` §8, item 2** ainda listava o Asset Engine como "hipótese não implementada" — foi implementado e validado com Anthropic real na Missão 7. Mesma lacuna já corrigida para o Trend Engine na auditoria pré-Missão 7 (v2.5), desta vez para o Asset Engine. Corrigido — só o Learning Engine segue como hipótese agora.
3. **`docs/flows.md` Fluxo 4, passo 2** descrevia um mecanismo de rejeição/edição que não corresponde ao código real da Missão 7: dizia que rejeitar "volta para `generating`" (na prática é um estado terminal, `rejected` — regenerar é uma ação explícita separada) e que editar cria "nova `content_versions`" (na prática atualiza `content_pieces.script` diretamente, sem versionar). Corrigido para nomear as Server Actions reais (`approveContentPieceAction`/`rejectContentPieceAction`/`regenerateContentPieceAction`/`editContentPieceAction`/`uploadContentPieceMediaAction`) e seu comportamento exato, mantendo marcada como pendente (★ Missão 8) a emissão de `learning_signals` nesses pontos — que ainda não existe no código.

**Verificado e confirmado consistente, sem necessidade de correção:** `apps/web/config/navigation.ts` (item "O que Funcionou" já `implemented: false`, `minRole: "admin"`, alinhado a `ux-design.md` §3.8/§2.4); README.md "Estado do projeto" ↔ `CHANGELOG.md` raiz (ambos param em `v0.7.0`); `docs/prompts/coordinator.md` já antecipa `learning_analysis` como decisão futura do Coordinator generalizado (Missão 5, migration `0007`), sem exigir mudança de schema; `specialists.applies_to` é `text[]` livre (sem enum/constraint), extensível por `UPDATE` como já feito para `trend_ranking` (migration `0006`); `credit_ledger.related_content_piece_id`/`related_intelligence_hub_session_id` já cobrem os dois tipos de origem de consumo que existem hoje, sem necessidade de nova coluna estrutural para o Learning Engine em si (a decisão de cobrar ou não pela análise é de produto, não de schema — ver abaixo).

**Decisões arquiteturais e de produto identificadas para a Missão 8 (Learning Engine) — apresentadas ao dono do produto antes de qualquer doc-first, conforme pedido explícito:**

1. **Mecanismo de geração dos insights:** rodar através do Intelligence Hub (painel de especialistas + Coordinator generalizado, novo tipo de decisão `learning_analysis` — já antecipado em `docs/prompts/coordinator.md` desde a Missão 5) ou uma chamada direta e mais simples ao LLM Provider, sem painel de especialistas?
2. **Cobrança em créditos:** gerar um `learning_insight` é uma operação faturável (novo `trigger_reason` em `credit_pricing`, mesmo padrão de `campaign_strategy`/`trend_ranking`/`asset_generation`) ou gratuita (mesma isenção hoje aplicada à conversa de onboarding, por não gerar um ativo monetizável novo — é análise de dados que o cliente já pagou para gerar)?
3. **Escopo de sinais do MVP:** só `approved`/`rejected`/`edited` (já têm ponto de captura natural nas Server Actions existentes da Missão 7) ou também `engagement_metric` (Fluxo 5, passo 4 — hoje marcado como "mecanismo de captura exato é decisão em aberto", exigiria uma tela nova para o usuário registrar manualmente onde/quando publicou)?
4. **Frequência/gatilho** (PRD §13.3, ainda em aberto): análise síncrona sob demanda (usuário abre "O que Funcionou" ou aciona "buscar novidades" → Server Action agrega sinais e chama o LLM ali mesmo, mesmo padrão síncrono de toda missão até aqui) ou algum mecanismo periódico (exigiria cron/n8n, ainda não implementado em nenhuma parte do repositório)?
5. **Limite mínimo de sinais** (PRD §13.3) antes da primeira sugestão poder ser gerada — para não aparecer uma sugestão fraca a partir de 1-2 eventos.

**Próximo passo:** apresentar essas decisões ao dono do produto antes de escrever qualquer documento de escopo da Missão 8.

---

## v2.7 (revisão 24) — 2026-08-03 — Missão 7 (Asset Engine) implementada e validada

**Status:** implementado e validado ponta a ponta com Supabase + Anthropic reais. Documentação atualizada em todos os 5 documentos doc-first + README.md + PRD.md.

**Implementação:**

- Migration `0011_asset_engine.sql`: `content_pieces`/`content_versions`/`content_packages`, helpers de RLS `campaign_organization_id`/`content_piece_organization_id`, `credit_ledger.related_content_piece_id`, `credit_pricing` para `asset_generation` (3/6/12) e reajuste de `trend_ranking` (1/2/4 → 2/4/8, aplicado via `UPDATE`, migration `0008_billing.sql` nunca editada retroativamente).
- `packages/core/src/asset-engine/`: `generateTextPiece` (LLM Provider, prompt por formato, Zod `{content, rationale}`), `initializeCampaignContentPieces` (9 peças por campanha, `script` como peça principal reaproveitando a sessão do Intelligence Hub da estratégia), `buildContentPackage` (JSZip — excluído do barrel de `@ayon/core` pelo mesmo motivo de `pdf-parse`/`mercadopago`: depende de APIs Node).
- `approveCampaignStrategyAction` dispara a geração dos 5 formatos textuais logo após a aprovação da estratégia; falha de uma peça nunca bloqueia as demais (mesmo espírito do painel de especialistas do Fluxo 10).
- 5 novas Server Actions em `criar-campanha/asset-actions.ts`: editar (sem custo), regenerar (novo custo em créditos), upload de mídia própria (sem custo), aprovar (dispara montagem automática do pacote quando a última peça é aprovada) e rejeitar.
- UI `ContentPackageReview` (CAMP-4/5/6): card por peça, diferenciando texto (aprovar/editar/regenerar/rejeitar) de visual (aprovar/enviar arquivo/rejeitar); tela final "Pacote pronto" com link de download assim que todas as 9 peças são aprovadas.

**Validação real (Supabase + Anthropic, org de teste "Trilha Verde Turismo"):**

1. Painel de especialistas (Marketing/Branding/Copy) + Coordinator consolidaram a estratégia normalmente — sem regressão do Fluxo 10.
2. Aprovação da estratégia gerou as 9 `content_pieces` e as 5 peças textuais via LLM real, todas coerentes com o Brand Brain e a estratégia consolidada.
3. Créditos debitados corretamente: 10 (`campaign_strategy`, tier balanceado) + 5 × 6 (`asset_generation`, tier balanceado) = 40 créditos, conferido linha a linha em `credit_ledger`.
4. Edição manual de peça textual confirmada (sem custo em créditos).
5. Regeneração de peça textual confirmada — nova chamada ao LLM Provider, novo débito de 6 créditos registrado em `credit_ledger` com descrição "— regenerada".
6. Upload manual dos 4 formatos `own_media` confirmado — arquivo salvo no bucket `content-output`, `content_versions` criada, peça avança para `ready_for_review`.
7. Aprovação das 9 peças confirmada; a aprovação da última peça disparou a montagem automática do pacote (sem passo manual, sem Realtime) e retornou uma signed URL válida.
8. Download do pacote confirmado — `.zip` válido (assinatura de arquivo local correta), 9 entradas: 5 `.txt` (um por formato textual) + 4 arquivos de mídia própria.

**Bug real encontrado e corrigido durante a validação:**

- **Nomes de arquivo corrompidos no pacote final:** `buildContentPackage` (`packages/core/src/asset-engine/build-content-package.ts`) construía o nome de cada arquivo `own_media` dentro do `.zip` pegando o último segmento do caminho de storage (`output_storage_path.split("/").pop()`). Como o caminho de storage é `{organizationId}/{campaignId}/{contentPieceId}-{nomeOriginal}` (prefixo necessário para evitar colisão entre uploads), o cliente final receberia o pacote com arquivos como `8e9ded03-8ea7-4466-895b-d920c346a192-video-test.png` em vez de `video-test.png` — vazando um UUID interno para o entregável do cliente. Corrigido para remover o prefixo `{contentPieceId}-` antes de adicionar ao zip, restaurando o nome original enviado. Confirmado com os 4 arquivos reais da validação (thumbnail/carousel/video/stories, todos com nome limpo após a correção).

**Documentação atualizada nesta revisão:** `architecture.md` (revisão 21), `database.md` (revisão 19), `flows.md` (revisão 20), `ux-design.md` (revisão 19), `PRD.md` (revisão 17), `README.md` ("Estado do projeto"), `CHANGELOG.md` (`[0.7.0]`).

---

## v2.6 (revisão 23) — 2026-08-03 — Preparação doc-first da Missão 7 (Asset Engine)

**Status:** documentação pronta — **aguardando aprovação explícita do dono do produto antes do código**, seguindo o mesmo processo doc-first das missões anteriores.

**Contexto:** ao contrário das Missões 4-6, o Asset Engine tem uma superfície muito maior (9 formatos de peça, múltiplos modos de produção) e nenhuma base de código existente para aproveitar — Provider Layer para Avatar/Voice/Media não existe nem como contrato, `content_pieces`/`content_versions`/`content_packages` são só schema documentado. Auditoria completa feita antes de qualquer doc-first (ver entrada v2.5 acima).

**Decisões arquiteturais apresentadas ao dono do produto antes de escrever qualquer documento — todas aprovadas como recomendado:**

1. **Escopo de modos de produção:** só `text_only` e `own_media` na Missão 7. `ai_avatar` (HeyGen), `licensed_stock_video` (Media Provider a definir) e `hybrid` ficam para uma missão futura — zero fornecedor novo agora, mesma disciplina de "uma fatia vertical por vez" de todas as missões anteriores.
2. **Execução síncrona, sem n8n** — mesmo padrão das 6 missões já implementadas. `architecture.md` §8 já apontava o Asset Engine como candidato mais provável a precisar de n8n de verdade; adiado até um modo de produção genuinamente demorado (vídeo com avatar) exigir isso de fato.
3. **Sem Supabase Realtime** — primeira vez que a decisão foi colocada explicitamente na mesa (a documentação sempre mencionou Realtime como mecanismo esperado, mas nenhuma das 6 missões anteriores usou de fato). UI continua atualizando a partir do retorno direto da Server Action.

**O que mudou nos documentos:**

- **`docs/architecture.md`:** §3.5 (Asset Engine) ganha o escopo do MVP aprovado — `production_mode` limitado a `text_only`/`own_media`, upload manual para formatos visuais **sem depender de `brand_media_assets`/Biblioteca de Mídia** (decisão explícita para não acoplar a Missão 7 a uma funcionalidade que também não existe ainda), execução síncrona, sem Realtime.
- **`docs/database.md`:** §4.6 (`content_pieces`/`content_versions`/`content_packages`) confirmada pronta para migrar sem mudança de coluna. §7.2 (`credit_ledger`) ganha `related_content_piece_id` (nova coluna, como já antecipado na revisão 16 do próprio documento). §7.3 (`credit_pricing`) ganha `asset_generation` (**3/6/12 créditos por tier**, aprovado) e reajusta `trend_ranking` de 1/2/4 para **2/4/8** (decisão do dono do produto, Missão 7) — aplicado via `UPDATE` numa migration nova, já que `0008_billing.sql` está aplicada e nunca é editada retroativamente.
- **`docs/flows.md`:** Fluxo 3, §3.2, reescrito com o escopo do MVP; §3.3 corrigida para não mencionar Realtime.
- **`docs/ux-design.md`:** CAMP-4/5/6 e os componentes §4.4 (Rastreador de Progresso — não mais "alimentado por Realtime"), §4.5 (Checklist) e §4.6 (Cartão de Revisão) ajustados para diferenciar geração de texto (aprovar/editar/regenerar) de upload manual de formato visual (aprovar/enviar arquivo).
- **`PRD.md`:** §13, item 4, resolvido para o escopo do MVP (5 formatos textuais sempre gerados por IA, 4 visuais por upload manual, nenhum opcional ainda). Contagem de documentos do doc-first corrigida de 4 para 5 (auditoria).

**Preço em créditos aprovado (dono do produto ajustou a proposta inicial):**

| trigger_reason | Econômico | Balanceado | Premium |
|---|---|---|---|
| `trend_ranking` | 2 | 4 | 8 |
| `asset_generation` | 3 | 6 | 12 |
| `campaign_strategy` | 5 | 10 | 20 |

**Próximo passo:** iniciar a implementação de código da Missão 7 — arquitetura e números de crédito aprovados.

---

## v2.5 (revisão 22) — 2026-08-03 — Auditoria completa pré-Missão 7 (Asset Engine)

**Status:** documentação corrigida — **aguardando decisões arquiteturais e aprovação explícita do dono do produto antes de iniciar o doc-first da Missão 7**, seguindo o mesmo processo já usado antes de toda missão.

**Escopo da auditoria:** leitura completa de README.md, PRD.md, architecture.md, database.md, flows.md, ux-design.md, engine-behavior.md, CONVENTIONS.md, CHANGELOG.md, docs/changelog.md, docs/prompts/, todas as 10 migrations, e toda a árvore `apps/web`/`packages/*` — mesmo padrão de rigor das auditorias pré-Missão 5 e pré-Missão 6.

**Inconsistências encontradas e corrigidas** (nenhuma delas é uma decisão de produto — só desalinhamento entre documentos ou documento não revisado após uma missão concluir):

1. **PRD.md §13, item 1** tinha um "Ainda pendente" sobre revisão de `system_prompt`s dos especialistas — já resolvido desde a revisão 13 de `architecture.md`/`engine-behavior.md`, mas o PRD nunca foi corrigido. Corrigido.
2. **`database.md` §10, item 3** (uso de `pgvector`) contradizia `architecture.md` §10, item 3, sobre a mesma decisão — aberta num documento, resolvida no outro desde a Missão 4. Corrigido.
3. **`docs/engine-behavior.md` §4 (Trend Engine)** ainda dizia "Ainda sem código" e §8 item 2 tratava o Trend Engine como "não validado com IA real" — o Trend Engine foi implementado e validado desde a Missão 5; o documento simplesmente não foi revisado quando essa missão fechou. Corrigido.
4. **PRD.md contava "4 documentos"** na regra de doc-first (sem `ux-design.md`), enquanto **README.md sempre contou "5"** — na prática, `ux-design.md` sempre foi atualizado junto dos demais em toda missão já fechada; só o texto do PRD estava desatualizado. Corrigido para 5, alinhado ao README.
5. **`docs/ux-design.md` §3.9 (CFG)** não sinalizava que CFG-1/3/5/6 seguem sem código, apesar de CFG-2/4 já estarem implementadas desde a Missão 6 — lacuna de sinalização já identificada na auditoria pré-Missão 5 (v1.9) e nunca fechada para estes 4 itens. Corrigido com nota explícita.
6. **`docs/ux-design.md` §3.6 (HIST)** não sinalizava que as telas de histórico de campanhas (HIST-1/2) não têm código, apesar de `campaigns` já existir e ser escrita desde a Missão 3. Corrigido com nota explícita.

**Verificado e confirmado consistente, sem necessidade de correção:** README.md "Estado do projeto" ↔ CHANGELOG.md raiz (ambos param em `v0.6.0`, sem divergência); `docs/flows.md` (nenhuma inconsistência encontrada nesta rodada); numeração de revisão por documento (cada um tem contador próprio desde o início do projeto — não é um erro, só dificulta conferência rápida, registrado como observação, não como correção).

**Riscos arquiteturais identificados para a Missão 7 (Asset Engine) — apresentados ao dono do produto antes de qualquer doc-first, conforme pedido explícito:**

1. Provider Layer para `avatar`/`voice`/`media` não existe nem como contrato/interface — hoje só `llm` e `trend_source` têm adapter concreto.
2. n8n segue não implementado em lugar nenhum do repositório, apesar de `architecture.md` §8 já apontar o Asset Engine como o candidato mais provável a precisar dele de verdade.
3. `credit_pricing` não tem nenhuma linha para operações de geração de mídia — precisa de novos `trigger_reason` antes do portão de crédito poder cobrar por elas.
4. `credit_ledger.related_intelligence_hub_session_id` é hoje o único jeito de rastrear consumo — `database.md` já antecipa que o Asset Engine vai precisar de uma nova coluna (`content_pieces`/`content_versions`), não reaproveitar esta.
5. `content_pieces`/`content_versions`/`content_packages` são só schema documentado, sem migration — todo o domínio de dados do Asset Engine precisa ser criado do zero.
6. Realtime é mencionado em `architecture.md`/`ux-design.md`/`flows.md` como mecanismo esperado de atualização de UI, mas nunca foi implementado em nenhuma missão até aqui — todas usam Server Action síncrona + `revalidatePath`.

**Próximo passo:** apresentar essas decisões ao dono do produto antes de escrever qualquer documento de escopo da Missão 7.

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
