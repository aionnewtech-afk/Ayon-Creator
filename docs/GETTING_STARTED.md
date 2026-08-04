# Como Usar o Ayon Creator — Guia do Zero

Este guia parte do zero absoluto: nenhum conhecimento prévio da infraestrutura é
assumido. Ao final, você terá criado sua primeira campanha e gerado seu primeiro
vídeo automaticamente para a Todo Canto (ou qualquer marca que você cadastrar).

Todos os passos abaixo foram executados e validados de ponta a ponta em ambiente
real (navegador de verdade, Supabase real, Anthropic real, ElevenLabs/Pexels/
Shotstack reais, n8n real) antes deste documento ser escrito — não é um roteiro
teórico.

---

## 1. O que precisa estar instalado na sua máquina

- **Node.js ≥ 22.13** e **pnpm** (`packageManager` já fixado no `package.json` raiz).
- **Docker Desktop** — usado só para o n8n (ver §2). O banco de dados (Supabase)
  **não roda localmente** neste projeto — é um projeto Supabase na nuvem, então
  você não precisa subir Postgres/Auth/Storage você mesmo.
- Contas/chaves de API já configuradas em `.env.local` (ver §3) — se você está
  lendo isso depois da Missão 9, elas já devem estar preenchidas por quem
  configurou o projeto.

## 2. Quais containers Docker precisam estar rodando

Só **um**: o n8n dedicado do Ayon Creator (`ayon-creator-n8n`), responsável por
orquestrar o pipeline assíncrono de geração de vídeo (Fluxo 13). Sem ele, tudo o
resto do produto funciona normalmente — só a geração automática de vídeo (passo
final deste guia) fica indisponível.

```bash
docker compose --env-file n8n/.env.local -f n8n/docker-compose.yml up -d
```

Confirme que subiu:

```bash
docker ps --filter name=ayon-creator-n8n
curl http://localhost:5679/healthz
```

Deve responder `{"status":"ok"}`. Detalhes completos (rede, autenticação,
estrutura do workflow) em [`n8n/README.md`](../n8n/README.md).

> **Importante:** se você já tem outro container n8n rodando na sua máquina (de
> outro projeto), **não o reaproveite** — o Ayon Creator usa uma instância
> própria e isolada, na porta `5679`, para nunca interferir em workflows de
> outro projeto seu. Isso foi uma decisão explícita tomada durante a Missão 9,
> depois de uma auditoria encontrar exatamente essa situação.

## 3. Variáveis de ambiente necessárias

Duas cópias do mesmo arquivo precisam existir — `.env.local` na raiz **e**
`apps/web/.env.local` (o Next.js só lê a de `apps/web`, mas os scripts de
validação/teste rodados da raiz leem a da raiz — mantenha as duas em sincronia,
dívida técnica conhecida, `docs/hardening-plan.md` item 2.2). Modelo completo em
[`.env.local.example`](../.env.local.example):

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conectar ao projeto Supabase (nuvem) |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações internas (Provider Gateway, webhooks) |
| `ANTHROPIC_API_KEY` | Todo o "cérebro" do produto — onboarding, Intelligence Hub, geração de texto |
| `MERCADO_PAGO_ACCESS_TOKEN` / `MERCADO_PAGO_WEBHOOK_SECRET` | Assinatura de plano e compra de créditos (§8) |
| `ELEVENLABS_API_KEY` | Narração do vídeo automático |
| `PEXELS_API_KEY` | Banco de cenas do vídeo automático |
| `SHOTSTACK_API_KEY` / `SHOTSTACK_HOST` | Composição final do vídeo (MP4) |
| `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` | Disparo e autenticação do pipeline de vídeo |

Sem as 4 últimas linhas (ElevenLabs/Pexels/Shotstack/n8n), tudo funciona exceto
a geração automática de vídeo especificamente.

## 4. Comando para iniciar a aplicação

Na raiz do repositório:

```bash
pnpm install
pnpm dev
```

Isso roda `next dev` (`apps/web`). Aguarde a mensagem `✓ Ready` no terminal.

## 5. URL para abrir no navegador

```
http://localhost:3010
```

(a porta vem de `NEXT_PUBLIC_APP_URL` em `.env.local` — se você mudou essa
variável, ajuste a URL de acordo).

## 6. Criando seu primeiro usuário

Não existe usuário/senha padrão — cada pessoa cria a própria conta:

1. Acesse `http://localhost:3010/cadastro`.
2. Preencha e-mail, senha e o nome da sua empresa (ex.: "Todo Canto Turismo").
3. **Confirmação de e-mail é obrigatória** (Supabase Auth, `architecture.md`
   §2.2) — você vai receber um e-mail de confirmação no endereço cadastrado.
   Clique no link antes de tentar fazer login.
4. Depois de confirmar, volte para `http://localhost:3010/login` e entre com
   e-mail e senha.

No primeiro acesso autenticado, o sistema cria automaticamente sua organização
e sua primeira marca (Provisionamento Inicial, `architecture.md` §2.2) — você
não precisa fazer nada manualmente para isso.

## 7. Assinar um plano (necessário antes de criar qualquer campanha)

Achado real deste guia: **sem assinatura ativa, a criação de campanha é
bloqueada** (portão de crédito, `architecture.md` §12.3) — nenhuma quantidade
de cliques resolve isso, é uma regra de negócio deliberada.

