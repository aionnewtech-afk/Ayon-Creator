# UX Design — Ayon Creator

> **Status:** v1.3 (revisão 20 — preparação doc-first da Missão 8, Learning Engine) — **aguardando confirmação final do dono do produto antes do código**
> **Última atualização:** 2026-08-03
> **Mudança desta revisão (20 — preparação Missão 8, Learning Engine):** §3.8 (EVOL) consolidada — EVOL-2 (detalhe) removida do MVP e EVOL-3 (histórico) vira uma seção/aba dentro da EVOL-1, mesmo raciocínio de simplificação já usado em CAMP-4/5/6 (Missão 7). Novos estados-chave: "sinal insuficiente" (menos de 5 `learning_signals` novos) e "analisando" (ação "Buscar novidades"). Referências a EVOL-2/EVOL-3 em §4.3, §6 e Jornada 4 corrigidas para refletir a tela única. Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (19 — Missão 7 implementada e validada):** CAMP-4/5/6 implementadas como uma única tela (`ContentPackageReview`, dentro de `/criar-campanha`) e validadas em produção — Cartão de Revisão de Peça (§4.6) diferenciando texto (aprovar/editar/regenerar) de visual (aprovar/enviar arquivo) confirmado; estado final "Pacote pronto" com link de download (signed URL) confirmado assim que a última peça é aprovada, sem Realtime.
> **Mudança desta revisão (18 — preparação Missão 7, Asset Engine):** §3.5 (CAMP-4/5/6) ajustada ao escopo do MVP — texto gerado por IA + upload manual para formatos visuais, sem estado "gerando vídeo com avatar". §4.4 corrigida: rastreador de progresso não é mais descrito como "alimentado por Realtime" (decisão do dono do produto: sem Realtime no MVP). §4.5/§4.6 ajustadas para diferenciar geração de texto (aprovar/editar/regenerar) de upload manual de formato visual (aprovar/enviar arquivo).
> **Mudança desta revisão (17 — correção de auditoria):** §3.9 (CFG) ganha nota explícita marcando CFG-1/3/5/6 como não implementadas (só CFG-2/4 têm código); §3.6 (HIST) ganha a mesma nota para HIST-1/2. Nenhuma das duas é uma decisão nova — só torna explícito o que já era verdade, corrigindo uma lacuna de sinalização identificada em auditoria anterior (v1.9) e nunca fechada para estes itens.
> **Mudança desta revisão (16 — Missão 6 implementada e validada):** CFG-2 e CFG-4 implementadas como uma única tela (`/configuracoes`) — CFG-1/3/5/6 seguem fora de escopo. Estados de bloqueio (créditos insuficientes/assinatura inativa) confirmados em produção com CTA funcionando em Criar Campanha e O que está em Alta.
> **Mudança desta revisão (15 — preparação Missão 6, Billing):** CFG-2 (Plano e Cobrança) e CFG-4 (Créditos e Uso) detalhadas com os estados reais do Mercado Pago (processando pagamento aguardando webhook, `past_due`, checkout externo). Estado global "Créditos insuficientes" (§5) renomeado para "Créditos insuficientes ou assinatura inativa", cobrindo os dois motivos de bloqueio do portão de crédito (Fluxo 6).
> **Mudança desta revisão (14 — Missão 4 implementada):** KB-1/2/3 implementadas e validadas em produção — upload de PDF/DOCX/TXT, nota manual, edição de tags e remoção, todos confirmados funcionando com Supabase real.
> **Mudança desta revisão (13 — preparação da Missão 4):** §3.3 (KB-1/2/3) detalhado — formatos de arquivo aceitos (PDF/DOCX/TXT, até 10MB), estados de upload/extração, distinção entre item de arquivo (somente leitura) e nota manual, e itens de onboarding tratados como somente leitura nesta tela (edição continua só via Perfil da Marca).
> **Mudança desta revisão (8 — consolidação final antes da Missão 2):** §1.1 ganha os itens 8/11 expandidos e um novo item 12 (nenhum atalho de "geração rápida" pula o Brand Brain); §4.11 (Bloco de Justificativa de Marca) formaliza a affordance nomeada **"Por que fiz assim?"**; §4.1 e §4.2 passam a mencionar explicitamente referência a campanhas/aprendizados anteriores (memória de longo prazo).
> Este documento especifica telas, componentes, estados, navegação, microinterações e jornadas de uso, correspondentes ao escopo de [PRD.md](../PRD.md) e aos fluxos de [flows.md](flows.md). Nenhuma interface é implementada sem que a tela/componente correspondente esteja aqui e aprovado. Toda nova tela nasce daqui, não do código.
> **Fora de escopo deste documento:** sistema visual (paleta de cores, tipografia, tokens, logotipo). Este documento define *o quê* existe e *como se comporta* — o *como se parece visualmente* é uma fase seguinte, deliberadamente adiada (ver §10).
> **Mudança desta revisão (7 — Princípio do Consultor Permanente):** §1 ganha os princípios do [PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7); §3.2 e §4.2 reescritos — a experiência "Conheça sua empresa" deixa de ser uma entrevista com reflexo de bloco e barra de progresso numérica/pontilhada, e passa a ser uma conversa contínua com reação a cada turno, callback obrigatório entre temas e um painel vivo de conhecimento ("O que a Ayon já sabe") no lugar de qualquer indicador de progresso por contagem; novo §4.10 formaliza o painel **"O que a Ayon já sabe"** e novo §4.11 formaliza o **Bloco de Justificativa de Marca**, reutilizado em CAMP-2 (§4.1), CAMP-3, CAMP-5 (§4.6) e TREND-2 — numeração dos componentes existentes (§4.1–§4.9) preservada. Termo "entrevista" removido do corpo vivo do documento.

---

## 1. Princípios de UX

