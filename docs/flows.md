# Fluxos — Ayon Creator

> **Status:** v1.0 (revisão 11 — Fluxo 10 implementado, versão simplificada) — **aprovado, fonte oficial da verdade para a implementação**
> **Última atualização:** 2026-08-03
> **Mudança desta revisão (11 — Missão 3 implementada):** Fluxo 10 implementado e em produção, mas só para o gatilho `campaign_strategy` (tela "Criar Campanha", CAMP-1/2/3 simplificado) — painel de especialistas + Coordinator rodam de ponta a ponta (`Promise.allSettled`, falha de um especialista nunca bloqueia os demais nem o Coordinator, passo 7 confirmado em produção, não mais decisão em aberto). O gatilho `trend_ranking` (Fluxo 2, passo 4) ainda não está ligado ao Intelligence Hub porque o Trend Engine em si não foi implementado; geração de conteúdo (Fluxo 3) também não consome o Intelligence Hub ainda — ambos permanecem como especificado, aguardando suas próprias missões.
> **Mudança desta revisão (10 — infraestrutura de especialistas plugáveis):** Fluxo 10 (passos 1 e 3) reescrito — o Intelligence Hub resolve quais especialistas participam consultando o Specialist Registry (`specialists`, filtrado por `applies_to`), não mais uma lista fixa de 7 papéis no código. Ver [architecture.md §4.1](architecture.md#41-specialist-registry-especialistas-plugáveis-★-novo-revisão-10).
> **Mudança desta revisão (8 — consolidação final antes da Missão 2):** Fluxo 10 (passo 2) explicita que o contexto montado pelo Intelligence Hub inclui histórico de campanhas e aprendizados aplicados, não só o Brand Brain do instante; Fluxo 3 ganha nota da regra inegociável de que nenhuma peça é gerada sem carregar o Brand Brain.
> Fluxos correspondentes ao escopo do [PRD.md](../PRD.md), usando as entidades definidas em [database.md](database.md) e a arquitetura de [architecture.md](architecture.md).
> **Convenção de leitura:** cada passo cita o nome exposto ao usuário (linguagem de negócio) seguido, entre parênteses, do Core Engine técnico correspondente — nunca o inverso na UI real (ver PRD §2).
> **Mudança da revisão 3:** onboarding vira entrevista conversacional; estratégia de campanha passa pelo Intelligence Hub (novo Fluxo 10); Fluxo 5 deixa de ser "Publicação" e passa a ser "Entrega do Pacote de Conteúdo" (MVP não publica automaticamente); Fluxo 8 (Brand Evolution) reforça que a aplicação de sugestões é sempre manual, em todos os planos.
> **Mudança desta revisão (6 — provisionamento inicial de conta):** Fluxo 1, passo 1, atualizado — cadastro cria só o usuário (confirmação de e-mail obrigatória); organização/marca/membro são criados por um Provisionamento Inicial idempotente no primeiro acesso autenticado, não mais no `signUp`. Ver [architecture.md §2.2](architecture.md#22-provisionamento-inicial-bootstrap-de-conta-★-novo-revisão-6).
> **Mudança desta revisão (7 — Princípio do Consultor Permanente):** "entrevista" renomeada para "conversa" em todo o documento; Fluxo 1 (passos 2–3) reescrito para descrever comportamento de reação/memória, não extração de dados; Fluxos 2, 3, 4 e 10 passam a exigir/exibir justificativa em linguagem de negócio ancorada no Brand Brain (ver [PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7) e [architecture.md §1.1](architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7)).

---

## Fluxo 1 — "Conheça sua empresa" (Onboarding Conversacional)

1. Usuário cria conta (Supabase Auth — apenas o usuário; confirmação de e-mail obrigatória). No primeiro acesso autenticado após a confirmação (por login ou pelo link do e-mail), um **Provisionamento Inicial** idempotente (ver [architecture.md §2.2](architecture.md#22-provisionamento-inicial-bootstrap-de-conta-★-novo-revisão-6)) cria a organização (`organizations`, com `provider_tier` inicial herdado do plano escolhido), o vínculo do usuário como owner (`organization_members`) e a primeira marca (`brands`). O usuário só acessa o restante da plataforma após essa etapa ser concluída com sucesso.
2. Sistema abre a conversa **"Conheça sua empresa"** com a Ayon — não uma entrevista, não um formulário: desde a primeira troca, a Ayon reage ao que o usuário conta, traz observações/hipóteses (Princípio do Consultor Permanente, PRD §1.1) e só então segue para o próximo tema.
3. A Ayon conduz a conversa por temas (história+produtos, clientes, concorrência+diferenciais, objetivos, tom de voz+palavras), podendo pular/reordenar conforme o que o usuário já contou naturalmente. A partir do segundo tema, toda transição inclui pelo menos uma conexão espontânea com algo já dito antes (memória, não um checklist sequencial).
4. Cada resposta gera: (a) um registro em `brand_onboarding_answers` por campo estruturado identificado (uma única resposta do usuário pode tocar mais de um campo ao mesmo tempo — ex: um tema "concorrência + diferenciais" gera registros para `competitors` e `differentiators` na mesma rodada, sem relação 1:1 entre resposta e `question_key`); (b) atualização dos campos correspondentes em `brand_brain_profiles`; (c) um item em `knowledge_base_items` (`source_type = onboarding_conversation`) por turno, para retrieval futuro.
5. (Opcional, a qualquer momento) Usuário acessa **"Ensine sua empresa para a IA"** (Knowledge Base) para enviar documentos, conteúdos passados e materiais adicionais além do que foi dito na conversa.
6. (Opcional) Upload inicial de mídia própria (`brand_media_assets`).
7. Usuário confirma o plano (`subscriptions`) — o tier de provedor correspondente é aplicado automaticamente, sem que o usuário escolha fornecedor algum.
8. Redirecionado ao dashboard da marca.

> A conversa pode ser retomada/complementada depois — não trava o uso do produto (ver decisão em aberto PRD §13.7 sobre ser síncrona ou em etapas). Ao retomar, a Ayon recapitula citando algo específico já dito, nunca "paramos na pergunta X" (ver [ux-design.md §4.2](ux-design.md#42-conversa-com-o-consultor-onboarding-conversacional)).

## Fluxo 2 — "O que está em alta" → "Criar campanha"

1. Usuário acessa **"O que está em alta"** (Trend Engine) para uma marca.
2. Sistema cria `trend_research` (status `pending`) e dispara webhook para n8n.
3. **Trend Engine** resolve o Trend Source Provider ativo (via tier da organização/marca) e consulta tendências filtradas pelo `niche`.
4. Os candidatos de tendência são enviados ao **Intelligence Hub** (ver **Fluxo 10**) para ranqueamento estratégico — não é mais um ranqueamento isolado do Brand Brain.
5. Resultado consolidado gravado em `trend_research.summary` (+ `intelligence_hub_session_id`), `status = completed`.
6. UI (via Realtime) exibe as tendências já ranqueadas e priorizadas.
7. Usuário seleciona uma tendência/tema e clica em **"Criar campanha"**.
8. Sistema cria `campaigns` (status `draft`) vinculada à `trend_research` e dispara nova sessão do **Intelligence Hub** (Fluxo 10) para definir a estratégia completa da campanha (temas, formatos do pacote, calendário sugerido).
9. Estratégia consolidada gravada em `campaigns.strategy_summary` (+ `intelligence_hub_session_id`) — inclui obrigatoriamente uma justificativa em linguagem de negócio ancorada no Brand Brain (Princípio do Consultor Permanente, PRD §1.1; ver Fluxo 10, passo 4).
10. Campanha passa para `generating`, disparando o **Fluxo 3** para cada peça prevista.

## Fluxo 3 — "Criar campanha": Geração do Pacote de Conteúdo (Asset Engine)

Disparado por campanha em `generating`. Para cada formato previsto na estratégia (vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro, teleprompter — PRD §4.3), o sistema cria um `content_piece` com `format`, `production_mode` (quando aplicável) e a flag `is_primary` (verdadeira apenas para a peça central da campanha, tipicamente o vídeo).

> **Regra inegociável (Princípio do Consultor Permanente, PRD §1.1):** nenhum `content_piece` é gerado sem que seu script/copy tenha passado pelo Brand Brain — seja diretamente, seja via `consolidated_result` do Intelligence Hub (que por sua vez já parte do Brand Brain). Não existe caminho de geração que pule esse carregamento, para nenhum formato.

### 3.1 Script/Copy

- **Peça principal (`is_primary = true`)**: o roteiro/copy vem diretamente do `consolidated_result` da sessão do Intelligence Hub da campanha (não dispara nova sessão) — ou, quando o formato exigir refinamento próprio, aciona uma sessão adicional do Intelligence Hub focada nessa peça.
- **Peças derivadas** (demais formatos): o **Brand Brain** gera o texto reaproveitando a estratégia já consolidada, sem novo painel completo de especialistas (ver decisão em aberto arquitetura §10 / PRD §13.1).
- Resultado gravado em `content_pieces.script`; `generation_metadata` registra o(s) `llm_provider_key` usado(s); `content_pieces.brand_rationale` grava a justificativa em linguagem de negócio de por que a peça foi feita assim (Princípio do Consultor Permanente, PRD §1.1) — herdada do `rationale` da sessão do Intelligence Hub para peças principais, ou gerada pelo Brand Brain para peças derivadas.

### 3.2 Materialização por modo de produção (formatos visuais)

- **`ai_avatar`**: Asset Engine aciona Voice Provider (áudio) e Avatar Provider (vídeo com avatar + áudio).
- **`licensed_stock_video`**: Asset Engine aciona Media Provider para selecionar clipes compatíveis, narra com Voice Provider ou legenda.
- **`own_media`**: Asset Engine usa `brand_media_assets` conforme tags/tema.
- **`hybrid`**: combina Avatar Provider + Media Provider + `brand_media_assets`.
- **`thumbnail`**: gerado a partir de frame do vídeo principal ou via geração de imagem (LLM/Media Provider, a definir).
- Formatos puramente textuais (`caption`, `blog_post`, `email`, `script`, `teleprompter`) não passam pela Provider Layer de mídia — são apenas variações/formatações do texto gerado em 3.1.

### 3.3 Conclusão e montagem do Pacote de Conteúdo

1. Ao concluir a geração de uma peça, `content_pieces.status = ready_for_review`.
2. Quando todas as peças estão `ready_for_review` (ou removidas do escopo), `campaigns.status = ready_for_review`.
3. Após aprovação de todas as peças (Fluxo 4), o Asset Engine monta o **Pacote de Conteúdo** (`content_packages`, zip com todos os formatos aprovados), `status = building` → `ready`.
4. UI atualizada via Realtime; usuário é notificado de que o pacote está pronto para download.

## Fluxo 4 — Revisão e Aprovação

> Aprovação humana é **obrigatória** para toda peça, em todos os planos, antes da montagem do pacote final.

1. Usuário abre a campanha em `ready_for_review` e visualiza cada `content_piece` (preview da `content_versions` mais recente, junto com `content_pieces.brand_rationale` — ver Cartão de Revisão de Peça, [ux-design.md §4.6](ux-design.md#46-cartão-de-revisão-de-peça)).
2. Para cada peça, usuário pode:
   - **Aprovar** → `status = approved`, grava `approved_by`/`approved_at`, emite `learning_signals` (`signal_type = approved`).
   - **Rejeitar/pedir regeneração** → volta para `generating`, nova `content_versions`, emite `learning_signals` (`signal_type = rejected`, motivo no `payload`).
   - **Editar manualmente** → nova `content_versions` com a edição, emite `learning_signals` (`signal_type = edited`, diff no `payload`).
3. Quando todas as peças estão `approved`, `campaigns.status = approved`, disparando a montagem do pacote (Fluxo 3.3).

> Todo evento deste fluxo alimenta o **Fluxo 8 — Brand Evolution**.

## Fluxo 5 — Entrega do Pacote de Conteúdo (MVP)

> **O MVP não publica automaticamente em nenhuma rede social, em nenhum plano.** Esta é uma decisão de escopo definitiva do PRD §9, não uma limitação técnica temporária apenas do plano Starter/Pro.

1. Quando `content_packages.status = ready`, o usuário é notificado.
2. Usuário acessa a campanha e faz **download do pacote completo** (zip com vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro e teleprompter, conforme gerados) — ou baixa peças individualmente.
3. Usuário publica manualmente, pelos próprios canais, fora da Ayon Creator.
4. (Opcional) Usuário pode registrar manualmente onde/quando publicou cada peça, para que essa informação possa futuramente alimentar o Learning Engine como `learning_signals` (`signal_type = engagement_metric`) — mecanismo de captura exato é decisão em aberto.

### 5.B — Publicação Automática (fora do MVP / backlog)

Mantido apenas como referência de arquitetura futura (ver [database.md §6](database.md#6-publicação-fora-do-mvp) e [architecture.md §7](architecture.md#7-publicação-fora-do-mvp)): conexão de canais (`publishing_channels`), publicação agendada via n8n (`publications`). **Não faz parte do MVP e não deve ser implementado nesta fase.**

## Fluxo 6 — Consumo de Créditos e Billing

> **Isenção esclarecida na revisão técnica pré-Missão 2:** a conversa "Conheça sua empresa" (Fluxo 1, Brand Brain via LLM Provider) **não** consome créditos nem é bloqueada por saldo insuficiente — ela não gera um ativo monetizável (peça de conteúdo/campanha), é a etapa que faz o cliente conhecer o produto antes de qualquer geração paga. Consumo de crédito começa no Fluxo 2 (Intelligence Hub) em diante.

1. Antes de qualquer chamada à Provider Layer com custo variável **de geração de conteúdo ou estratégia** (Intelligence Hub, Asset Engine), calcula-se o custo em créditos (`credit_pricing`, por `capability` + `tier` — nunca por fornecedor, que é invisível ao cliente) e checa-se saldo em `credit_ledger`.
2. Se saldo insuficiente: usuário é bloqueado com opção de comprar créditos avulsos.
3. Se suficiente: job disparado; ao concluir, lançamento `consumption` gravado vinculado à `content_versions` (ou à sessão do Intelligence Hub, para o custo do painel de especialistas).
4. Renovação de cota mensal gera lançamento `grant_plan` no início de cada ciclo.
5. Painel de uso exibe saldo e histórico por marca/campanha, discriminado por tier (nunca por fornecedor).

## Fluxo 7 — Gestão de Marcas e Times (Plano Business)

1. Admin da organização cria uma nova `brands`.
2. Admin convida usuários e define papel por marca (`brand_members`).
3. Cada marca opera de forma independente nos Fluxos 1–6, podendo ter seu próprio `provider_tier` (override do tier da organização), compartilhando apenas o billing da organização.

## Fluxo 8 — "O que funcionou" (Brand Evolution / Learning Engine)

1. O **Learning Engine** consome continuamente os `learning_signals` gerados pelos Fluxos 4 e 5 de uma marca.
2. Periodicamente (gatilho exato = decisão em aberto PRD §13.3), agrega os sinais e gera candidatos em `learning_insights`, **status `pending_review`**, com um texto em linguagem simples. Exemplo real:
   > "Percebemos que vídeos de até 35 segundos performam melhor. Deseja atualizar sua estratégia?"
3. O usuário vê essa sugestão na área **"O que funcionou"** e decide: **aceitar** (`status = applied`, `reviewed_by` preenchido) ou **descartar** (`status = dismissed`).
4. **Regra inegociável, sem exceção por plano:** nenhum `learning_insight` é aplicado sem essa decisão explícita do usuário. Não existe "aplicação automática" nem no Business.
5. Ao ser aceito, o insight atualiza:
   - `brand_brain_profiles.learned_preferences` (`applied_to = brand_brain`);
   - o ranqueamento usado pelo **Trend Engine** (`applied_to = trend_engine`);
   - os prompts/parâmetros usados pelo **Intelligence Hub** (`applied_to = intelligence_hub`) ou pelo **Asset Engine** (`applied_to = asset_engine`).

## Fluxo 9 — Troca de Provedor (Provider Swap — operação interna)

Nunca acionado pelo cliente final — apenas por um responsável técnico/administrativo interno.

1. Decide-se substituir o fornecedor ativo de uma capacidade dentro de um tier (ex: trocar o Avatar Provider do tier Premium de `heygen` para um fornecedor `X`).
2. Um novo adapter para `X` é implementado, satisfazendo o contrato da capacidade `avatar`.
3. Nova linha em `provider_configs` (`capability = avatar`, `tier = premium`, `provider_key = x`, `status = active`).
4. Linha antiga marcada `inactive` (ou mantida como `fallback_provider_key`).
5. Nenhuma mudança necessária em Core Engines, Fluxos 1–8, telas do cliente ou workflows de n8n — todos continuam pedindo "capacidade X, tier Y" de forma abstrata.
6. `content_versions.generation_metadata.avatar_provider_key` registra a mudança para auditoria/comparação de custo e qualidade.

## Fluxo 10 — Coordenação de Especialistas (Intelligence Hub)

Sub-fluxo reutilizado pelos Fluxos 2 e 3 sempre que uma decisão é classificada como "importante" (estratégia de tendência/campanha, ou peça principal de uma campanha).

1. O Core Engine solicitante (Trend Engine, ou o fluxo de criação de campanha) abre uma `intelligence_hub_sessions` (`status = running`), informando `related_entity_type`/`related_entity_id` e `trigger_reason` — `trigger_reason` é normalizado para um dos valores de `applies_to` usados pelo Specialist Registry (ex.: `campaign_strategy`, `trend_ranking`).
2. O Intelligence Hub monta o contexto comum: Brand Brain (identidade + preferências aprendidas) + Knowledge Base (retrieval relevante) + **histórico recente de `campaigns` e `learning_insights` já aplicados da marca** (memória de longo prazo, Princípio do Consultor Permanente, PRD §1.1) + dados de entrada específicos (candidatos de tendência, ou tema da campanha). Nenhuma sessão é montada como se fosse a primeira interação com a marca.
3. O Intelligence Hub consulta o **Specialist Registry** (`specialists` — architecture.md §4.1) filtrando `status = active` e `applies_to` contendo o `trigger_reason` desta sessão, ordenado por `priority` — **não** uma lista fixa de 7 papéis no código. Cada especialista retornado recebe o contexto e gera sua opinião de forma independente, via LLM Provider (resolvido pelo tier ativo + `specialist_id` — podendo variar por especialista no tier Premium). Cada opinião é gravada em `specialist_opinions` (referenciando `specialist_id`), incluindo uma justificativa em linguagem de negócio ancorada no Brand Brain (Princípio do Consultor Permanente, PRD §1.1).
4. Quando todas as opiniões estão disponíveis, o registro do Specialist Registry com `role = coordinator` (também uma chamada ao LLM Provider, com prompt de síntese — nunca hardcoded) consolida as opiniões em uma única estratégia coerente, resolvendo divergências, e produz também uma justificativa consolidada em linguagem de negócio.
5. Resultado gravado em `intelligence_hub_sessions.consolidated_result`, `status = completed`.
6. A entidade solicitante (`trend_research.summary`, `campaigns.strategy_summary` ou `content_pieces.script`) referencia a sessão via `intelligence_hub_session_id` e desnormaliza o resultado consolidado para leitura rápida.
7. Em caso de falha de qualquer especialista, o Coordinator consolida com os que responderam com sucesso, registrando a ausência no `consolidated_result` (nunca bloqueia a campanha inteira por falha de um único especialista) — **implementado e confirmado** (revisão 11): `runSpecialistPanel` usa `Promise.allSettled`, cada falha é logada e simplesmente omitida do contexto enviado ao Coordinator.

---

## Convenções de Status (resumo)

| Entidade | Status possíveis |
|---|---|
| `trend_research` | `pending` → `completed` / `failed` |
| `intelligence_hub_sessions` | `running` → `completed` / `failed` |
| `campaigns` | `draft` → `generating` → `ready_for_review` → `approved` → `package_ready` (ou `failed`) |
| `content_pieces` | `draft` → `generating` → `ready_for_review` → `approved`/`rejected` |
| `content_packages` | `building` → `ready` / `failed` |
| `learning_insights` | `pending_review` → `applied` / `dismissed` |
| `provider_configs` | `active` / `inactive` / `error` |

## Decisões em Aberto (fluxos)

1. Regeneração parcial: ao rejeitar 1 peça, a campanha inteira volta para `generating` ou só aquela peça? (proposta: só a peça — confirmar).
2. Notificações: e-mail, in-app, ou ambos?
3. Agendamento de campanhas recorrentes automáticas é MVP ou backlog?
4. Periodicidade/gatilho exato do Fluxo 8.
5. Mecanismo de captura de `engagement_metric` no Fluxo 5 (passo 4), dado que não há integração de publicação automática no MVP — provavelmente entrada manual do usuário ou upload de métrica.
