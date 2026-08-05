# Fluxos — Ayon Creator

> **Status:** v1.0 (revisão 32 — Missão 12 aprovada, ajustes incorporados)
> **Última atualização:** 2026-08-05
> **Mudança desta revisão (32 — Missão 12 aprovada, ajustes incorporados):** Fluxo 6, passo 1, e Fluxo 16 atualizados para os 2 papéis administrativos (`super_admin`/`support_admin`, não só `super_admin`) — o bypass de crédito vale para qualquer `platform_admin`, senão uma sessão de suporte de `support_admin` impersonando um cliente real debitaria o cliente por engano. Fluxo 16, texto exato do banner de impersonação (sem botão de fechar). Ver [architecture.md §15](architecture.md#15-super-admin--plataforma-administrativa-★-missão-12) e [docs/changelog.md](changelog.md).
> **Mudança desta revisão (31 — Missão 12 em preparação, Super Admin):** Fluxo 6 (Consumo de Créditos e Billing) ganha o bypass de `super_admin`, no mesmo passo já existente (portão de crédito) — sem passo novo. Novo **Fluxo 16 — Impersonação e Ações Administrativas**. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (30 — Missão 11 aprovada, ressalva de composição resolvida):** Fluxo 15 reescrito — resolução do `visual_brief` da campanha (passo 2, novo), geração de múltiplos candidatos por rodada quando viável (passos 3/4), escolha do usuário (passo 5, novo). Mecanismo de composição corrigido de "asset `html`" para "timeline em camadas" (achado real de pesquisa, sem impacto na forma dos passos, só no mecanismo interno do passo 3). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (29 — Missão 11 aprovada, escopo ajustado):** Fluxo 13, passo 3, reescrito — seleção de voz automática (1ª geração), sem legenda, seleção de cenas por trecho do roteiro. Fluxo 15, passo 2, reescrito — composição real via Shotstack `html` asset (não só foto+logo). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (28 — preparação Missão 11):** Fluxo 13 ganha identidade visual automática, `stage` granular e seleção de cenas revisada (passos 3/7 amendados). Novo **Fluxo 15 — Gerar Mídia Visual Automaticamente**, mesmo desenho assíncrono do Fluxo 13 aplicado a `stories`/`carousel`/`thumbnail`. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (27 — Missão 10 aprovada, escopo ajustado):** Fluxo 14, passos 2/3, ganham a categoria `other` e a captura automática de contexto (`pathname`/`app_version`/`user_agent`). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (26 — preparação Missão 10):** novo **Fluxo 14 — Enviar Feedback**, utilitário transversal disponível em qualquer tela autenticada. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (25 — Missão 9 dividida em 2 etapas):** Fluxo 3, §3.2, e Fluxo 13 restritos à **Etapa 1** (`licensed_stock_video` apenas — ElevenLabs + Pexels + Shotstack) — `ai_avatar`/`hybrid` ficam para a **Etapa 2** (futura, recurso Premium), sem implementação nem fluxo detalhado agora. Ver [PRD.md](../PRD.md) revisão 22 e [docs/changelog.md](changelog.md).
> **Mudança desta revisão (24 — preparação Missão 9):** Fluxo 3, §3.2, reescrito para o formato `video` — passa a cobrir `ai_avatar`/`licensed_stock_video`/`hybrid` de fato (não mais só especificação futura), delegando a materialização a um novo sub-fluxo assíncrono, **Fluxo 13 — Pipeline de Geração de Vídeo (n8n)**. Fluxo 6 (Consumo de Créditos) ganha nota sobre o novo `trigger_reason` `video_generation` e sobre a cobrança acontecer no webhook de conclusão do pipeline, não mais dentro da Server Action que dispara a geração. Tabela de Convenções de Status ganha `failed` em `content_pieces`. Ver [docs/changelog.md](changelog.md) para o relato completo da auditoria que precedeu esta revisão.
> **Mudança desta revisão (23 — Missão 8 implementada e validada):** Fluxo 8 confirmado em produção — `runLearningAnalysisAction` agrega os `learning_signals` não usados, bloqueia com mensagem clara quando há menos de 5, e aciona o Intelligence Hub (`learning_analysis`) quando há sinal suficiente. Fluxo 4, passo 2, confirmado: `approveContentPieceAction`/`rejectContentPieceAction`/`editContentPieceAction` (Missão 7) agora emitem `learning_signals` de verdade — as marcações "★ Missão 8" da revisão 21 foram removidas. Validado em produção que aceitar um insight (`acceptInsightAction`) realmente muda o comportamento de gerações futuras: uma nova sessão de `campaign_strategy` para a mesma marca trouxe os especialistas citando o aprendizado aplicado.
> **Mudança desta revisão (22 — preparação Missão 8, Learning Engine):** Fluxo 8 reescrito com o escopo do MVP aprovado — gatilho síncrono sob demanda (sem cron/n8n), mínimo de 5 `learning_signals` não usados antes de qualquer análise, geração via Intelligence Hub (novo tipo de decisão `learning_analysis`, painel Marketing + Branding), gratuito em todos os planos, e mecanismo único de aplicação (`brand_brain_profiles.learned_preferences`, `applied_to` como rótulo descritivo, não destino de escrita separado). Resolve [PRD.md §13, item 3](../PRD.md#13-decisões-em-aberto-precisam-de-aprovação-antes-de-virar-escopo).
> **Mudança desta revisão (21 — correção de auditoria):** Fluxo 4, passo 2, reescrito para refletir os nomes e o comportamento reais das Server Actions da Missão 7 (`apps/web/app/(platform)/criar-campanha/asset-actions.ts`) — rejeitar é estado terminal (`rejected`), não volta sozinho para `generating`; regenerar é ação explícita e separada da rejeição; editar atualiza `content_pieces.script` diretamente, sem criar `content_versions` nova (histórico de versões existe só para regeneração via LLM e upload de mídia). A emissão de `learning_signals` nesses três pontos segue marcada como pendente (★ Missão 8) — não existe no código ainda. Achado em auditoria de rotina antes da Missão 8.
> **Mudança desta revisão (20 — Missão 7 implementada e validada):** Fluxo 3 confirmado em produção com Supabase + Anthropic reais — aprovação da estratégia dispara `initializeCampaignContentPieces` (9 peças) seguido de geração síncrona dos 5 formatos textuais (§3.2), falha parcial de uma peça nunca bloqueia as demais (mesmo espírito do painel de especialistas, Fluxo 10). §3.3 (montagem do pacote) confirmada síncrona e automática — dispara dentro da própria Server Action de aprovação assim que a última peça vira `approved`, sem Realtime e sem passo manual separado. Editar/regenerar peça textual (Fluxo 4) e upload manual de `own_media` validados; download do pacote via signed URL confirmado.
> **Mudança desta revisão (19 — preparação Missão 7, Asset Engine):** Fluxo 3, §3.2, reescrito — escopo do MVP limitado a `text_only`/`own_media` (upload manual, sem depender de `brand_media_assets`), `ai_avatar`/`licensed_stock_video`/`hybrid` mantidos como especificação futura. §3.3 corrigida para não mencionar Realtime (decisão do dono do produto: sem Realtime no MVP, mesmo padrão de todas as missões anteriores).
> **Mudança desta revisão (18 — Missão 6 implementada e validada):** Fluxo 6 e Fluxo 12 confirmados em produção com Mercado Pago sandbox real — assinatura ativada via webhook, créditos concedidos, consumo debitado só após sucesso, bloqueio por saldo/assinatura testado e funcionando com CTA correto.
> **Mudança desta revisão (17 — preparação Missão 6, Billing):** Fluxo 6 finalizado com o portão de crédito de verdade (checagem antes, cobrança só após sucesso, nunca depois de falha) e valores concretos de plano/preço. Novo Fluxo 12 — assinatura de plano e compra de créditos avulsos via Mercado Pago (Preapproval + Checkout Pro), incluindo o tratamento explícito de que o webhook, não o redirect do navegador, é a fonte de verdade.
> **Mudança desta revisão (16 — Missão 5 implementada e validada):** Fluxo 2 confirmado em produção — Server Action direta (sem n8n), Trend Source Provider resolvido via Provider Gateway, candidatos sempre passando pelo Intelligence Hub antes de chegar à tela. Validado com Supabase + Anthropic reais.
> **Mudança desta revisão (15 — aprovação da Missão 5, Trend Engine):** Fluxo 2 revisado e aprovado — Server Action direta, sem n8n (passo 2), Trend Source Provider resolvido via Provider Gateway sem o Trend Engine conhecer o fornecedor concreto (passo 3), e nova regra inegociável de que nenhuma tendência é exibida ao usuário sem passar pelo Intelligence Hub (passo 4). Ver [architecture.md §3.3/§8](architecture.md#33-trend-engine) e [docs/changelog.md](changelog.md).
> **Mudança desta revisão (14 — Missão 4 implementada):** Fluxo 11 implementado e validado em produção — upload de PDF/DOCX/TXT (extração síncrona confirmada) e nota manual, ambos passando por `knowledge_base_items`. Retrieval por recência + tags confirmado como decisão final (não mais pendente).
> **Mudança desta revisão (13 — preparação da Missão 4):** novo Fluxo 11 — "Ensine sua Empresa para a IA" (Knowledge Base), reutilizando `knowledge_base_items` já existente desde a Missão 2. Retrieval no MVP é por recência + tags, não por embeddings — decisão pendente de confirmação do dono do produto (ver [architecture.md §10, item 3](architecture.md#10-decisões-em-aberto-arquitetura)).
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
2. Server Action cria `trend_research` (status `pending`) e, na mesma chamada, aciona o Trend Engine — sem webhook, sem n8n (ver [architecture.md §8](architecture.md#8-papel-do-n8n)).
3. **Trend Engine** resolve o Trend Source Provider ativo (via Provider Gateway, `(capability: "trend_source", tier)`) e consulta tendências filtradas pelo `niche` — o Trend Engine nunca conhece o fornecedor concreto por trás do adapter (ver [architecture.md §3.3](architecture.md#33-trend-engine)).
4. **Regra inegociável — nenhuma tendência é exibida ao usuário sem passar pelo Intelligence Hub:** os candidatos brutos do Trend Source Provider nunca chegam à tela TREND-1 diretamente. São sempre enviados ao **Intelligence Hub** (ver **Fluxo 10**) — que monta contexto a partir do Brand Brain, aciona o Painel de Especialistas e o Coordinator — para ranqueamento e interpretação estratégica; nunca um ranqueamento isolado do Trend Engine ou do Brand Brain sozinho (ver [architecture.md §3.3](architecture.md#33-trend-engine)).
5. Resultado consolidado gravado em `trend_research.summary` (+ `intelligence_hub_session_id`), `status = completed`.
6. UI (via Realtime) exibe as tendências já ranqueadas e priorizadas, cada uma com a justificativa em linguagem de negócio ancorada no Brand Brain (Bloco de Justificativa de Marca, TREND-2).
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

> **Escopo da Missão 7 (MVP, decisão do dono do produto — [architecture.md §3.5](architecture.md#35-asset-engine)):** só `text_only` e `own_media` implementados. **Escopo da Missão 9, Etapa 1 (revisão 25):** o formato `video` passa a cobrir também `licensed_stock_video` — `ai_avatar`/`hybrid` ficam para a Etapa 2 (futura, recurso Premium). `stories`/`carousel`/`thumbnail` permanecem `own_media` (upload manual), fora de escopo em ambas as etapas.

- **`text_only`** (`caption`, `blog_post`, `email`, `script`, `teleprompter`): não passam pela Provider Layer de mídia — são apenas variações/formatações do texto gerado em 3.1. Custo em créditos: `asset_generation` ([database.md §7.3](database.md#73-credit_pricing)).
- **`own_media`** (`stories`, `carousel`, `thumbnail`, e `video` quando o modo de produção não exige geração automática): o cliente **envia o próprio arquivo** diretamente na tela de revisão da peça (CAMP-5) — upload direto para o bucket `content-output`, gravado em `content_versions.output_storage_path`. **Não depende de `brand_media_assets`/Biblioteca de Mídia** (decisão explícita para não acoplar a Missão 7 a uma funcionalidade ainda não implementada). Sem custo em créditos — não há geração por IA nesses formatos no MVP.
- **`licensed_stock_video`** (formato `video`, ★ Etapa 1 da Missão 9): não materializa de forma síncrona dentro deste fluxo — a peça é marcada `generating` e a materialização acontece de ponta a ponta no **Fluxo 13 — Pipeline de Geração de Vídeo (n8n)**, que aciona o Voice Provider (narração, ElevenLabs), o Media Provider (cenas, Pexels) e o Video Render Provider (composição final em MP4 vertical 9:16, Shotstack). Custo em créditos: `video_generation`, cobrado só ao final do pipeline com sucesso (ver Fluxo 6 e Fluxo 13, passo 6) — nunca `asset_generation`, que é exclusivo de texto.
- **`ai_avatar`/`hybrid`** (formato `video`, ★ Etapa 2 da Missão 9, futura): não implementados nesta fase — quando a Etapa 2 for aprovada, seguem o mesmo Fluxo 13, com um branch de Avatar Provider (HeyGen) no lugar/além do Media Provider.

### 3.3 Conclusão e montagem do Pacote de Conteúdo

1. Ao concluir uma peça (geração de texto, ou upload manual confirmado), `content_pieces.status = ready_for_review`.
2. Quando todas as peças estão `ready_for_review` (ou removidas do escopo), `campaigns.status = ready_for_review`.
3. Após aprovação de todas as peças (Fluxo 4), o Asset Engine monta o **Pacote de Conteúdo** (`content_packages`, zip com todos os formatos aprovados), `status = building` → `ready`.
4. UI reflete o resultado direto de cada Server Action (mesmo padrão de toda missão até aqui — sem Supabase Realtime no MVP, decisão do dono do produto); usuário é notificado de que o pacote está pronto para download.

## Fluxo 4 — Revisão e Aprovação

> Aprovação humana é **obrigatória** para toda peça, em todos os planos, antes da montagem do pacote final.

1. Usuário abre a campanha em `ready_for_review` e visualiza cada `content_piece` (preview da `content_versions` mais recente, junto com `content_pieces.brand_rationale` — ver Cartão de Revisão de Peça, [ux-design.md §4.6](ux-design.md#46-cartão-de-revisão-de-peça)).
2. Para cada peça, usuário pode (ações reais desde a Missão 7 — `criar-campanha/asset-actions.ts`):
   - **Aprovar** (`approveContentPieceAction`) → `status = approved`, grava `approved_by`/`approved_at`, emite `learning_signals` (`signal_type = approved`).
   - **Rejeitar** (`rejectContentPieceAction`) → `status = rejected` (estado terminal, **não** volta sozinho para `generating`), motivo opcional gravado em `audit_logs`; emite `learning_signals` (`signal_type = rejected`, motivo no `payload`).
   - **Regenerar** (`regenerateContentPieceAction`, só `text_only`) → ação explícita e separada da rejeição, nova chamada ao LLM Provider, nova `content_versions`, novo custo em créditos (`asset_generation`).
   - **Editar manualmente** (`editContentPieceAction`, só `text_only`) → atualiza `content_pieces.script` diretamente (**não** cria `content_versions` nova — o histórico de versões existe só para regeneração via LLM), sem custo em créditos; emite `learning_signals` (`signal_type = edited`, diff no `payload`).
   - **Enviar arquivo** (`uploadContentPieceMediaAction`, só `own_media`) → nova `content_versions` com o arquivo enviado, sem custo em créditos.
3. Quando todas as peças estão `approved`, a própria Server Action de aprovação monta o pacote automaticamente (Fluxo 3.3), sem passo manual separado.

> Todo evento de aprovação/rejeição/edição deste fluxo alimenta o **Fluxo 8 — Brand Evolution** (Missão 8, implementado e validado — `emitLearningSignal`, `criar-campanha/asset-actions.ts`).

## Fluxo 5 — Entrega do Pacote de Conteúdo (MVP)

> **O MVP não publica automaticamente em nenhuma rede social, em nenhum plano.** Esta é uma decisão de escopo definitiva do PRD §9, não uma limitação técnica temporária apenas do plano Starter/Pro.

1. Quando `content_packages.status = ready`, o usuário é notificado.
2. Usuário acessa a campanha e faz **download do pacote completo** (zip com vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro e teleprompter, conforme gerados) — ou baixa peças individualmente.
3. Usuário publica manualmente, pelos próprios canais, fora da Ayon Creator.
4. (Opcional) Usuário pode registrar manualmente onde/quando publicou cada peça, para que essa informação possa futuramente alimentar o Learning Engine como `learning_signals` (`signal_type = engagement_metric`) — mecanismo de captura exato é decisão em aberto.

### 5.B — Publicação Automática (fora do MVP / backlog)

Mantido apenas como referência de arquitetura futura (ver [database.md §6](database.md#6-publicação-fora-do-mvp) e [architecture.md §7](architecture.md#7-publicação-fora-do-mvp)): conexão de canais (`publishing_channels`), publicação agendada via n8n (`publications`). **Não faz parte do MVP e não deve ser implementado nesta fase.**

## Fluxo 6 — Consumo de Créditos e Billing ★ implementado na Missão 6

> **Isenção esclarecida na revisão técnica pré-Missão 2:** a conversa "Conheça sua empresa" (Fluxo 1, Brand Brain via LLM Provider) **não** consome créditos nem é bloqueada por saldo insuficiente — ela não gera um ativo monetizável (peça de conteúdo/campanha), é a etapa que faz o cliente conhecer o produto antes de qualquer geração paga. Consumo de crédito começa no Fluxo 2 (Intelligence Hub) em diante.

1. Antes de qualquer sessão do Intelligence Hub (`campaign_strategy`, Fluxo 10; `trend_ranking`, Fluxo 2) ou pipeline de geração de vídeo (`video_generation`, Fluxo 13, ★ preparação Missão 9), a Server Action chama o portão de crédito: **★ Missão 12 — se o ator autenticado é `platform_admin` (`super_admin` ou `support_admin`, `platform_admins`), o portão retorna liberado imediatamente** (`costCredits: 0`), sem checar `subscriptions.status` nem saldo, mesmo se a organização sendo usada não é a "casa" do admin (impersonação, Fluxo 16) — a organização visitada nunca é debitada, independente de qual dos 2 papéis está agindo. Para qualquer outro ator: checa se `subscriptions.status` é `active` **ou `trialing`** (★ Missão 12) **e** se o saldo (`SUM(credit_ledger.amount)` da organização) é suficiente para o custo daquela operação (`credit_pricing`, por `trigger_reason` + `tier` — nunca por fornecedor, que é invisível ao cliente). Ver [architecture.md §12.3](architecture.md#123-onde-o-portão-de-crédito-é-verificado) e [architecture.md §15.5](architecture.md#155-super-admin-ilimitado--portão-de-crédito-e-limites-de-plano-centralizados).
2. Se assinatura inativa ou saldo insuficiente: operação é bloqueada **antes** de qualquer chamada à Provider Layer (nunca depois — não desperdiça uma chamada de LLM/fornecedor pago que o cliente não pode pagar), com mensagem direta e CTA para CFG-2 (reativar assinatura) ou CFG-4 (comprar créditos), sem perder o contexto do que o usuário estava fazendo (objetivo de campanha digitado, por exemplo).
3. Se suficiente: operação roda normalmente; **só ao concluir com sucesso**, lançamento `consumption` (`amount` negativo) é gravado em `credit_ledger` — **exceto para qualquer `platform_admin` (★ Missão 12), onde a gravação é pulada por completo** (nenhuma linha em `credit_ledger`, nenhum rastro de consumo na organização usada). Para sessões do Intelligence Hub, vinculado via `related_intelligence_hub_session_id`, gravado pela própria Server Action ao final. Para o pipeline de vídeo (★ preparação Missão 9), vinculado via `related_pipeline_run_id`, gravado pelo **webhook de conclusão do n8n** (Fluxo 13, passo 6) — não pela Server Action original, já que a operação não termina dentro dela. Uma sessão/pipeline que falha (Fluxo 10, passo 7; Fluxo 13, passo 5 — falha) **não gera cobrança**.
4. Renovação de cota mensal gera lançamento `grant_plan` no início de cada ciclo (`current_period_start`/`current_period_end` de `subscriptions`), no valor fixo do plano (Starter 100 / Pro 500 / Business 1.500 — PRD §8).
5. Painel de uso (CFG-4) exibe saldo atual e histórico de `credit_ledger` por organização, discriminado por tipo de lançamento e tier (nunca por fornecedor).

## Fluxo 12 — Assinatura e Compra de Créditos (Mercado Pago) ★ novo, Missão 6

**Assinar/trocar de plano (CFG-2):**
1. Usuário escolhe um plano (Starter/Pro/Business) em CFG-2.
2. Sistema cria uma assinatura recorrente no Mercado Pago (Preapproval) e redireciona o usuário ao checkout do Mercado Pago.
3. Usuário completa o pagamento no Mercado Pago (fora da aplicação).
4. Mercado Pago envia webhook de confirmação (`preapproval` autorizada) → sistema cria/atualiza `subscriptions` (`plan`, `status = active`, `billing_provider_ref = preapproval_id`, período atual) e lança o `grant_plan` do primeiro ciclo em `credit_ledger`.
5. Usuário é redirecionado de volta à aplicação (CFG-2) — a tela reflete o novo plano **assim que o webhook processar**, não no momento do redirect (o redirect do navegador não é a fonte de verdade, só uma conveniência de UX; ver [architecture.md §12.2](architecture.md#122-integração-com-o-mercado-pago)). Enquanto o webhook não chega, CFG-2 mostra estado "processando pagamento".
6. Falha ou cancelamento do pagamento: webhook correspondente marca `subscriptions.status` como `past_due`/`canceled`; usuário vê mensagem clara em CFG-2, sem acesso bloqueado retroativo a créditos já concedidos em ciclos anteriores.

**Comprar créditos avulsos (CFG-4):**
1. Usuário escolhe um pacote de `credit_packages` em CFG-4.
2. Sistema cria um pagamento único no Mercado Pago (Checkout Pro) e redireciona o usuário ao checkout.
3. Usuário completa o pagamento.
4. Mercado Pago envia webhook de confirmação → sistema lança `purchase` em `credit_ledger` (`amount` = créditos do pacote, `external_payment_id` = id do pagamento, garantindo que uma reentrega do mesmo webhook não duplique o crédito).
5. Usuário é redirecionado de volta a CFG-4 — saldo atualizado assim que o webhook processar.

## Fluxo 7 — Gestão de Marcas e Times (Plano Business)

1. Admin da organização cria uma nova `brands`.
2. Admin convida usuários e define papel por marca (`brand_members`).
3. Cada marca opera de forma independente nos Fluxos 1–6, podendo ter seu próprio `provider_tier` (override do tier da organização), compartilhando apenas o billing da organização.

## Fluxo 8 — "O que funcionou" (Brand Evolution / Learning Engine)

> **Escopo do MVP aprovado pelo dono do produto** (preparação Missão 8): só sinais `approved`/`rejected`/`edited` (Fluxo 4); `engagement_metric` (Fluxo 5, passo 4) fica fora do MVP. Análise **gratuita em todos os planos** — nenhum `trigger_reason` novo em `credit_pricing`.

1. O usuário aciona a análise **sob demanda** (ex.: abre "O que Funcionou" com sinais novos desde a última rodada, ou usa uma ação explícita "buscar novidades") — **síncrono, sem cron/n8n**, mesmo padrão de toda missão até aqui.
2. A Server Action verifica se há **pelo menos 5 `learning_signals`** ainda não usados numa análise anterior da marca. Se não houver, nenhuma análise roda — tela mostra o quanto falta, nunca uma sugestão fraca a partir de 1-2 eventos.
3. Se houver sinal suficiente, a Server Action monta o contexto (sinais agregados + Brand Brain) e aciona o **Intelligence Hub** com um novo tipo de decisão, `learning_analysis` — painel Marketing + Branding (Copywriting não participa; mesmo Coordinator generalizado das demais decisões, Missão 5). Gera candidatos em `learning_insights`, **status `pending_review`**, com um texto em linguagem simples. Exemplo real:
   > "Percebemos que vídeos de até 35 segundos performam melhor. Deseja atualizar sua estratégia?"
4. O usuário vê essa sugestão na área **"O que funcionou"** e decide: **aceitar** (`status = applied`, `reviewed_by` preenchido) ou **descartar** (`status = dismissed`).
5. **Regra inegociável, sem exceção por plano:** nenhum `learning_insight` é aplicado sem essa decisão explícita do usuário. Não existe "aplicação automática" nem no Business.
6. Ao ser aceito, o insight grava em `brand_brain_profiles.learned_preferences` — **único mecanismo de aplicação** (ver [database.md §4.7](database.md#47-learning_signals--learning_insights)). `applied_to` (`brand_brain`/`trend_engine`/`intelligence_hub`/`asset_engine`) é um rótulo descritivo de qual comportamento futuro o insight pretende influenciar, não um destino de escrita separado — todo Core Engine já carrega o Brand Brain como portão obrigatório (§1.1 / [architecture.md §3.6](architecture.md#36-learning-engine-produto-brand-evolution)) e portanto já vê a preferência atualizada na próxima vez que rodar, qualquer que seja o rótulo.

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

## Fluxo 11 — "Ensine sua Empresa para a IA" (Knowledge Base) ★ novo (revisão 13, Missão 4)

Disponível a qualquer momento após o Provisionamento Inicial (Fluxo 1) — nunca bloqueia nem é bloqueado pela conversa de onboarding. Reutiliza a tabela `knowledge_base_items` já criada na Missão 2 (§4.2).

1. Usuário acessa **"Ensine sua Empresa para a IA"** (KB-1 — Biblioteca de Conhecimento) e vê a lista de itens já cadastrados (documentos, conteúdos passados, FAQs, notas manuais, e também os itens gerados automaticamente pela conversa de onboarding, `source_type = onboarding_conversation`).
2. Usuário aciona **"Adicionar Conhecimento"** (KB-2) e escolhe entre: (a) enviar um arquivo (PDF, DOCX ou TXT — ver limites em [ux-design.md §3.3](ux-design.md#33-ensine-sua-empresa-para-a-ia-kb)); ou (b) escrever uma nota manual diretamente.
3. Para upload de arquivo: o arquivo vai para o Supabase Storage (bucket `knowledge-base`); o texto é extraído **na mesma Server Action**, de forma síncrona (arquitetura §3.2 — decisão deliberada de não usar n8n aqui, mesma lógica de latência do Fluxo 1). Para nota manual, não há arquivo — o texto vai direto para `content_text`.
4. Sistema cria um `knowledge_base_items` com `source_type` (`document`, `past_content`, `faq`, `performance_note` ou `manual_note`, conforme escolha do usuário), `title`, `content_text`, `storage_path` (quando houver arquivo) e `tags` opcionais.
5. Item aparece na Biblioteca de Conhecimento (KB-1); usuário pode abrir o detalhe (KB-3) para editar tags ou remover (soft delete, `deleted_at`).
6. Itens da Knowledge Base entram no contexto do Brand Brain e do Intelligence Hub (Fluxo 10, passo 2) por **recência + filtro de `tags`/`source_type`** — sem embeddings/retrieval semântico nesta versão (decisão registrada em [architecture.md §10, item 3](architecture.md#10-decisões-em-aberto-arquitetura), aguardando confirmação do dono do produto antes do código desta missão).

## Fluxo 13 — Pipeline de Geração de Vídeo (n8n) ★ novo (Missão 9)

Sub-fluxo acionado pelo Fluxo 3, §3.2, sempre que uma `content_piece` de formato `video` tem `production_mode = licensed_stock_video` (**Etapa 1** — único modo implementado nesta fase; `ai_avatar`/`hybrid` ficam para a Etapa 2, futura, reaproveitando este mesmo fluxo com um branch de Avatar Provider). Primeiro fluxo do produto que é genuinamente assíncrono — todos os anteriores (Fluxos 1–11) rodam de ponta a ponta dentro de uma única Server Action síncrona.

1. A Server Action que dispara a geração da peça verifica o portão de crédito (`ensureSufficientCredits(organizationId, "video_generation", tier)` — Fluxo 6), marca `content_pieces.status = generating`, cria uma linha em `pipeline_runs` (`engine = 'asset_engine'`, `entity_type = 'content_piece'`, `status = queued`) e dispara o workflow do n8n via webhook autenticado (segredo compartilhado, mesmo padrão de [architecture.md §9.1](architecture.md#91-buckets-de-supabase-storage-★-novo-revisão-5)) — devolvendo controle à UI imediatamente, sem esperar o vídeo ficar pronto.
2. O n8n grava seu `execution_id` de volta em `pipeline_runs.n8n_execution_id` (usado para correlacionar o callback de conclusão) e `status = running`.
3. O n8n sequencia, via Provider Gateway (nunca lógica de fornecedor dentro do próprio workflow — [architecture.md §8](architecture.md#8-papel-do-n8n)), atualizando `pipeline_runs.stage`/`progress_percent`/`estimated_remaining_seconds` a cada passo (★ Missão 11 — [architecture.md §14.9](architecture.md#149-progresso-granular-★-percentual--tempo-estimado)): **seleção de voz** (`stage = selecting_voice`, só na 1ª geração da marca — Asset Engine escolhe do catálogo curado via LLM Provider e grava em `brand_brain_profiles.default_voice_ref`, [architecture.md §14.3](architecture.md#143-narração--seleção-automática-de-voz-por-marca-★-ajuste-do-dono-do-produto)); **narração** (`stage = narrating`, Voice Provider = ElevenLabs — `synthesizeVoice`, gera áudio com a voz da marca, sem marcação de legenda — legenda removida, [architecture.md §14.2](architecture.md#142-legendas-removidas-do-vídeo-ajuste-do-dono-do-produto)); **segmentação do roteiro + cenas** (`stage = selecting_scenes`, um passo novo via LLM Provider quebra o roteiro em trechos com termo de busca próprio, Media Provider = Pexels busca uma vez por trecho, evitando repetir candidato — [architecture.md §14.7](architecture.md#147-seleção-de-cenas-por-trecho-do-roteiro-★-ajuste-do-dono-do-produto)); **composição final** (`stage = rendering` → `applying_branding`, Video Render Provider = Shotstack — `composeVideo`, cenas + narração + identidade visual da marca, layout adaptativo quando não há logo — [architecture.md §14.8](architecture.md#148-branding-adaptativo-★-ajuste-do-dono-do-produto) → MP4 vertical 9:16); e finalização (`stage = finalizing`).
4. Se qualquer etapa falha de forma definitiva (sem sucesso após as retentativas do próprio n8n), o pipeline chama o webhook de conclusão da aplicação com um status de falha — nunca deixa a peça presa em `generating` indefinidamente.
5. Ao concluir (sucesso ou falha), o n8n chama um webhook autenticado da aplicação (`apps/web/app/api/webhooks/n8n/route.ts`, novo — mesmo princípio de validação de assinatura já usado para o webhook do Mercado Pago, [architecture.md §12.2](architecture.md#122-integração-com-o-mercado-pago)):
   - **Sucesso:** vídeo final baixado e gravado no bucket `content-output`; nova `content_versions` criada (`output_storage_path`, `generation_metadata` com `voice_provider_key`/`media_provider_key`/`video_render_provider_key` — Etapa 1; `avatar_provider_key` só passa a ser gravado quando a Etapa 2 existir); `content_pieces.status = ready_for_review`; `pipeline_runs.status = completed`, `finished_at` preenchido.
   - **Falha:** `content_pieces.status = failed`; `pipeline_runs.status = failed`, `error` preenchido com a etapa/motivo; nenhuma `content_versions` nova é criada.
6. **Cobrança de crédito só acontece no passo 5, em caso de sucesso** — o webhook chama `recordConsumption`, gravando um lançamento `consumption` em `credit_ledger` vinculado a `related_pipeline_run_id` (idempotente: uma segunda entrega do mesmo webhook falha por constraint em vez de debitar duas vezes — [database.md §7.2](database.md#72-credit_ledger)). Mesmo princípio já usado em todo o resto do produto (Fluxo 6): nunca cobrar uma operação que falhou.
7. A UI reflete o progresso via Supabase Realtime ou polling (a decidir na fase de UX) — primeira vez que o produto depende disso de fato; até aqui, toda tela refletia o resultado direto de uma Server Action síncrona.
8. Uma peça `failed` pode ser reenviada para o pipeline (nova tentativa, repetindo os passos 1–6) — mecanismo exato de acionamento pela UI é decisão de UX (ver [ux-design.md](ux-design.md)), mas não abre uma nova cobrança até um novo sucesso.

## Fluxo 14 — Enviar Feedback ★ novo (preparação Missão 10)

Utilitário transversal (arch. §13) — disponível em qualquer tela autenticada, não amarrado a nenhuma campanha/peça/sessão específica.

1. Usuário clica em **"Enviar feedback"**, sempre visível no layout autenticado (mesmo lugar em qualquer tela).
2. Modal simples abre: categoria (**Sugestão** / **Bug** / **Dificuldade de uso** / **Outro**) + descrição em texto livre.
3. Usuário escreve e clica em enviar. Client captura a rota atual (`pathname`) e envia junto à Server Action, que grava uma linha em `user_feedback` (`organization_id`/`user_id` da sessão atual, categoria, descrição, `pathname`, `app_version` e `user_agent` capturados no servidor — arch. §13.1.1 — `created_at`).
4. Modal fecha com uma confirmação simples (toast) — sem redirecionamento, sem interromper o que o usuário estava fazendo na tela de origem.
5. **Sem consumo de crédito** — não é uma geração de IA, não passa pelo portão de crédito (Fluxo 6).
6. **Sem leitura pela aplicação nesta missão** — nenhuma tela exibe feedback já enviado, nem para quem enviou, nem para admin (PRD §9.3). Consulta é direta no banco quando necessária.

## Fluxo 15 — Gerar Mídia Visual Automaticamente ★ novo (preparação Missão 11)

Sub-fluxo acionado pelo Fluxo 3, §3.2, sempre que uma `content_piece` de formato `stories`/`carousel`/`thumbnail` tem `production_mode = licensed_stock_photo` ([architecture.md §14.4](architecture.md#144-composição-visual-real-storiescarouselthumbnail-★-ajuste-do-dono-do-produto)) — mesmo desenho assíncrono do Fluxo 13, reaproveitado para saída de imagem em vez de vídeo. **Composição real, não uma foto crua** — o resultado é uma arte pronta (branding + tipografia + título + layout), nunca só uma fotografia de banco com uma logo colada em cima. **Upload manual continua disponível como alternativa a qualquer momento**, mesmo depois de uma geração automática (decisão do dono do produto) — ao contrário do vídeo, esta peça nunca perde a opção de upload.

1. A Server Action que dispara a geração verifica o portão de crédito (`ensureSufficientCredits(organizationId, "image_generation", tier)` — Fluxo 6, uma checagem por candidato quando múltiplos candidatos são gerados na rodada, [architecture.md §14.4.2](architecture.md#1442-múltiplas-opções-por-peça-★-ajuste-do-dono-do-produto)), marca `content_pieces.status = generating`, cria uma linha em `pipeline_runs` (`engine = 'asset_engine'`, `entity_type = 'content_piece'`, `status = queued`) e dispara o mesmo workflow do n8n (branch por formato) via webhook autenticado — devolvendo controle à UI imediatamente.
2. Se a campanha ainda não tem `campaigns.visual_brief` resolvido ([architecture.md §14.4.3](architecture.md#1443-identidade-visual-consistente-entre-peças-da-mesma-campanha-★-ajuste-do-dono-do-produto)), o n8n resolve (cor de destaque, redação do título curto, variante de layout) e grava antes de compor — peças/candidatos seguintes da mesma campanha reaproveitam, nunca recalculam.
3. O n8n sequencia, via Provider Gateway, atualizando `pipeline_runs.stage`/`progress_percent`/`estimated_remaining_seconds` a cada passo: **busca de foto(s)** (`stage = selecting_photos`, Media Provider = Pexels Photos — tema derivado do contexto da campanha/marca; busca candidatos suficientes para o número de opções da rodada); para `thumbnail`, **título curto** (`stage = generating`, do `visual_brief` da campanha — [architecture.md §14.5](architecture.md#145-thumbnail-inteligente-★-parecer-feita-por-um-designer)); **composição** (`stage = rendering` → `applying_branding`, Video Render Provider = Shotstack — timeline em camadas, `output: jpg/png`, [architecture.md §14.4.1](architecture.md#1441-análise-arquitetural--mecanismo-de-composição-★-exigido-pelo-dono-do-produto-antes-do-código) — 1 render por candidato/opção da rodada) + logo (layout adaptativo quando ausente, [architecture.md §14.8](architecture.md#148-branding-adaptativo-★-ajuste-do-dono-do-produto)); e finalização (`stage = finalizing`).
4. Ao concluir (sucesso ou falha), o mesmo webhook de conclusão do Fluxo 13 (passo 5) atualiza `content_versions`/`content_pieces`/`pipeline_runs` — mesmas regras de sucesso/falha, mesma cobrança só após sucesso (`recordConsumption`, `image_generation`, uma vez por candidato gerado). Quando mais de 1 candidato é gerado, cada um vira uma `content_versions` própria — a peça fica `ready_for_review` mostrando todos os candidatos, sem nenhum ainda marcado como `selected_version_id`.
5. Usuário escolhe um candidato (quando houve mais de 1) — `content_pieces.selected_version_id` é preenchido com a escolha, essa é a versão usada no pacote final (Fluxo 5).
6. Peça já gerada automaticamente pode, a qualquer momento, ser substituída por upload manual (ou vice-versa) — sem restrição de ordem, sempre a última ação do usuário prevalece como versão atual.

## Fluxo 16 — Impersonação e Ações Administrativas ★ novo (preparação Missão 12, ajustado na aprovação)

Sub-fluxo restrito a `platform_admin` — `super_admin` ou `support_admin` ([architecture.md §15](architecture.md#15-super-admin--plataforma-administrativa-★-missão-12)), acessado pelo menu administrativo dedicado ([ux-design.md §2](ux-design.md#2-arquitetura-de-informação-navegação)). Impersonação é disponível para os 2 papéis; ações administrativas exclusivas (editar planos/providers, excluir organização, criar admins) exigem `super_admin` — matriz completa em [architecture.md §15.1.1](architecture.md#1511-matriz-de-capacidades).

**Entrar como organização (impersonação):**
1. Na tela Organizações, o admin (qualquer papel) clica "Entrar como organização" numa linha da lista.
2. Server Action revalida `is_platform_admin()` no servidor (nunca confia em estado de UI) e seta o cookie `httpOnly` `impersonating_organization_id`.
3. Toda tela do produto (não administrativa) passa a mostrar uma **barra fixa no topo, sem botão de fechar/ocultar** (★ ajuste do dono do produto — round 2): "Você está visualizando como: [Organização]" + botão "Sair da impersonação" — e opera com o contexto daquela organização (`getCurrentSession()`, [architecture.md §15.4](architecture.md#154-impersonação-entrar-como-organização)), como se o admin fosse membro dela.
4. Qualquer geração/consumo feito nesse estado **não debita a organização visitada** (Fluxo 6, passo 1, bypass de `platform_admin`) — a organização nunca vê cobrança pela sessão de suporte, independente de qual papel está agindo.
5. "Sair da impersonação" limpa o cookie e retorna ao contexto normal do admin (organização "casa" ou telas administrativas).

**Ação administrativa (ex.: editar organização, ajustar crédito):**
1. Server Action chama `requirePlatformAdmin()` primeiro — qualquer falha aqui interrompe antes de tocar em qualquer dado ([architecture.md §15.9](architecture.md#159-segurança--requireplatformadmin--requiresuperadmin)); ações exclusivas (§15.1.1) chamam `requireSuperAdmin()` também.
2. Lê o estado atual da entidade (para o `before` do passo 4).
3. Aplica a mudança (service role — a maioria das tabelas tocadas não tem policy de escrita para `authenticated`).
4. Grava uma linha em `admin_audit_logs` — ator, **papel do ator no momento da ação**, ação, entidade, `before`/`after`, IP, User-Agent ([architecture.md §15.6](architecture.md#156-auditoria-administrativa--admin_audit_logs)) — sempre, mesmo quando a mudança é trivial (ex.: `status` de um único campo).

---

## Convenções de Status (resumo)

| Entidade | Status possíveis |
|---|---|
| `trend_research` | `pending` → `completed` / `failed` |
| `intelligence_hub_sessions` | `running` → `completed` / `failed` |
| `campaigns` | `draft` → `generating` → `ready_for_review` → `approved` → `package_ready` (ou `failed`) |
| `content_pieces` | `draft` → `generating` → `ready_for_review` → `approved`/`rejected` (formato `video` com pipeline assíncrono, ★ preparação Missão 9: `generating` → `ready_for_review` ou `failed`) |
| `pipeline_runs` (★ ativada na preparação da Missão 9) | `queued` → `running` → `completed`/`failed` |
| `content_packages` | `building` → `ready` / `failed` |
| `learning_insights` | `pending_review` → `applied` / `dismissed` |
| `provider_configs` | `active` / `inactive` / `error` / `maintenance` ★ novo (Missão 12) |
| `user_feedback` ★ novo (Missão 12) | `open` → `resolved` |

## Decisões em Aberto (fluxos)

1. Regeneração parcial: ao rejeitar 1 peça, a campanha inteira volta para `generating` ou só aquela peça? (proposta: só a peça — confirmar).
2. Notificações: e-mail, in-app, ou ambos?
3. Agendamento de campanhas recorrentes automáticas é MVP ou backlog?
4. Periodicidade/gatilho exato do Fluxo 8.
5. Mecanismo de captura de `engagement_metric` no Fluxo 5 (passo 4), dado que não há integração de publicação automática no MVP — provavelmente entrada manual do usuário ou upload de métrica.
6. **★ novo (preparação Missão 9):** mecanismo exato pelo qual o usuário aciona uma nova tentativa quando uma peça de vídeo fica `failed` (Fluxo 13, passo 8) — botão explícito "Tentar novamente" na tela de revisão (mais provável, mesmo padrão de "Regenerar" já usado para texto), ou reaproveita a ação de aprovação/edição existente? Não bloqueia o início do código — comportamento razoável por default é um botão dedicado, a confirmar no doc-first de UX.
7. **★ novo (preparação Missão 9):** UI durante a geração assíncrona de vídeo (Fluxo 13) usa Supabase Realtime ou polling? Decisão de UX pendente, registrada aqui e em [ux-design.md](ux-design.md) — não bloqueia o início do código do pipeline em si, mas bloqueia a tela de acompanhamento de progresso.