1. **Nunca mostrar jargão técnico.** Todo texto de interface usa a linguagem de negócio definida em [PRD §2](../PRD.md#2-linguagem-motores-internos-vs-produto). Nomes de engines (Brand Brain, Knowledge Base, Trend Engine, Asset Engine, Learning Engine) não aparecem em nenhum rótulo, botão, título de tela ou mensagem de erro.
2. **O Intelligence Hub é exceção deliberada.** Ele não é escondido — é comunicado como o motivo pelo qual o usuário pode confiar na estratégia gerada ("sua campanha foi pensada por uma equipe de especialistas de IA, não por um robô único"). A visualização do painel de especialistas (§4.1) é o momento de maior construção de confiança do produto — deve parecer substancial, não decorativo.
3. **Nenhuma operação de IA longa fica com "spinner cego".** Toda geração assíncrona (conversa "Conheça sua empresa", tendências, estratégia, peças, pacote) mostra o que está acontecendo, com linguagem humana ("Nossos especialistas estão analisando sua marca...", não "Processando...").
4. **Aprovação humana é sempre visível, nunca automática nos bastidores.** Isso vale tanto para peças de conteúdo (Fluxo 4) quanto para sugestões do Brand Evolution (Fluxo 8) — a interface nunca aplica nada sem uma ação explícita e reversível do usuário.
5. **Progresso é sempre reversível ou visível.** Rejeitar, editar e desfazer são sempre baratos e claros — o usuário nunca se sente "preso" a uma geração.

### 1.1 Princípio do Consultor Permanente (aplicado à interface) ★ novo (revisão 7)

Tradução direta, em termos de UX, do princípio de produto definido em [PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7) — vale para **toda** tela onde a Ayon fala com o usuário, não só "Conheça sua empresa":

6. **Nunca sensação de formulário, cadastro ou entrevista.** A palavra "entrevista" não existe em nenhum texto de interface. Nenhuma tela deve fazer o usuário sentir que está "preenchendo" algo — mesmo telas objetivamente estruturadas (ex: Perfil da Marca, ONB-4) se apresentam como o que a Ayon já sabe, editável, não como um cadastro.
7. **Reação antes da próxima pergunta, sempre.** Toda resposta do usuário na conversa "Conheça sua empresa" é seguida por uma observação, hipótese ou provocação inteligente da Ayon — nunca por uma pergunta "fria" enfileirada (ver §4.2).
8. **Memória de longo prazo, não histórico passivo.** A Ayon reconecta pontos ditos anteriormente — na conversa atual, em campanhas passadas e em aprendizados já aplicados via Brand Evolution — sem que o usuário precise pedir ou repetir. Obrigatório nas transições de tema (§4.2) e nas telas de campanha (ex: Painel de Especialistas citando uma campanha anterior ou algo aprendido no onboarding).
9. **Progresso é conhecimento, nunca contagem.** Nenhuma tela do produto mostra "X de Y perguntas/campos". Onde progresso precisa ser comunicado, ele representa o quanto a Ayon já entende da empresa (ver §4.10, painel "O que a Ayon já sabe").
10. **Encerramento é integração de equipe, não conclusão de tarefa.** Qualquer fluxo que aprofunde o conhecimento da Ayon sobre a marca termina comunicando que ela passou a fazer parte do time, não que "um formulário foi salvo" (ver §4.2, estado `concluído`).
11. **Toda decisão estratégica importante carrega uma justificativa consultável.** Estratégias (CAMP-2/3), peças de conteúdo (CAMP-5) e tendências ranqueadas (TREND-2) sempre exibem, junto do resultado, uma explicação em linguagem de negócio de por que aquilo reflete a marca — sempre acessível através do bloco padrão **"Por que fiz assim?"** (ver §4.11, Bloco de Justificativa de Marca) — nunca um resultado "mudo".
12. **Nenhuma tela oferece geração de conteúdo sem contexto de marca.** Não existe, em lugar nenhum da interface, um atalho de "gerar rápido" que produza campanha, roteiro, vídeo, imagem, carrossel ou e-mail sem antes passar pelo Brand Brain — mesmo em telas futuras de produtividade avançada.

## 2. Arquitetura de Informação (Navegação)

### 2.1 Mapa de navegação (sitemap)

```
Ayon Creator
├── Painel (Home)
├── Criar Campanha  ────────────────► fluxo guiado (não é uma "tela", é uma sequência — ver §7, Jornada 2)
├── Conheça sua Empresa
│   ├── Conversa com o Consultor (chat)
│   └── Perfil da Marca (resumo editável)
├── Ensine sua Empresa para a IA
│   ├── Biblioteca de Conhecimento
│   └── Adicionar Conhecimento
├── O que está em Alta
│   └── Detalhe da Tendência
├── Campanhas
│   └── Detalhe da Campanha (peças, status, pacote)
├── Biblioteca de Mídia
├── O que Funcionou
│   ├── Sugestões Pendentes
│   └── Histórico de Sugestões
└── Configurações
    ├── Perfil da Conta / Organização
    ├── Marcas (multi-marca — plano Business)
    ├── Time e Permissões (plano Business)
    ├── Plano e Cobrança
    ├── Nível de Qualidade (tier)
    └── Créditos e Uso
```

### 2.2 Navegação primária (sidebar, desktop)

| Item de menu | Tela/fluxo associado | Engine interno | Visível para |
|---|---|---|---|
| Painel | Home/Dashboard | — (agregador) | Todos |
| Criar Campanha | Fluxo guiado E1–E6 (§3.5) | Trend Engine + Intelligence Hub + Asset Engine | Todos (editor+) |
| Conheça sua Empresa | Conversa com o Consultor + Perfil da Marca | Brand Brain | Todos (admin+ edita, demais visualizam) |
| Ensine sua Empresa para a IA | Biblioteca de Conhecimento | Knowledge Base | Todos (editor+) |
| O que está em Alta | Lista de Tendências | Trend Engine | Todos |
| Campanhas | Histórico de Campanhas | Asset Engine | Todos |
| Biblioteca de Mídia | Mídia própria da marca | (dado interno) | Todos (editor+) |
| O que Funcionou | Sugestões Brand Evolution | Learning Engine | Admin/Owner (decide aplicar) |
| Configurações | Conta, plano, tier, créditos, marcas, time | — | Varia por sub-item e papel |

### 2.3 Navegação secundária/contextual

- **Seletor de Marca** (topo, sempre visível quando a organização tem mais de uma marca — plano Business): troca o contexto inteiro da aplicação; nunca aparece para organizações com uma única marca.
- **Barra de contexto de campanha**: dentro do fluxo "Criar Campanha" e no detalhe de uma campanha existente, uma barra fixa mostra a etapa atual (Estratégia → Gerando → Revisão → Pacote pronto).
- **Central de notificações** (ícone de sino no topo): agrega eventos assíncronos (estratégia pronta, peça pronta, pacote pronto, nova sugestão em "O que Funcionou").

### 2.4 Visibilidade por papel e plano

- `viewer`: navega e visualiza, não aciona gerações nem aprova.
- `editor`: cria campanhas, ensina a IA, revisa/aprova peças.
- `admin`/`owner`: tudo do editor + decide sugestões do Brand Evolution, gerencia plano/créditos/tier, convida time e marcas (Business).
- Itens "Marcas" e "Time e Permissões" só aparecem no plano Business.

## 3. Inventário de Telas

Cada tela é referenciada por um ID curto, usado também em §5–§7. Estados listados são os que se aplicam além do padrão "sucesso" (ver §5 para a definição de cada estado).

### 3.1 Autenticação (`AUTH`)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| AUTH-1 | Login | Autenticar usuário existente | erro de credencial, carregando | Link direto / logout | Painel |
| AUTH-2 | Cadastro | Criar conta + organização | erro de validação, e-mail já existe | Landing/convite | AUTH-3 |
| AUTH-3 | Criar primeira marca | Nome + nicho da marca (mínimo indispensável) | carregando | AUTH-2 | ONB-1 |
| AUTH-4 | Recuperar senha | Reset de senha | e-mail enviado, erro | AUTH-1 | AUTH-1 |

> Propositalmente mínimo: a AUTH-3 não pede identidade de marca (tom, público etc.) — isso é função da conversa com a Ayon (ONB), não do cadastro.

### 3.2 Conheça sua Empresa (`ONB`)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| ONB-1 | Convite para a conversa | Preparar o usuário para conversar com a Ayon (o que esperar, quanto tempo leva) — nunca "vamos fazer algumas perguntas" | — | AUTH-3 / menu "Conheça sua Empresa" | ONB-2 |
| ONB-2 | Conversa com o Consultor | Conduzir a conversa que popula o Brand Brain, com reação, memória e justificativa a cada turno (§4.2 detalha o componente) | ia_digitando, aguardando_usuario, refletindo (fim de tema, com callback obrigatório), retomando conversa, sintetizando | ONB-1 | ONB-3 |
| ONB-3 | O que a Ayon entendeu até agora | Apresentar a síntese da conversa para confirmação — enquadrada como checagem de um consultor, não revisão de formulário | sintetizando, editando campo individual | ONB-2 | Painel / KB-1 |
| ONB-4 | Perfil da Marca | Visão persistente e editável da identidade (história, produtos, clientes, tom, concorrentes, objetivos, diferenciais, palavras proibidas/favoritas) | editando, salvo | Menu "Conheça sua Empresa" a qualquer momento | — |

> Nenhuma tela desta área usa a palavra "entrevista" ou comunica progresso por contagem de perguntas/campos — ver Princípio do Consultor Permanente (§1.1).

### 3.3 Ensine sua Empresa para a IA (`KB`) ★ detalhado (revisão 13, Missão 4)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| KB-1 | Biblioteca de Conhecimento | Listar documentos, conteúdos passados, FAQs, notas | vazio (primeira vez, com CTA "Adicionar Conhecimento" — nunca tela em branco), carregando | Menu / ONB-3 | KB-2, KB-3 |
| KB-2 | Adicionar Conhecimento | Upload de arquivo ou nota manual, com tags | escolhendo tipo (arquivo vs. nota), enviando/extraindo texto, erro de formato/tamanho, sucesso | KB-1 | KB-1 |
| KB-3 | Detalhe do item | Visualizar/editar tags, remover item | editando tags, confirmando remoção | KB-1 | KB-1 |

**KB-1 — Biblioteca de Conhecimento:** cada item mostra título, `source_type` traduzido para linguagem de negócio (ex.: "Documento", "Conteúdo antigo", "Pergunta frequente", "Nota", "Conversa com a Ayon" para os itens de `onboarding_conversation`), tags e data. Itens vindos da conversa de onboarding são **somente leitura** aqui (editáveis apenas via edição do Perfil da Marca, ONB-4) — evita duplicar a mesma superfície de edição em dois lugares.

**KB-2 — Adicionar Conhecimento:**
- Duas entradas: "Enviar um arquivo" ou "Escrever uma nota".
- Arquivo: aceita PDF, DOCX ou TXT, até 10MB. Erro de formato/tamanho é específico ("Esse arquivo é maior que 10MB — tenta um resumo ou divide em partes?"), nunca um erro genérico.
- Nota manual: campo de texto livre + título opcional (se vazio, primeiras palavras viram o título).
- Ambos os caminhos pedem `source_type` (documento, conteúdo antigo, FAQ, nota) e tags opcionais antes de salvar.
- Estado "enviando/extraindo texto" é sempre visível para arquivo (a extração acontece de forma síncrona, arquitetura §3.2) — nunca um upload que trava sem feedback.

**KB-3 — Detalhe do item:** mostra o `content_text` extraído (somente leitura para itens de arquivo — se a extração ficou ruim, o caminho é remover e reenviar, não editar o texto extraído diretamente), tags editáveis, e remoção (soft delete) com confirmação.

### 3.4 O que está em Alta (`TREND`)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| TREND-1 | Lista de Tendências | Mostrar tendências ranqueadas para a marca | carregando (buscando tendências), vazio, erro parcial | Menu / Painel | TREND-2, CAMP-1 |
| TREND-2 | Detalhe da Tendência | Contexto de por que a tendência foi ranqueada assim para esta marca, especificamente — explicação ancorada no Brand Brain, não genérica (Bloco de Justificativa de Marca, §4.11) | — | TREND-1 | CAMP-1 |

### 3.5 Criar Campanha (`CAMP`) — fluxo guiado

**Escopo da Missão 7 (MVP, [flows.md Fluxo 3](flows.md#fluxo-3--criar-campanha-geração-do-pacote-de-conteúdo-asset-engine)):** CAMP-4/5/6 cobrem só formatos `text_only` (gerados por IA) e `own_media` (upload manual do cliente) — sem estado "gerando vídeo com avatar", sem barra de progresso em tempo real via Realtime (decisão do dono do produto: sem Realtime no MVP). CAMP-1/2/3 já implementadas desde a Missão 3, sem mudança.

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| CAMP-1 | Ponto de partida | Escolher a tendência (ou iniciar tema livre — ver decisão em aberto §10) | — | TREND-1/2, Painel, "Criar Campanha" no menu | CAMP-2 |
| CAMP-2 | Painel de Especialistas (Intelligence Hub) | Visualizar a estratégia sendo formada — momento de maior confiança do produto (§4.1) | especialistas analisando, um especialista falhou (parcial), consolidando | CAMP-1 | CAMP-3 |
| CAMP-3 | Revisão da Estratégia | Mostrar temas, formatos previstos, calendário sugerido, cada um com "Por que sugerimos isso" (§4.11); aprovar ou pedir ajuste | ajustando, aprovado | CAMP-2 | CAMP-4 |
| CAMP-4 | Gerando Pacote | Checklist de formatos: texto sendo gerado por IA (sequencial, Server Action síncrona) e formatos visuais aguardando upload do cliente | gerando (formato textual), aguardando upload (formato visual), erro em um formato | CAMP-3 | CAMP-5 |
| CAMP-5 | Revisão e Aprovação | Revisar cada peça de texto (aprovar/editar/rejeitar/regenerar) ou enviar o arquivo de cada peça visual | aguardando aprovação, editando, regenerando (texto), aguardando upload (visual) | CAMP-4 | CAMP-5 (loop) → CAMP-6 |
| CAMP-6 | Pacote Pronto | Confirmar conclusão e oferecer download | montando pacote, pronto | CAMP-5 | HIST-2, download |

### 3.6 Campanhas (`HIST`)

**Estado de implementação:** especificadas abaixo, sem código correspondente — `campaigns` já existe e é escrita pelo fluxo de Criar Campanha (Missão 3) desde já, mas não há tela de listagem/detalhe; nav item `campanhas` marcado `implemented: false` (`apps/web/config/navigation.ts`).

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| HIST-1 | Lista de Campanhas | Histórico com status de cada campanha | vazio (primeira campanha ainda não criada) | Menu | HIST-2 |
| HIST-2 | Detalhe da Campanha | Ver estratégia, peças, pacote de uma campanha específica (concluída ou em andamento) | retoma no ponto exato do fluxo CAMP se incompleta | HIST-1 | CAMP-* (retomada) |

### 3.7 Biblioteca de Mídia (`MEDIA`)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| MEDIA-1 | Galeria de Mídia | Grid de imagens/vídeos/áudios próprios da marca, com tags | vazio, carregando | Menu | MEDIA-2 |
| MEDIA-2 | Upload de Mídia | Enviar novo arquivo + tags | enviando, erro | MEDIA-1 | MEDIA-1 |

### 3.8 O que Funcionou (`EVOL`)

**Escopo do MVP aprovado pelo dono do produto (preparação Missão 8):** EVOL-1 e EVOL-2 consolidadas numa única tela — o Cartão de Sugestão (§4.3) já carrega o texto completo do insight, então uma tela de detalhe separada seria um clique extra sem informação nova (mesmo raciocínio de simplificação já aplicado a CAMP-4/5/6 na Missão 7, que viraram uma única tela `ContentPackageReview`). EVOL-3 (histórico) permanece como uma seção/aba dentro da mesma tela, não uma rota própria.

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| EVOL-1 | Sugestões Pendentes + Histórico | Lista de cards de sugestões aguardando decisão (§4.3), com aceitar/descartar inline; seção/aba de histórico (aceitas/descartadas, com data e quem decidiu) na mesma tela | **sinal insuficiente** (menos de 5 `learning_signals` novos — mostra quantos faltam), **vazio** ("ainda não há sugestões — continue aprovando campanhas"), **analisando** (ação "Buscar novidades" em andamento), nova sugestão chegando, aplicando decisão | Menu, notificação | — |

~~EVOL-2 | Detalhe da Sugestão~~ **Removida do MVP** — decisão consolidada acima. ~~EVOL-3 | Histórico de Sugestões~~ **Consolidada na EVOL-1 acima** (seção/aba, não rota própria).

### 3.9 Configurações (`CFG`)

**Estado de implementação (revisão 16, Missão 6):** CFG-2 e CFG-4 implementadas juntas, numa única tela (`/configuracoes`). **CFG-1, CFG-3, CFG-5 e CFG-6 seguem apenas especificadas abaixo, sem código correspondente** — mesma lacuna já identificada em `docs/changelog.md` v1.9 (revisão 16, pré-Missão 5) e nunca resolvida para estes 4 itens.

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| CFG-1 | Perfil da Conta/Organização | Dados da organização, usuário logado | — | Menu | — |
| CFG-2 | Plano e Cobrança **(implementada)** | Ver/alterar plano (Starter/Pro/Business), status da assinatura | processando pagamento (aguardando webhook do Mercado Pago — Fluxo 12), assinatura ativa, `past_due` (pagamento falhou, CTA para atualizar no Mercado Pago), `canceled` | Menu | Checkout externo do Mercado Pago (Preapproval) |
| CFG-3 | Nível de Qualidade (tier) | Escolher Econômico/Balanceado/Premium — **nunca menciona fornecedor** | — | Menu, CFG-2 | — |
| CFG-4 | Créditos e Uso **(implementada)** | Saldo (`SUM(credit_ledger.amount)`), histórico de lançamentos (`grant_plan`/`purchase`/`consumption`), comprar créditos avulsos (`credit_packages`) | créditos baixos (aviso), sem saldo (bloqueio), processando compra (aguardando webhook) | Menu, aviso de bloqueio em CAMP-4 (Fluxo 6, passo 2) | Checkout externo do Mercado Pago (Checkout Pro) |
| CFG-5 | Marcas (Business) | Listar/criar marcas da organização | — | Menu | Seletor de marca |
| CFG-6 | Time e Permissões (Business) | Convidar usuários, definir papel por marca | convite pendente | Menu | — |

### 3.10 Globais (`GLOBAL`)

| ID | Elemento | Objetivo |
|---|---|---|
| GLOBAL-1 | Central de Notificações | Lista de eventos assíncronos recentes, com deep link para a tela relevante |
| GLOBAL-2 | Seletor de Marca | Troca de contexto entre marcas (Business) |
| GLOBAL-3 | Painel (Home) | Atalhos para "Criar Campanha", tendências recentes, sugestões pendentes, status de campanhas em andamento |

## 4. Componentes

### 4.1 Painel de Especialistas (Intelligence Hub) — componente-assinatura

O componente mais importante do produto: transforma o Intelligence Hub (arquitetura) em confiança percebida (produto).

**Comportamento:**
1. Ao entrar em CAMP-2, os papéis retornados pelo Specialist Registry ([architecture.md §4.1](architecture.md#41-specialist-registry-especialistas-plugáveis-★-novo-revisão-10)) aparecem como cartões/ícones distintos, usando o `name` de negócio de cada especialista (ex.: "Marketing", "Copy", "Marca", "Especialista do seu Setor", "SEO", "Redes Sociais", "Dados") — nunca a `key` técnica cru.
2. Cada cartão transita por três estados visuais: **aguardando → analisando → opinião pronta** (com um resumo de 1 linha da opinião, não o texto bruto).
3. Quando todos concluem (ou o tempo/retry limite é atingido — ver Fluxo 10, passo 7), uma animação de "convergência" leva as 7 opiniões a um único cartão final: a estratégia consolidada (Coordinator AI), com uma frase de transição tipo "Consolidando em uma estratégia única...".
4. Se um especialista falha, seu cartão mostra um estado neutro ("não conseguiu opinar desta vez") sem bloquear os demais nem assustar o usuário com "erro".
5. **Memória de longo prazo (§1.1, item 8):** quando relevante, a opinião de um especialista ou a estratégia consolidada cita explicitamente uma campanha anterior ou um aprendizado já aplicado (ex: "a última campanha de vídeos curtos teve boa aprovação — mantivemos esse formato aqui") — nunca trata a marca como se essa fosse a primeira campanha.

**Variantes de uso:** versão completa (CAMP-2, estratégia de campanha) e versão compacta (quando uma peça principal aciona uma nova sessão — ver Fluxo 3.1 — pode usar uma versão reduzida/mais rápida do mesmo componente).

**Justificativa (§4.11):** o resumo de 1 linha de cada opinião e a estratégia consolidada final já cumprem o papel de Bloco de Justificativa de Marca — ambos citam explicitamente o que vêm do Brand Brain (`opinion.rationale`/`consolidated_result.rationale`), nunca apenas a recomendação.

### 4.2 Conversa com o Consultor (Onboarding Conversacional)

Não é um chat de perguntas e respostas — é a primeira aparição da Ayon como consultora permanente (Princípio do Consultor Permanente, §1.1). Cobre os mesmos 9 dados estruturados do PRD §4.5 (história, produtos, clientes, tom de voz, concorrentes, objetivos, diferenciais, palavras proibidas, palavras favoritas), organizados em 5 temas — mas o usuário nunca vê "temas" nem "blocos": só vive a conversa fluindo de um assunto a outro.

**Temas (organização interna, nunca exposta como etapas na UI):**
1. Sobre a empresa (história + produtos)
2. Clientes
3. Concorrência + diferenciais
4. Objetivos
5. Tom de voz + palavras

**Bolhas de conversa** (Ayon à esquerda, usuário à direita), indicador de digitação da Ayon (3 pontos pulsando, 800ms–1.5s — nunca instantâneo).

**Regra de ouro — reação antes de seguir (todo turno, sem exceção):** cada resposta do usuário dispara duas camadas, nunca uma só:
- **Micro-reação** (todo turno): uma frase curta que prova compreensão e agrega algo — nunca "ok, próxima pergunta". Varia entre validar, conectar com o que já foi dito, ou trazer uma leitura própria da Ayon. Exemplo real do produto (PRD §1.1): em vez de perguntar "qual é o seu diferencial?", a Ayon diz *"Empresas do seu segmento normalmente competem por preço. Você comentou que o atendimento é muito importante — você acredita que esse é o verdadeiro diferencial da empresa?"*
- **Reflexo de tema** (nas transições, a partir do segundo tema): paráfrase mais completa do tema encerrado + **callback obrigatório** a algo dito em um tema anterior + ponte natural para o próximo tema. Nunca "Agora vamos falar de clientes" cru. Se a Ayon não tiver uma conexão genuína para propor, ela nomeia explicitamente o que já sabe em vez de forçar uma ligação artificial.

**Painel "O que a Ayon já sabe"** (ver §4.10) substitui qualquer barra de progresso — cresce com insights sintetizados, não respostas cruas, e é a única forma de "progresso" visível nesta tela.

**Correção imediata:** ao fim de cada reflexo de tema, o usuário pode confirmar ("Isso mesmo") ou corrigir ("Quase, deixa eu ajustar") — reabre apenas o ponto específico, nunca o tema inteiro.

**Entrada opcional de contexto** (no convite, ONB-1): campo para colar link do site/Instagram — se preenchido, a Ayon chega com "dever de casa feito" e transforma perguntas abertas em confirmações (ex: *"Vi no seu Instagram que vocês postam bastante sobre roteiros na Europa — é o foco principal ou só uma parte do que fazem?"*). Depende de capacidade de leitura externa ainda não modelada em `architecture.md` (ver decisão em aberto §10).

**Resposta "não sei"/"pular" é válida:** a Ayon aceita, marca o campo como pendente sem travar a conversa; aparece depois em ONB-4 com destaque leve, nunca bloqueia.

**Retomada (estado `retomando`):** suporta pausar e retomar a qualquer momento sem perder contexto. Nunca "paramos na pergunta 4 de 9" — a Ayon recapitula citando algo específico já dito: *"Da última vez você me contou que a [Empresa] ganha no atendimento, não no preço — isso ficou na minha cabeça. Vamos continuar por aí?"*

**Encerramento (estado `sintetizando` → ONB-3):** transição com 2–3 frases sequenciais ("Formando minha visão sobre a [Empresa]...") — nunca spinner isolado. Ao chegar em ONB-3, o cabeçalho é "O que a Ayon entendeu até agora" (nunca "seu perfil de marca"), com subtítulo "Me corrija se eu peguei algo errado — quero começar com o pé direito." Cada campo mostra a leitura da Ayon + a citação original do usuário como lastro. Botão de confirmação: **"Isso mesmo, pode seguir"** (nunca "Confirmar perfil"). Só depois dessa confirmação a Ayon fecha com a mensagem de integração: *"A partir de agora eu penso na [Empresa] como parte do que eu faço — toda campanha que eu ajudar a criar vai passar por esse entendimento. E isso não precisa parar aqui: sempre que você quiser me contar mais, a conversa continua em 'Ensine sua empresa pra IA'."* CTA primário: "Vamos criar sua primeira campanha"; secundário: "Ver o que aprendi, com calma".

### 4.3 Cartão de Sugestão (Brand Evolution / "O que Funcionou")

- Frase em linguagem simples e específica (nunca genérica) — ex.: "Percebemos que vídeos de até 35 segundos performam melhor. Deseja atualizar sua estratégia?"
- Duas ações de mesmo peso visual: **Aceitar** e **Descartar** (nunca um "aceitar" pré-marcado ou destacado de forma a induzir aceite automático).
- Ao aceitar: pequena confirmação positiva (não intrusiva) + o card migra da lista de pendentes para a seção de Histórico, na mesma tela (EVOL-1).
- Ao descartar: sem necessidade de justificativa obrigatória (fricção mínima), mas com opção leve de motivo.

### 4.4 Rastreador de Progresso (Pipeline Stepper)

- Usado em CAMP-2 a CAMP-6 e no detalhe de campanha (HIST-2) para mostrar em que etapa a campanha está: Estratégia → Gerando → Revisão → Pacote Pronto.
- ~~Alimentado por Realtime~~ **Atualizado a cada retorno de Server Action (revisão 17, Missão 7 — decisão do dono do produto: sem Realtime no MVP)**, mesmo padrão de toda tela do produto até aqui — nunca exige refresh manual porque o componente cliente já re-renderiza com o resultado retornado, não porque assina um canal.
- Cada etapa tem estado próprio (pendente/ativa/concluída/atenção necessária).

### 4.5 Checklist de Geração por Formato

- Usado em CAMP-4: lista os formatos previstos (vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro, teleprompter) com estado individual. **No MVP (Missão 7):** formatos textuais mostram na fila/gerando/pronto/falhou; formatos visuais (`own_media`) mostram aguardando upload/enviado — nunca "gerando", já que não há geração por IA para eles ainda.
- Formatos concluídos ficam clicáveis para preview antecipado, sem esperar o pacote inteiro.

### 4.6 Cartão de Revisão de Peça

- **Justificativa de marca (§4.11) sempre visível**, acima ou ao lado do preview: `content_pieces.brand_rationale`, curta e em linguagem de negócio — nunca escondida atrás de um "saiba mais" (Princípio do Consultor Permanente, §1.1, item 11).
- Área de preview adaptada ao formato: player de vídeo (video/stories/carrossel), leitor de texto com edição inline (legenda/blog/email/roteiro/teleprompter), visualizador de imagem (thumbnail).
- Ações: **Aprovar**, **Rejeitar** (com motivo opcional, usado pelo Learning Engine); para formatos textuais também **Editar** e **Regenerar** (nova chamada ao LLM Provider); para formatos visuais (`own_media`, Missão 7) o widget é um upload — **Enviar arquivo** substitui "gerar/regenerar" (não existe geração por IA para esses formatos no MVP), com opção de reenviar antes de aprovar.
- Atalhos de teclado para revisão rápida em campanhas com muitas peças (ex: `A` aprovar, `R` rejeitar) — ver decisão em aberto §10.

### 4.7 Seletor de Nível de Qualidade (Tier)

- Três opções lado a lado (Econômico / Balanceado / Premium), cada uma com 1–2 frases de proposta de valor em linguagem de negócio — nunca nomes de modelo/fornecedor.
- Indica, quando relevante, impacto no consumo de créditos (ex: "consome menos créditos por geração").

### 4.8 Medidor de Créditos e Uso

- Barra/indicador de saldo, sempre visível de forma discreta no topo durante fluxos de geração (CAMP-2 a CAMP-4).
- Estado de alerta (créditos baixos) antes do bloqueio total, dando tempo ao usuário de agir sem interromper o que está fazendo.

### 4.9 Outros componentes de apoio

| Componente | Uso |
|---|---|
| Dropzone de Upload | KB-2, MEDIA-2 |
| Chip/Tag Input | KB-2, KB-3, MEDIA-1/2 |
| Seletor de Marca (dropdown) | GLOBAL-2 |
| Toast/Banner de Notificação | Eventos assíncronos concluídos, avisos de crédito |
| Modal de Confirmação | Ações destrutivas (remover item da Knowledge Base, arquivar marca) |
| Estado Vazio (padrão) | Ilustração leve + frase de orientação + CTA único — usado em KB-1, MEDIA-1, HIST-1, EVOL-1 |

### 4.10 Painel "O que a Ayon já sabe" ★ novo (revisão 7)

Substitui qualquer indicador de progresso por contagem em ONB-2 (Princípio do Consultor Permanente, §1.1, item 9). É um painel vivo, colapsável em mobile, que a Ayon vai populando com **insights sintetizados** — nunca respostas cruas — conforme a conversa avança.

- Cada item é uma leitura consolidada, não uma transcrição: ex. "Agência de viagens de roteiros personalizados", "Ganha no atendimento, não no preço", "Quer ser a primeira lembrança desse público, não só 'vender mais'".
- Cada item aparece com fade suave logo após o reflexo de tema correspondente (§4.2) — nunca por resposta bruta isolada.
- O cabeçalho do painel muda qualitativamente conforme o número de itens cresce, nunca em fração ou porcentagem: "Começando a te conhecer" → "Já tenho uma ideia boa de quem vocês são" → "Tenho uma visão sólida da [Empresa]".
- Reaproveitável fora do onboarding: qualquer tela onde a Ayon acumula entendimento sobre a marca ao longo de uma sessão (ex: uma sessão de "Ensine sua empresa para a IA" mais longa) pode usar a mesma lógica de painel.

### 4.11 Bloco de Justificativa de Marca ★ novo (revisão 7)

Componente reutilizável que materializa os itens 6/11 do Princípio do Consultor Permanente ([PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7) / ux-design §1.1): nenhuma saída de IA aparece "muda". Tem duas camadas, sempre presentes juntas:

1. **Justificativa curta, sempre visível** (1–2 frases, em linha com o resultado) — nunca escondida, nunca opcional.
2. **Affordance nomeada e padronizada: "Por que fiz assim?"** — um rótulo consistente em toda a plataforma (mesmo texto, mesmo lugar relativo ao resultado) que expande para o raciocínio completo: quais atributos específicos do Brand Brain pesaram, e — quando aplicável — qual campanha ou aprendizado anterior foi considerado (memória de longo prazo, §1.1 item 8). Nunca um rótulo genérico tipo "saiba mais" ou "detalhes".

Usado em:

- **CAMP-2** (Painel de Especialistas, §4.1) — o resumo de 1 linha de cada especialista e a estratégia consolidada final já cumprem a camada 1; "Por que fiz assim?" expande para a opinião completa de cada especialista.
- **CAMP-3** (Revisão da Estratégia) — cada tema/formato sugerido vem com a camada 1 ("Por que sugerimos isso") e o link "Por que fiz assim?" para o raciocínio completo, ancorado em atributos específicos do Brand Brain (nunca uma justificativa genérica tipo "é uma boa prática de marketing").
- **CAMP-5** (Cartão de Revisão de Peça, §4.6) — exibe `content_pieces.brand_rationale` como camada 1, acima ou ao lado do preview; "Por que fiz assim?" abre o detalhe completo.
- **TREND-2** (Detalhe da Tendência) — a explicação de por que a tendência foi ranqueada assim cita explicitamente o Brand Brain, não só "o Coordinator decidiu".

**Comportamento comum:** linguagem de negócio em ambas as camadas, nunca jargão técnico; a camada 1 nunca é um tooltip nem um accordion fechado — é parte do resultado, não um detalhe opcional.

## 5. Estados (Padrões Globais)

| Estado | Quando ocorre | Como se comunica |
|---|---|---|
| **Vazio** | Primeira vez em uma tela sem dados ainda (KB-1, MEDIA-1, HIST-1, EVOL-1) | Frase de orientação + 1 CTA claro, nunca tela em branco |
| **Carregando** | Busca de dados já existentes | Skeleton/placeholder, nunca spinner genérico isolado |
| **Processando (IA)** | Conversa "Conheça sua empresa", tendências, Intelligence Hub, geração de peça | Copy específica da etapa em andamento (nunca "carregando..." genérico) — ver §1, princípio 3 |
| **Sucesso** | Conclusão normal | Confirmação clara, sem exagero, com próximo passo óbvio |
| **Erro total** | Falha que impede continuar | Explica o que aconteceu em linguagem simples + ação de retry |
| **Erro parcial** | Ex: 1 especialista falhou, 1 formato falhou | Não bloqueia o restante; sinaliza o item afetado isoladamente |
| **Créditos insuficientes ou assinatura inativa** | Antes de uma geração com custo (Fluxo 6, portão de crédito) | Bloqueio explícito antes de qualquer chamada de IA, com CTA direto para CFG-4 (comprar créditos) ou CFG-2 (reativar assinatura), sem perder o contexto do que estava fazendo (ex.: objetivo de campanha já digitado) |
| **Permissão insuficiente** | Usuário `viewer` tentando ação de editor/admin | Ação desabilitada com tooltip explicativo, nunca erro após o clique |
| **Aguardando aprovação humana** | Peças de conteúdo (CAMP-5) e sugestões do Brand Evolution (EVOL-1) | Sempre destacado visualmente como pendente de decisão do usuário — nunca some sozinho |

## 6. Microinterações

| Microinteração | Onde | Propósito |
|---|---|---|
| Convergência do Painel de Especialistas | CAMP-2 | Tornar tangível o valor do Intelligence Hub — construir confiança |
| Reação + micro-insight a cada turno | ONB-2 | Fazer a Ayon parecer consultora reagindo de verdade, nunca formulário disfarçado (§1.1) |
| Chip surgindo no painel "O que a Ayon já sabe" | ONB-2 | Tornar tangível o crescimento do entendimento — substitui qualquer barra de progresso (§4.10) |
| Checklist de formatos preenchendo em tempo real | CAMP-4 | Dar sensação de progresso tangível durante geração longa |
| Confirmação sutil ao aceitar sugestão | EVOL-1 | Reforçar positivamente o loop de aprendizado sem ser infantil |
| Celebração da entrega do pacote | CAMP-6 | Marcar o fim do "trabalho pesado" como conquista do usuário |
| Aprovar/Rejeitar com desfazer (undo toast) | CAMP-5 | Reduzir medo de errar ao revisar rapidamente várias peças |
| Transição suave ao trocar de marca | GLOBAL-2 | Deixar claro que o contexto mudou, sem parecer um reload cru |
| Aviso proativo de créditos baixos | Durante CAMP-2–CAMP-4 | Evitar que o bloqueio de crédito pareça um erro súbito |

## 7. Fluxos de Navegação (Jornadas Ponta a Ponta)

### Jornada 1 — Primeiro acesso
`AUTH-2 → AUTH-3 → ONB-1 → ONB-2 → ONB-3 → GLOBAL-3 (Painel)`

### Jornada 2 — Criar uma campanha completa
`GLOBAL-3 / TREND-1 → CAMP-1 → CAMP-2 → CAMP-3 → CAMP-4 → CAMP-5 (loop até tudo aprovado) → CAMP-6 → HIST-2`

### Jornada 3 — Ensinar a IA a qualquer momento (não-bloqueante)
`Qualquer tela → KB-1 → KB-2 → KB-1` (pode ser feito em paralelo a qualquer outro fluxo, sem interromper campanhas em andamento)

### Jornada 4 — Aceitar uma sugestão do Brand Evolution
`GLOBAL-1 (notificação) ou EVOL-1 → (aceitar, inline no card) → card migra para a seção de Histórico, mesma tela` — efeito prático aparece na próxima campanha criada (CAMP-2/CAMP-3), sem necessidade de o usuário "ver" a mudança tecnicamente.

### Jornada 5 — Convidar time (Business)
`CFG-5 (criar marca, se necessário) → CFG-6 (convidar usuário, definir papel por marca) → e-mail de convite → AUTH-1 (novo usuário aceita)`

### Jornada 6 — Retomar campanha incompleta
`HIST-1 → HIST-2 → CAMP-* (exatamente na etapa em que parou, via `campaigns.status`/`content_pieces.status`)`

## 8. Responsividade e Dispositivos

- **Desktop-first** para os fluxos de criação/estratégia (CAMP-1 a CAMP-4) e para a Biblioteca de Conhecimento (upload em lote).
- **Revisão e aprovação (CAMP-5)** deve funcionar bem também em mobile/tablet — é plausível que o dono do negócio aprove conteúdo pelo celular entre outras tarefas.
- **Conversa com o Consultor (ONB-2)** funciona bem em qualquer dispositivo, por ser uma interface conversacional simples — o painel "O que a Ayon já sabe" (§4.10) colapsa em mobile.
- Configurações administrativas (CFG-5/CFG-6, gestão de time/marcas) podem assumir uso majoritariamente desktop no MVP.

## 9. Acessibilidade

- Toda ação crítica (aprovar, rejeitar, aceitar sugestão) deve ser acessível por teclado, não só por clique/toque.
- Estados (carregando, processando, erro) devem ser anunciados para leitores de tela (ex: `aria-live` em áreas de status assíncrono), não apenas visuais.
- Contraste e tamanho de toque seguem WCAG AA como piso mínimo (detalhamento fica para a fase de sistema visual — §10).

## 10. Decisões em Aberto (UX)

1. **Campanha a partir de tema livre:** CAMP-1 permite iniciar uma campanha sem partir de uma tendência específica (tema definido manualmente pelo usuário), ou toda campanha no MVP nasce de uma tendência selecionada em TREND-1?
2. **Atalhos de teclado na revisão (CAMP-5):** entram no MVP ou ficam para uma iteração de produtividade posterior?
3. **Sistema visual (fora deste documento):** paleta de cores, tipografia, logotipo e tokens de design ainda não foram definidos — próxima fase, após aprovação desta especificação de UX.
4. **Notificações:** central in-app (GLOBAL-1) é suficiente no MVP, ou e-mail transacional também é necessário desde o início (alinhado à decisão em aberto de flows.md)?
5. **Retry manual vs. automático em erro parcial** (ex: um especialista ou um formato falhou): o usuário aciona o retry, ou o sistema tenta novamente sozinho antes de expor o erro?
6. **Localização:** interface só em português no MVP, ou já nasce preparada para outros idiomas (dado potencial de expansão)?
7. ~~**Persona da Ayon:** primeira pessoa sem nome próprio ou identidade mais pessoal com nome?~~ **Resolvido (revisão técnica pré-Missão 2):** "Ayon" é o nome — ver [PRD.md §13.8](../PRD.md#13-decisões-em-aberto-precisam-de-aprovação-antes-de-virar-escopo).
8. **Atalho de contexto por link:** aceitar link de site/Instagram no convite de ONB-1 é MVP ou fica para depois? Ver [PRD.md §13.9](../PRD.md#13-decisões-em-aberto-precisam-de-aprovação-antes-de-virar-escopo) — **adiado para depois da v1 da Missão 2**, não bloqueia o início da implementação.
9. ~~**Painel "O que a Ayon já sabe" (§4.10):** fica sempre visível ou some por padrão? Persiste depois da conversa?~~ **Resolvido (revisão técnica pré-Missão 2):** sempre visível por padrão no desktop; colapsável em mobile (já alinhado com §8). Não persiste como tela própria após a conversa — a mesma informação já vive, sintetizada, em ONB-3/ONB-4; o painel é exclusivo da conversa em andamento.

## 11. Histórico

Ver [changelog.md](changelog.md).
