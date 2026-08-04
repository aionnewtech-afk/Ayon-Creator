# n8n — Ayon Creator (Missão 9, Fluxo 13)

Instância n8n **dedicada e isolada** ao Ayon Creator — nunca a mesma usada por outros projetos. Ver [docs/changelog.md](../docs/changelog.md) para o relato completo da auditoria/implementação.

## Por que uma instância própria

Uma auditoria antes de provisionar qualquer coisa encontrou um container `n8n` já rodando localmente (porta 5678), mas pertencente a outro projeto (`atendimento-ai-plataform`, volume/rede próprios, ao lado de uma stack de WhatsApp/Evolution API). Decisão do dono do produto: nunca reaproveitar infraestrutura de outro projeto — esta instância é um container, volume e rede totalmente separados, na porta **5679**.

## Subir a instância

```bash
cp n8n/.env.local.example n8n/.env.local
# preencher N8N_ENCRYPTION_KEY (gerar com o comando no próprio .env.local.example)
docker compose --env-file n8n/.env.local -f n8n/docker-compose.yml up -d
```

UI: http://localhost:5679

## Setup inicial (uma vez só, manual)

O n8n não tem bootstrap 100% headless na versão atual — a conta *owner* precisa ser criada pela UI na primeira visita (e-mail/nome/senha). Depois disso, gerar uma API key em **Settings → n8n API → Create API Key** (usada só para criar/gerenciar o workflow via script, não pelo container em produção).

Credenciais desta instância ficam em `n8n/.env.local` (gitignored, nunca commitado) — `N8N_OWNER_EMAIL`/`N8N_OWNER_PASSWORD`/`N8N_API_KEY`.

## Rede: container → host

O n8n roda em container Docker; nosso app Next.js roda direto no host (`pnpm dev`, fora de container). Por isso, dentro dos nós do workflow, as rotas do Ayon Creator são chamadas via `http://host.docker.internal:3010/...` — **nunca** `http://localhost:3010`, que dentro do container aponta para o próprio container, não para o host. Confirmado por teste direto (`docker exec ayon-creator-n8n wget http://host.docker.internal:3010/...`) antes de montar o workflow de verdade.

## Variáveis de ambiente da aplicação (`.env.local`, raiz e `apps/web/`)

```
N8N_WEBHOOK_URL=http://localhost:5679/webhook/video-pipeline
N8N_WEBHOOK_SECRET=<mesmo segredo usado nos headers dos nós do workflow>
```

`N8N_WEBHOOK_URL` é chamado pelo host (Next.js) → container (porta publicada 5679), por isso `localhost` funciona normalmente aqui — direção oposta do `host.docker.internal` usado dentro do workflow.

## Workflow: "Ayon Creator - Fluxo 13 (Pipeline de Vídeo)"

Criado e mantido via API do n8n (`/api/v1/workflows`), não editado manualmente pela UI — reprodutível por script. Sequência de nós:

```
Webhook (trigger, POST /webhook/video-pipeline, responseMode "onReceived")
        │
        ▼
Busca dados da campanha (GET Supabase REST — confirma o content_piece antes de gastar com fornecedor pago)
        │
        ▼
ElevenLabs (POST /api/pipeline/video/narrate)
        │
        ▼
Pexels (POST /api/pipeline/video/scenes)
        │
        ▼
Shotstack (POST /api/pipeline/video/render)
        │
        ▼
Webhook de retorno — sucesso (POST /api/webhooks/n8n, status: "completed")
```

Cada nó de fornecedor (`ElevenLabs`/`Pexels`/`Shotstack`) e o de busca de dados usam `onError: "continueErrorOutput"` — uma falha em qualquer um deles desvia para um nó paralelo **`Webhook de retorno (falha)`**, que chama a mesma rota `/api/webhooks/n8n` com `status: "failed"` e a mensagem de erro (`$json.error.message`). Isso significa: nenhuma etapa acoplada a outra além do necessário — trocar de fornecedor (ex.: Pexels → outro banco de vídeo) é editar só o nó "Pexels", sem tocar nos demais.

`Busca dados da campanha` já pegou um bug real na primeira validação (documentado em [docs/changelog.md](../docs/changelog.md)) — usava o header errado (`x-ayon-webhook-secret`, que é só do nosso app) em vez do que o Supabase exige (`apikey`/`Authorization: Bearer <service_role_key>`). Corrigido; o branch de falha funcionou exatamente como projetado durante esse bug, provando o desenho de erro na prática antes mesmo do caminho feliz.

### Autenticação das rotas do Ayon Creator

Todo nó que chama uma rota `/api/pipeline/video/*` ou `/api/webhooks/n8n` envia o header `x-ayon-webhook-secret` com o mesmo valor de `N8N_WEBHOOK_SECRET` — comparação em tempo constante no lado da aplicação (`verifyN8nWebhookSecret`, `packages/core/src/shared/verify-n8n-webhook-secret.ts`).

### Reproduzir/recriar o workflow

O script usado para criar o workflow via API (`build-workflow.mjs`, não commitado — viveu no scratchpad da sessão que implementou isso) monta o JSON completo (nodes + connections) e faz `POST /api/v1/workflows` seguido de `POST /api/v1/workflows/{id}/activate`. A estrutura exata dos nós (tipos, `typeVersion`, parâmetros) está documentada nesta página e replicável a partir da UI do n8n manualmente, se preferir — nenhuma mágica além do que está descrito acima.

## Rodar a validação real de ponta a ponta

Com o container e o `pnpm dev` rodando:

```bash
pnpm --filter core exec vitest run src/asset-engine/video-pipeline-trigger-real.test.ts
```

Cria uma organização/marca/campanha/peça de teste, dispara `triggerVideoGeneration` (que chama o webhook do n8n de verdade), faz polling em `pipeline_runs` até um estado terminal, confirma `content_versions`/crédito debitado, e limpa tudo ao final.

## Parar / remover

```bash
docker compose --env-file n8n/.env.local -f n8n/docker-compose.yml down
# remove também o volume (perde workflows e credenciais salvas):
docker compose --env-file n8n/.env.local -f n8n/docker-compose.yml down -v
```