1. Acesse **Configurações** no menu lateral.
2. Escolha um plano (Starter/Pro/Business) e clique em **Assinar**.
3. Você será redirecionado ao checkout do Mercado Pago (em ambiente de teste,
   `MERCADO_PAGO_ACCESS_TOKEN` começando com `TEST-`, use os
   [cartões de teste do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/test/cards)).
4. Depois de confirmar o pagamento, volte para a aba do Ayon Creator —
   **o webhook do Mercado Pago, não o redirect do navegador, é quem confirma a
   assinatura** (`architecture.md` §12.2). Configurações mostra "processando
   pagamento" até isso acontecer, geralmente poucos segundos.
5. Créditos do plano já aparecem disponíveis assim que a assinatura fica ativa.

## 8. Ensine sua empresa para a Ayon (recomendado antes de criar campanha)

Tecnicamente você já consegue criar uma campanha com o Brand Brain vazio, mas o
resultado vai soar genérico — o Intelligence Hub e o Asset Engine dependem do
que sabem sobre sua marca (Princípio do Consultor Permanente, `PRD.md` §1.1).

1. Acesse **Conheça sua Empresa** no menu.
2. Converse normalmente com a Ayon — não é um formulário, é uma conversa real
   conduzida por IA (Anthropic real) sobre história, produtos, clientes, tom de
   voz, concorrentes, objetivos, diferenciais e palavras proibidas/favoritas.
3. Pode ser pausada e retomada a qualquer momento.

## 9. Acessando o painel principal

Depois de logado (e com o provisionamento inicial concluído), `/painel` já é a
tela inicial — o menu lateral dá acesso a tudo: Criar Campanha, Conheça sua
Empresa, Ensine sua Empresa para a IA, O que está em Alta, O que Funcionou e
Configurações.

## 10. Criando sua primeira campanha

1. Clique em **Criar Campanha** no menu.
2. Descreva o objetivo em texto livre — quanto mais específico, melhor.
   Exemplo real usado na validação deste guia:
   > "Quero divulgar nossos pacotes de viagem para praias do Nordeste, com
   > foco em famílias que querem um roteiro personalizado, não um pacote
   > genérico de agência grande."
3. Clique em **Reunir a equipe de especialistas**. O Intelligence Hub aciona o
   painel de especialistas (Marketing, Branding, Copy) de forma independente,
   depois o Coordinator consolida tudo em uma estratégia única — leva de
   20 a 40 segundos, chamadas reais à Anthropic.
4. Revise as opiniões individuais e a estratégia consolidada (cada uma com o
   bloco **"Por que fiz assim?"**). Clique em **Aprovar estratégia**.
5. O sistema gera automaticamente os 5 formatos textuais do pacote (legenda,
   post de blog, teleprompter, roteiro, e-mail) — sequencial, leva de 60 a 90
   segundos. Você cai na tela de revisão do pacote de conteúdo assim que
   terminar.

## 11. Gerando seu primeiro vídeo automaticamente

Na tela de revisão do pacote de conteúdo, o card **Vídeo** mostra o botão
**"Gerar vídeo automaticamente"** (formato `licensed_stock_video` — narração +
banco de vídeo licenciado + legenda, Fluxo 13).

1. Clique em **Gerar vídeo automaticamente**.
2. O card muda para **"Gerando vídeo automaticamente... isso pode levar alguns
   minutos"** — o pipeline está rodando de verdade em segundo plano (n8n →
   ElevenLabs → Pexels → Shotstack), sem travar o resto da tela. Você pode
   continuar revisando as outras peças enquanto espera.
3. A tela verifica o progresso automaticamente a cada poucos segundos
   (não precisa atualizar a página). Quando terminar, o player de vídeo
   aparece direto no card, com o MP4 vertical pronto.
4. Clique em **Aprovar** para liberar essa peça, ou **Gerar de novo** se quiser
   uma nova tentativa.
5. Formatos visuais restantes (Stories, Carrossel, Thumbnail) ainda são upload
   manual nesta etapa (Missão 9, Etapa 1) — envie um arquivo para cada um.
6. Quando todas as peças estiverem aprovadas, o pacote final (`.zip`) é
   montado automaticamente e fica disponível para download.

---

## Solução de problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Botão "Reunir a equipe de especialistas" não sai do lugar, nada acontece ao clicar | Chunks JS desatualizados após muitas alterações em modo dev | Pare o `pnpm dev`, apague `apps/web/.next`, rode `pnpm dev` de novo |
| "Sua assinatura não está ativa" ao criar campanha | Nenhuma assinatura ativa ainda | Vá em Configurações e assine um plano (§7) |
| "Créditos insuficientes" | Saldo do plano esgotado | Compre créditos avulsos em Configurações |
| Card de vídeo mostra "Falhou" | Falha em alguma etapa do pipeline (ElevenLabs/Pexels/Shotstack/n8n) | Clique em "Tentar novamente"; se persistir, confirme que o container `ayon-creator-n8n` está rodando (§2) e que as 3 chaves de fornecedor estão configuradas (§3) |
| Vídeo demora muito e nunca termina | n8n não está rodando, ou `N8N_WEBHOOK_URL` desatualizada | `docker ps` para confirmar o container; `n8n/README.md` tem o passo a passo de diagnóstico |

Detalhamento técnico completo do pipeline de vídeo em
[`docs/architecture.md` §3.5.1](architecture.md#351-geração-automática-de-vídeo-★-novo-preparação-missão-9)
e [`docs/flows.md`, Fluxo 13](flows.md#fluxo-13--pipeline-de-geração-de-vídeo-n8n-★-novo-missão-9).
