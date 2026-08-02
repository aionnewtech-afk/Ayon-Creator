# UX Design — Ayon Creator

> **Status:** Rascunho v1.0 — aguardando aprovação
> **Última atualização:** 2026-08-01
> Este documento especifica telas, componentes, estados, navegação, microinterações e jornadas de uso, correspondentes ao escopo de [PRD.md](../PRD.md) e aos fluxos de [flows.md](flows.md). Nenhuma interface é implementada sem que a tela/componente correspondente esteja aqui e aprovado. Toda nova tela nasce daqui, não do código.
> **Fora de escopo deste documento:** sistema visual (paleta de cores, tipografia, tokens, logotipo). Este documento define *o quê* existe e *como se comporta* — o *como se parece visualmente* é uma fase seguinte, deliberadamente adiada (ver §10).

---

## 1. Princípios de UX

1. **Nunca mostrar jargão técnico.** Todo texto de interface usa a linguagem de negócio definida em [PRD §2](../PRD.md#2-linguagem-motores-internos-vs-produto). Nomes de engines (Brand Brain, Knowledge Base, Trend Engine, Asset Engine, Learning Engine) não aparecem em nenhum rótulo, botão, título de tela ou mensagem de erro.
2. **O Intelligence Hub é exceção deliberada.** Ele não é escondido — é comunicado como o motivo pelo qual o usuário pode confiar na estratégia gerada ("sua campanha foi pensada por uma equipe de especialistas de IA, não por um robô único"). A visualização do painel de especialistas (§4.1) é o momento de maior construção de confiança do produto — deve parecer substancial, não decorativo.
3. **Nenhuma operação de IA longa fica com "spinner cego".** Toda geração assíncrona (entrevista → perfil, tendências, estratégia, peças, pacote) mostra o que está acontecendo, com linguagem humana ("Nossos especialistas estão analisando sua marca...", não "Processando...").
4. **Aprovação humana é sempre visível, nunca automática nos bastidores.** Isso vale tanto para peças de conteúdo (Fluxo 4) quanto para sugestões do Brand Evolution (Fluxo 8) — a interface nunca aplica nada sem uma ação explícita e reversível do usuário.
5. **Conversa em vez de formulário sempre que envolver identidade de marca.** O onboarding e a ampliação de conhecimento da marca favorecem interação conversacional a campos de formulário engessados.
6. **Progresso é sempre reversível ou visível.** Rejeitar, editar e desfazer são sempre baratos e claros — o usuário nunca se sente "preso" a uma geração.

## 2. Arquitetura de Informação (Navegação)

### 2.1 Mapa de navegação (sitemap)

```
Ayon Creator
├── Painel (Home)
├── Criar Campanha  ────────────────► fluxo guiado (não é uma "tela", é uma sequência — ver §7, Jornada 2)
├── Conheça sua Empresa
│   ├── Entrevista (chat)
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
| Conheça sua Empresa | Entrevista + Perfil da Marca | Brand Brain | Todos (admin+ edita, demais visualizam) |
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

> Propositalmente mínimo: a AUTH-3 não pede identidade de marca (tom, público etc.) — isso é function da entrevista (ONB), não do cadastro.

### 3.2 Conheça sua Empresa (`ONB`)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| ONB-1 | Boas-vindas à entrevista | Preparar o usuário para a conversa (o que esperar, quanto tempo leva) | — | AUTH-3 / menu "Conheça sua Empresa" | ONB-2 |
| ONB-2 | Entrevista (chat) | Conduzir a conversa que popula o Brand Brain (§4.2 detalha o componente) | digitando, aguardando resposta do usuário, retomando entrevista incompleta | ONB-1 | ONB-3 |
| ONB-3 | Resumo gerado | Mostrar o perfil sintetizado a partir da entrevista para confirmação | gerando resumo, editando campo individual | ONB-2 | Painel / KB-1 |
| ONB-4 | Perfil da Marca | Visão persistente e editável da identidade (história, produtos, clientes, tom, concorrentes, objetivos, diferenciais, palavras proibidas/favoritas) | editando, salvo | Menu "Conheça sua Empresa" a qualquer momento | — |

### 3.3 Ensine sua Empresa para a IA (`KB`)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| KB-1 | Biblioteca de Conhecimento | Listar documentos, conteúdos passados, FAQs, notas | vazio (primeira vez), carregando | Menu / ONB-3 | KB-2, KB-3 |
| KB-2 | Adicionar Conhecimento | Upload de arquivo ou nota manual, com tags | enviando, erro de formato/tamanho | KB-1 | KB-1 |
| KB-3 | Detalhe do item | Visualizar/editar tags, remover item | — | KB-1 | KB-1 |

### 3.4 O que está em Alta (`TREND`)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| TREND-1 | Lista de Tendências | Mostrar tendências ranqueadas para a marca | carregando (buscando tendências), vazio, erro parcial | Menu / Painel | TREND-2, CAMP-1 |
| TREND-2 | Detalhe da Tendência | Contexto de por que a tendência foi ranqueada assim (explicação do Coordinator, em linguagem simples) | — | TREND-1 | CAMP-1 |

### 3.5 Criar Campanha (`CAMP`) — fluxo guiado

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| CAMP-1 | Ponto de partida | Escolher a tendência (ou iniciar tema livre — ver decisão em aberto §10) | — | TREND-1/2, Painel, "Criar Campanha" no menu | CAMP-2 |
| CAMP-2 | Painel de Especialistas (Intelligence Hub) | Visualizar a estratégia sendo formada — momento de maior confiança do produto (§4.1) | especialistas analisando, um especialista falhou (parcial), consolidando | CAMP-1 | CAMP-3 |
| CAMP-3 | Revisão da Estratégia | Mostrar temas, formatos previstos, calendário sugerido; aprovar ou pedir ajuste | ajustando, aprovado | CAMP-2 | CAMP-4 |
| CAMP-4 | Gerando Pacote | Checklist de formatos sendo produzidos em tempo real | gerando (por formato), erro em um formato | CAMP-3 | CAMP-5 |
| CAMP-5 | Revisão e Aprovação | Revisar cada peça (por formato), aprovar/editar/rejeitar | aguardando aprovação, editando, regenerando | CAMP-4 | CAMP-5 (loop) → CAMP-6 |
| CAMP-6 | Pacote Pronto | Confirmar conclusão e oferecer download | montando pacote, pronto | CAMP-5 | HIST-2, download |

### 3.6 Campanhas (`HIST`)

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

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| EVOL-1 | Sugestões Pendentes | Cards de sugestões aguardando decisão (§4.3) | vazio ("ainda não há sugestões — continue aprovando campanhas"), nova sugestão chegando | Menu, notificação | EVOL-2 |
| EVOL-2 | Detalhe da Sugestão | Contexto completo da sugestão + decisão (aceitar/descartar) | aplicando | EVOL-1 | EVOL-1 |
| EVOL-3 | Histórico de Sugestões | Sugestões já aceitas/descartadas, com data e quem decidiu | vazio | EVOL-1 | — |

### 3.9 Configurações (`CFG`)

| ID | Tela | Objetivo | Estados-chave | Entra a partir de | Sai para |
|---|---|---|---|---|---|
| CFG-1 | Perfil da Conta/Organização | Dados da organização, usuário logado | — | Menu | — |
| CFG-2 | Plano e Cobrança | Ver/alterar plano (Starter/Pro/Business), forma de pagamento | processando pagamento, erro de cobrança | Menu | — |
| CFG-3 | Nível de Qualidade (tier) | Escolher Econômico/Balanceado/Premium — **nunca menciona fornecedor** | — | Menu, CFG-2 | — |
| CFG-4 | Créditos e Uso | Saldo, histórico de consumo, comprar créditos avulsos | créditos baixos (aviso), sem saldo (bloqueio) | Menu, aviso de bloqueio em CAMP-4 | — |
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
1. Ao entrar em CAMP-2, os 7 papéis aparecem como cartões/ícones distintos (nomes de negócio, não técnicos: "Marketing", "Copy", "Marca", "Especialista do seu Setor", "SEO", "Redes Sociais", "Dados" — nunca "specialist_type" cru).
2. Cada cartão transita por três estados visuais: **aguardando → analisando → opinião pronta** (com um resumo de 1 linha da opinião, não o texto bruto).
3. Quando todos concluem (ou o tempo/retry limite é atingido — ver Fluxo 10, passo 7), uma animação de "convergência" leva as 7 opiniões a um único cartão final: a estratégia consolidada (Coordinator AI), com uma frase de transição tipo "Consolidando em uma estratégia única...".
4. Se um especialista falha, seu cartão mostra um estado neutro ("não conseguiu opinar desta vez") sem bloquear os demais nem assustar o usuário com "erro".

**Variantes de uso:** versão completa (CAMP-2, estratégia de campanha) e versão compacta (quando uma peça principal aciona uma nova sessão — ver Fluxo 3.1 — pode usar uma versão reduzida/mais rápida do mesmo componente).

### 4.2 Chat de Entrevista (Onboarding Conversacional)

- Bolhas de conversa (IA à esquerda, usuário à direita), indicador de digitação da IA.
- Barra de progresso discreta e não-numérica (ex: pontos preenchendo, não "3/9 perguntas") — evita sensação de formulário.
- Ao final de cada bloco temático (ex: após "concorrentes"), a IA reflete brevemente o que entendeu ("Entendi — vocês competem principalmente com X e Y. Certo?") antes de seguir, permitindo correção imediata.
- Suporta pausar e retomar depois sem perder contexto (retoma exatamente na última pergunta pendente).

### 4.3 Cartão de Sugestão (Brand Evolution / "O que Funcionou")

- Frase em linguagem simples e específica (nunca genérica) — ex.: "Percebemos que vídeos de até 35 segundos performam melhor. Deseja atualizar sua estratégia?"
- Duas ações de mesmo peso visual: **Aceitar** e **Descartar** (nunca um "aceitar" pré-marcado ou destacado de forma a induzir aceite automático).
- Ao aceitar: pequena confirmação positiva (não intrusiva) + o card migra para o Histórico (EVOL-3).
- Ao descartar: sem necessidade de justificativa obrigatória (fricção mínima), mas com opção leve de motivo.

### 4.4 Rastreador de Progresso (Pipeline Stepper)

- Usado em CAMP-2 a CAMP-6 e no detalhe de campanha (HIST-2) para mostrar em que etapa a campanha está: Estratégia → Gerando → Revisão → Pacote Pronto.
- Alimentado por Realtime — nunca exige refresh manual.
- Cada etapa tem estado próprio (pendente/ativa/concluída/atenção necessária).

### 4.5 Checklist de Geração por Formato

- Usado em CAMP-4: lista os formatos previstos (vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro, teleprompter) com estado individual (na fila/gerando/pronto/falhou).
- Formatos concluídos ficam clicáveis para preview antecipado, sem esperar o pacote inteiro.

### 4.6 Cartão de Revisão de Peça

- Área de preview adaptada ao formato: player de vídeo (video/stories/carrossel), leitor de texto com edição inline (legenda/blog/email/roteiro/teleprompter), visualizador de imagem (thumbnail).
- Ações: **Aprovar**, **Editar** (só habilitado para formatos textuais — formatos de vídeo não têm editor manual no MVP, apenas aprovar/rejeitar/regenerar), **Rejeitar** (com motivo opcional, usado pelo Learning Engine).
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

## 5. Estados (Padrões Globais)

| Estado | Quando ocorre | Como se comunica |
|---|---|---|
| **Vazio** | Primeira vez em uma tela sem dados ainda (KB-1, MEDIA-1, HIST-1, EVOL-1) | Frase de orientação + 1 CTA claro, nunca tela em branco |
| **Carregando** | Busca de dados já existentes | Skeleton/placeholder, nunca spinner genérico isolado |
| **Processando (IA)** | Entrevista, tendências, Intelligence Hub, geração de peça | Copy específica da etapa em andamento (nunca "carregando..." genérico) — ver §1, princípio 3 |
| **Sucesso** | Conclusão normal | Confirmação clara, sem exagero, com próximo passo óbvio |
| **Erro total** | Falha que impede continuar | Explica o que aconteceu em linguagem simples + ação de retry |
| **Erro parcial** | Ex: 1 especialista falhou, 1 formato falhou | Não bloqueia o restante; sinaliza o item afetado isoladamente |
| **Créditos insuficientes** | Antes de uma geração com custo (Fluxo 6) | Bloqueio explícito com CTA direto para comprar créditos, sem perder o contexto do que estava fazendo |
| **Permissão insuficiente** | Usuário `viewer` tentando ação de editor/admin | Ação desabilitada com tooltip explicativo, nunca erro após o clique |
| **Aguardando aprovação humana** | Peças de conteúdo (CAMP-5) e sugestões do Brand Evolution (EVOL-1) | Sempre destacado visualmente como pendente de decisão do usuário — nunca some sozinho |

## 6. Microinterações

| Microinteração | Onde | Propósito |
|---|---|---|
| Convergência do Painel de Especialistas | CAMP-2 | Tornar tangível o valor do Intelligence Hub — construir confiança |
| Indicador de digitação + reflexo de entendimento | ONB-2 | Fazer a entrevista parecer conversa real, não formulário disfarçado |
| Checklist de formatos preenchendo em tempo real | CAMP-4 | Dar sensação de progresso tangível durante geração longa |
| Confirmação sutil ao aceitar sugestão | EVOL-2 | Reforçar positivamente o loop de aprendizado sem ser infantil |
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
`GLOBAL-1 (notificação) ou EVOL-1 → EVOL-2 → (aceitar) → EVOL-3` — efeito prático aparece na próxima campanha criada (CAMP-2/CAMP-3), sem necessidade de o usuário "ver" a mudança tecnicamente.

### Jornada 5 — Convidar time (Business)
`CFG-5 (criar marca, se necessário) → CFG-6 (convidar usuário, definir papel por marca) → e-mail de convite → AUTH-1 (novo usuário aceita)`

### Jornada 6 — Retomar campanha incompleta
`HIST-1 → HIST-2 → CAMP-* (exatamente na etapa em que parou, via `campaigns.status`/`content_pieces.status`)`

## 8. Responsividade e Dispositivos

- **Desktop-first** para os fluxos de criação/estratégia (CAMP-1 a CAMP-4) e para a Biblioteca de Conhecimento (upload em lote).
- **Revisão e aprovação (CAMP-5)** deve funcionar bem também em mobile/tablet — é plausível que o dono do negócio aprove conteúdo pelo celular entre outras tarefas.
- **Entrevista (ONB-2)** funciona bem em qualquer dispositivo, por ser uma interface conversacional simples.
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

## 11. Histórico

Ver [changelog.md](changelog.md).
