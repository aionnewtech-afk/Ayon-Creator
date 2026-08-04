# PRD — Ayon Creator

> **Status do documento:** v1.0 (revisão 19 — Missão 8, Learning Engine, implementada e validada) — **filosofia de produto aprovada e consolidada; documento liberado como fonte oficial da verdade para o início da implementação de código**. Decisões residuais não relacionadas à filosofia seguem listadas em §13 e podem ser resolvidas durante o desenvolvimento, conforme necessidade.
> **Última atualização:** 2026-08-04
> **Mudança da revisão 19:** Missão 8 (Learning Engine) implementada e validada com Supabase + Anthropic reais. Ver [CHANGELOG.md](CHANGELOG.md) `[0.8.0]`.
> **Mudança da revisão 18:** §13 item 3 resolvido — frequência do Brand Evolution definida (análise sob demanda, mínimo de 5 `learning_signals`, gratuita em todos os planos). Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 17:** Missão 7 (Asset Engine) implementada e validada com Supabase + Anthropic reais. Ver [CHANGELOG.md](CHANGELOG.md) `[0.7.0]`.
> **Mudança da revisão 16:** correção de auditoria (§13 item 1, contagem de documentos do doc-first) + §13 item 4 resolvido para o escopo do MVP da Missão 7 (Asset Engine): 5 formatos textuais gerados por IA, 4 formatos visuais preenchidos por upload manual do cliente, sem Avatar/Voice/Media Provider ainda. Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 15:** Missão 6 (Billing) implementada e validada com Supabase + Mercado Pago reais (sandbox). Ver [CHANGELOG.md](CHANGELOG.md) `[0.6.0]`.
> **Mudança da revisão 14 (preparação Missão 6, Billing):** §8 finalizada com números concretos por plano (marcas, tier incluso, créditos/mês) — resolve §13 item 5. Mercado Pago adicionado à stack (§10) como módulo de Billing dedicado, não Provider Layer. Sem mudança de filosofia/escopo de produto. Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 13:** Missão 5 — Trend Engine — implementada e validada com Supabase + Anthropic reais. Ver [CHANGELOG.md](CHANGELOG.md) `[0.5.0]`.
> **Mudança da revisão 12:** Missão 5 — Trend Engine ("O que está em alta") — aprovada para início de código. Sem mudança de escopo/filosofia de produto. Duas decisões técnicas resolvidas em [architecture.md §3.3/§10](docs/architecture.md#33-trend-engine): Trend Source Provider do MVP = busca web nativa da Anthropic, sempre atrás do Provider Gateway (nunca acoplado ao Trend Engine); Fluxo 2 sem n8n, mesmo padrão das Missões 2–4. Nova regra inegociável: nenhuma tendência entra em estratégia sem passar pelo Intelligence Hub. Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 11:** Missão 4 — "Ensine sua Empresa para a IA" (Knowledge Base) — implementada e validada com Supabase real (upload de PDF/DOCX/TXT, nota manual, edição de tags, remoção). Fecha formalmente o ciclo doc-first já refletido em `architecture.md`/`database.md`/`flows.md`/`ux-design.md` (revisão 14) e em `docs/changelog.md` (v1.8), que este documento não acompanhava até agora. Sem mudança de escopo de produto. Ver [CHANGELOG.md](CHANGELOG.md) `[0.4.0]`.
> **Mudança da revisão 10:** §13, item 1, marcado como resolvido arquiteturalmente — quais especialistas participam de cada tipo de decisão passa a ser configuração de dados (Specialist Registry, [architecture.md §4.1](docs/architecture.md#41-specialist-registry-especialistas-plugáveis-★-novo-revisão-10)), não mais uma pergunta de arquitetura. Reordenação de roadmap: a próxima missão de implementação passa a ser a infraestrutura de especialistas plugáveis do Intelligence Hub, não "Ensine sua empresa para a IA" — sem mudança de escopo de produto (ver [docs/changelog.md](docs/changelog.md)).
> **Regra do projeto:** Nenhuma linha de código é escrita sem que a funcionalidade correspondente esteja documentada aqui (e nos documentos irmãos: [architecture.md](docs/architecture.md), [database.md](docs/database.md), [flows.md](docs/flows.md), [ux-design.md](docs/ux-design.md)) **e aprovada pelo dono do produto**. Todo pedido de nova funcionalidade dispara atualização destes 5 documentos, nessa ordem, antes de qualquer implementação — mesma contagem usada em [README.md](README.md#regra-de-trabalho) (corrigido numa auditoria de rotina: este parágrafo ainda contava 4, sem `ux-design.md`, embora na prática ele sempre tenha sido atualizado junto dos demais em toda missão já fechada). Histórico de mudanças em [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 7:** novo §1.1 — **Princípio do Consultor Permanente** — elevado a princípio permanente de produto, válido para toda a Ayon Creator, não só o onboarding. A palavra "entrevista" é removida de todo o vocabulário do produto (interface e documentação viva). Ver [docs/changelog.md](docs/changelog.md) para o detalhamento completo do que mudou em cada documento.
> **Mudança da revisão 8 (consolidação final antes da Missão 2):** §1.1 ganha 3 regras adicionais: memória de longo prazo explícita (item 3, expandido), o bloco **"Por que fiz assim?"** como affordance padrão e nomeado para justificativa (item 6, expandido), e a regra inegociável de que nenhum conteúdo nasce sem passar pelo Brand Brain (novo item 7). Aprovado pelo dono do produto — §1.1 está consolidado; próximas mudanças estruturais na filosofia só após a implementação da Missão 2.

---

## 1. Visão Geral

**A Ayon Creator não é um gerador de conteúdo. É um Sistema Operacional de Marketing orientado por IA.**

Ela não entrega "peças avulsas" — ela conhece a empresa do cliente, entende o que está em alta no mercado dele, pensa a estratégia como faria uma equipe de especialistas de marketing, produz o material necessário para executar essa estratégia, e aprende continuamente o que funciona, sempre devolvendo essa aprendizagem ao usuário como sugestão — nunca como mudança automática e silenciosa de comportamento.

Ela substitui o papel que hoje seria de uma pequena equipe (estrategista, redator, designer, social media, analista de dados) por um sistema orientado por IA, operado por um único usuário.

### 1.1 Princípio do Consultor Permanente ★ novo (revisão 7)

Este é um **princípio permanente de produto** — vale para toda interação da Ayon com o usuário, em qualquer tela ou fluxo, não apenas no onboarding.

**A Ayon nunca deve parecer uma IA fazendo perguntas ou um cadastro sendo preenchido. Ela deve parecer um consultor estratégico permanente que acabou de entrar para a equipe da empresa.**

Isso se desdobra em regras concretas:

1. **Nunca sensação de formulário, cadastro ou entrevista.** Nenhuma interação do produto — onboarding ou não — deve fazer o usuário sentir que está "preenchendo" algo. A palavra "entrevista" é removida de todo o vocabulário do produto, inclusive da documentação interna (ver [docs/changelog.md](docs/changelog.md)).
2. **A Ayon agrega valor a cada troca, não só pergunta.** Toda resposta do usuário é seguida por uma observação, hipótese ou provocação inteligente — nunca por uma pergunta "fria" enfileirada logo em seguida. Exemplo real de produto:
   > Em vez de "Qual é o seu diferencial?", a Ayon diz: *"Empresas do seu segmento normalmente competem por preço. Você comentou que o atendimento é muito importante pra vocês — você acredita que esse é o verdadeiro diferencial da empresa?"*
3. **Memória de longo prazo.** A Ayon não lembra só da conversa atual — lembra de decisões, campanhas e aprendizados anteriores da empresa, via Brand Brain, Knowledge Base, histórico de campanhas e Brand Evolution. Nenhuma interação trata a marca como se fosse a primeira vez, e nenhuma decisão nova ignora o que já foi decidido, testado ou aprendido antes.
4. **Progresso é conhecimento, não formulário.** Qualquer indicador de progresso comunica o quanto a Ayon já entende da empresa — nunca quantas perguntas faltam ou quantos campos estão preenchidos.
5. **Encerramento é integração, não conclusão de tarefa.** Ao final de qualquer sessão de aprofundamento sobre a marca, o usuário sente que ganhou um membro de equipe permanente — não que "terminou um formulário".
6. **Toda decisão estratégica importante carrega uma justificativa consultável.** Estratégias de campanha, roteiros, vídeos, carrosséis e qualquer outra peça gerada vêm acompanhados de uma justificativa em linguagem de negócio, ancorada no que a Ayon aprendeu sobre a empresa (Brand Brain) — nunca uma geração "muda", sem explicação do porquê daquela escolha. Essa justificativa é sempre acessível através de um bloco padrão **"Por que fiz assim?"** — nunca opcional, nunca escondida atrás de várias etapas. Vale igualmente para o Intelligence Hub (§4.1) e o Asset Engine (§4.3).
7. **Nenhum conteúdo nasce sem passar pelo Brand Brain.** Toda geração de campanha, vídeo, imagem, roteiro, carrossel ou e-mail nasce do entendimento da empresa (Brand Brain) — nunca apenas do prompt solicitado. Não existe, e nunca deve existir, um atalho técnico ou modo de "geração rápida" que produza conteúdo pulando esse carregamento de contexto — regra inegociável, no mesmo nível da regra de aprovação humana do Brand Evolution (§4.4).

> Princípio referenciado a partir de [docs/ux-design.md §1](docs/ux-design.md#1-princípios-de-ux) (como aparece na interface) e [docs/architecture.md §1.1](docs/architecture.md#11-princípio-consultor-permanente-justificativa-fundamentada-em-marca-★-novo-revisão-7) (o que isso exige tecnicamente).

## 2. Linguagem: Motores Internos vs. Produto

Este é um princípio de produto, não um detalhe de implementação: **o usuário nunca deve ver jargão técnico.** Nomes como *Brand Brain*, *Trend Engine*, *Learning Engine*, *Asset Engine* e *Knowledge Base* continuam existindo — são os módulos internos descritos em [docs/architecture.md](docs/architecture.md) — mas nunca aparecem na interface. Toda comunicação com o usuário usa linguagem de negócio.

| Motor interno (arquitetura) | Nome/ação exposta ao usuário |
|---|---|
| **Brand Brain** (+ interview de onboarding) | "Conheça sua empresa" |
| **Knowledge Base** | "Ensine sua empresa para a IA" |
| **Trend Engine** | "O que está em alta" |
| **Asset Engine** (+ Intelligence Hub para decisões estratégicas) | "Criar campanha" |
| **Learning Engine** (produto: *Brand Evolution*) | "O que funcionou" |
| **Intelligence Hub** | Não é escondido como os demais — é comunicado como diferencial ("sua campanha é pensada por uma equipe de especialistas de IA, não por um único robô"), mas os nomes internos dos especialistas (ver §4.1) não precisam aparecer literalmente na UI. |

> Qualquer novo módulo interno criado no futuro deve ganhar, obrigatoriamente, uma entrada nesta tabela antes de ser exposto ao usuário.

> Além de nunca expor jargão técnico, toda comunicação segue o **Princípio do Consultor Permanente** (§1.1): a Ayon nunca apenas informa um resultado — ela explica o raciocínio por trás dele.

## 3. Problema

Pequenas e médias empresas que dependem de conteúdo recorrente para atrair clientes enfrentam:

- Falta de tempo/equipe para pesquisar tendências e planejar conteúdo continuamente;
- Custo alto de produção (roteiro, gravação, edição, avatar, voz, design);
- Inconsistência de marca quando terceirizam para múltiplos freelancers/agências;
- Dificuldade em manter constância de publicação;
- Falta de uma visão estratégica única — normalmente cada peça é feita isoladamente, sem uma "cabeça" coordenando marketing, copy, branding, SEO e dados ao mesmo tempo.

## 4. Solução

### 4.1 Intelligence Hub — como a Ayon Creator pensa

O diferencial central do produto. Nenhuma decisão estratégica importante — definir a estratégia de uma campanha, por exemplo — é gerada por um único modelo de IA isolado. Em vez disso, o **Intelligence Hub** coordena um painel de **especialistas de IA**, cada um com um papel:

- Especialista em Marketing
- Especialista em Copy
- Especialista em Branding
- Especialista no Nicho (conhecimento específico do setor da marca — ex: viagem, imobiliário, saúde)
- Especialista em SEO
- Especialista em Redes Sociais
- Especialista em Dados

Cada especialista gera sua opinião de forma independente. Em seguida, um **Coordinator AI** consolida todas as opiniões em uma única estratégia coerente, resolvendo divergências e priorizando de acordo com o Brand Brain da marca. Isso garante que a estratégia entregue ao usuário nunca dependa do "palpite" de um único modelo de IA — é sempre o resultado de um painel + uma síntese.

> **Princípio do Consultor Permanente (§1.1):** toda estratégia consolidada pelo Coordinator AI vem acompanhada de uma justificativa em linguagem de negócio, ancorada no Brand Brain da marca — nunca apenas o resultado, sempre o porquê.

> Detalhamento técnico (quando o Hub é acionado, como os especialistas são configurados) em [docs/architecture.md](docs/architecture.md#4-intelligence-hub) e [docs/flows.md](docs/flows.md#fluxo-10--coordenação-de-especialistas-intelligence-hub).

### 4.2 Modos de Produção de Conteúdo

Para cada peça visual gerada dentro de uma campanha, o sistema escolhe (ou o usuário ajusta) como ela é materializada:

| Modo | Descrição |
|---|---|
| **Avatar de IA personalizado** | Vídeo com avatar de IA falando o roteiro, com voz da marca. |
| **Vídeos públicos licenciados** | Vídeo montado a partir de banco de vídeos com licença de uso público/stock. |
| **Mídia própria** | Vídeo/imagem montado a partir de arquivos enviados pelo próprio cliente. |
| **Híbrido** | Combinação de avatar + vídeos licenciados + imagens/mídia própria na mesma peça. |
| **Somente texto** | Sem geração de vídeo/imagem — aplica-se aos formatos textuais (ver §4.3). |

### 4.3 Formatos e Pacote de Conteúdo (MVP)

Ao final de uma campanha, o usuário recebe um **pacote de conteúdo completo para download**, não peças soltas. No MVP, o pacote pode incluir:

- Vídeo
- Legenda (caption)
- Stories
- Carrossel
- Thumbnail
- Blog
- Email
- Roteiro
- Teleprompter (versão do roteiro formatada e cronometrada para leitura em gravação)

> **Importante:** o MVP **não publica automaticamente** em nenhuma rede social — ver §9.2. A entrega é sempre um pacote para download; publicação automática é evolução futura.

> **Princípio do Consultor Permanente (§1.1):** toda peça do pacote, ao chegar para revisão humana, vem com uma justificativa curta de por que aquela escolha reflete a marca — não é um resultado "mudo".

### 4.4 Brand Evolution — aprendizado contínuo com aprovação humana

A Ayon Creator aprende continuamente com o uso (aprovações, rejeições, edições, e futuramente performance publicada), mas **nunca altera o comportamento da marca automaticamente**. Toda aprendizagem vira uma sugestão explícita, apresentada em linguagem simples, que o usuário aceita ou recusa. Exemplo de interação real do produto:

> "Percebemos que vídeos de até 35 segundos performam melhor. Deseja atualizar sua estratégia?"

Na interface, esta capacidade aparece como **"O que funcionou"**.

### 4.5 Onboarding Conversacional

Não há formulário de cadastro de marca, e não é uma entrevista. O onboarding é uma **conversa estratégica com a Ayon** ("Conheça sua empresa") — a mesma Ayon que depois vai pensar as campanhas, agindo desde o primeiro instante como consultora, não como formulário: ela reage ao que ouve, traz observações e conecta o que já sabe (Princípio do Consultor Permanente, §1.1), enquanto forma uma visão sobre:

- História da empresa
- Produtos
- Clientes
- Tom de voz
- Concorrentes
- Objetivos
- Diferenciais
- Palavras proibidas
- Palavras favoritas

O que é dito alimenta diretamente o Brand Brain (identidade operante da marca) e fica também registrado como conhecimento bruto pesquisável ("Ensine sua empresa para a IA"). Ao final, o usuário não "conclui um cadastro" — sente que a Ayon passou a fazer parte da equipe (ver [docs/ux-design.md §4.2](docs/ux-design.md#42-conversa-com-o-consultor-onboarding-conversacional) para o desenho completo da experiência).

## 5. Público-alvo (ICP)

**Cliente inicial:** pequenas e médias empresas que dependem de criação recorrente de conteúdo para atrair clientes.

Exemplos de nicho: agências de viagem, imobiliárias, clínicas, personal trainers, restaurantes, advogados, corretores, contadores.

**Laboratório de validação:** Todo Canto (agência de viagem) será o primeiro caso de uso real.

**Expansão futura (fora do MVP):** agências de marketing operando múltiplos clientes dentro de uma mesma conta.

## 6. Personas

| Persona | Papel | Necessidade principal |
|---|---|---|
| **Dono(a) de PME** | Decide e às vezes opera a conta | Conteúdo constante sem contratar equipe |
| **Responsável por marketing/social media** | Opera o dia a dia da plataforma | Gerar, revisar e aprovar campanhas rapidamente |
| **Admin da agência (futuro)** | Gerencia múltiplas marcas de clientes | Alternar entre marcas, times e permissões |

## 7. Proposta de Valor e Diferenciais

- **Sistema Operacional de Marketing**, não gerador de conteúdo pontual — conhece a empresa, pensa estratégia, produz e aprende;
- **Intelligence Hub**: estratégia decidida por um painel de especialistas de IA + Coordinator, nunca por um único modelo;
- **Brand Evolution**: aprendizado contínuo, sempre com aprovação humana explícita — nunca muda a marca "nas costas" do usuário;
- **Consultor estratégico permanente**: a Ayon conhece a empresa numa conversa real desde o primeiro contato — nunca formulário, nunca entrevista — e continua a agregar valor, com memória e justificativa, em cada campanha depois (Princípio do Consultor Permanente, §1.1);
- **Pacote de conteúdo completo** por campanha (vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro, teleprompter);
- **Simplicidade de fornecedor**: o cliente escolhe um nível de qualidade/custo (Econômico, Balanceado, Premium) — nunca precisa saber ou escolher qual IA está por trás;
- **Arquitetura modular e agnóstica de fornecedor** internamente — protege o produto de dependência de qualquer IA específica (ver [docs/architecture.md](docs/architecture.md));
- Multi-marca desde a arquitetura, permitindo evolução para agências sem retrabalho.

## 8. Modelo de Negócio

SaaS por assinatura, com 3 planos + créditos avulsos. Processamento de pagamento via **Mercado Pago** (assinatura recorrente para os planos, pagamento avulso para créditos extras — [architecture.md §12](docs/architecture.md#12-billing-módulo-dedicado-★-novo-missão-6)).

| Plano | Público | Marcas inclusas | Tier incluso | Créditos/mês |
|---|---|---|---|---|
| **Starter** | Pequenos negócios testando o produto | 1 | Econômico | 100 |
| **Pro** | Negócios com produção recorrente | 1 | Balanceado | 500 |
| **Business** | Múltiplos clientes/marcas | até 5 | Premium | 1.500 |

`*` "Ilimitado" (revisões anteriores) reformulado nesta revisão: não existe um contador de cota separado — o limite de uso de cada plano **é** a quantidade de créditos concedida por mês (`grant_plan`, [database.md §7.2](docs/database.md#72-credit_ledger)). Sem cobrança incremental por marca extra no Business por enquanto — decisão futura se surgir demanda real ([architecture.md §10, item 10](docs/architecture.md#10-decisões-em-aberto-arquitetura)). Resolve o item 5 de §13.

Custo em créditos deliberadamente baixo no raciocínio estratégico (Intelligence Hub) e concentrado na geração de mídia (Asset Engine, quando implementado) — decisão de produto explícita: incentivar uso intenso do "cérebro" da plataforma, cobrar principalmente pelo que tem custo computacional real. Ver [database.md §7.3](docs/database.md#73-credit_pricing) para os valores.

### 8.1 Tier de Provedor (não é escolha de fornecedor)

O cliente **nunca** escolhe OpenAI, Claude, ElevenLabs, HeyGen ou qualquer fornecedor específico. Ele escolhe apenas um **nível**:

| Tier | Proposta |
|---|---|
| **Econômico** | Menor custo, geração mais rápida, qualidade adequada para volume alto. |
| **Balanceado** | Equilíbrio entre custo e qualidade — default recomendado. |
| **Premium** | Máxima qualidade, inclui uso mais intenso do Intelligence Hub (mais diversidade de modelos entre especialistas). |

O sistema decide internamente, por trás do tier escolhido, quais fornecedores concretos usar em cada geração — essa decisão é 100% interna (ver [docs/architecture.md](docs/architecture.md#5-provider-layer-adapters-plugáveis)).

**Créditos extras:** consumíveis, comprados sob demanda, usados para geração que exceda a cota do plano — o custo em créditos pode variar por tier escolhido.

## 9. Escopo do MVP

### 9.1 Incluído no MVP

1. **Onboarding conversacional** ("Conheça sua empresa") — conversa estratégica com a Ayon que popula o Brand Brain (Princípio do Consultor Permanente, §1.1).
2. **Ensinar a empresa à IA** ("Ensine sua empresa para a IA") — upload de documentos/materiais/conteúdos passados para a base de conhecimento da marca.
3. **O que está em alta** — descoberta e ranqueamento de tendências relevantes ao nicho da marca.
4. **Criar campanha** — geração de estratégia via Intelligence Hub (painel de especialistas + Coordinator) e produção do pacote de conteúdo completo (§4.3) no(s) modo(s) de produção aplicável(is).
5. **Revisão e aprovação** — fluxo de aprovação humana antes da entrega final do pacote (sempre obrigatório, para todos os planos).
6. **Pacote de conteúdo para download** — entrega final em formato de pacote (zip) com todos os formatos gerados. **Sem publicação automática em redes sociais no MVP.**
7. **O que funcionou** — sugestões de ajuste de estratégia baseadas em aprendizado contínuo, sempre pendentes de aprovação humana explícita.
8. **Biblioteca de mídia da marca** — upload e organização de mídia própria para uso nas gerações.
9. **Escolha de tier de provedor** (Econômico/Balanceado/Premium) — sem exposição de fornecedores específicos.
10. **Billing e créditos** — assinatura de plano + compra de créditos avulsos.
11. **Painel de uso** — visibilidade de consumo de créditos/cota por marca.

### 9.2 Fora do escopo do MVP (backlog futuro)

- **Publicação automática em redes sociais** — mesmo no plano Business, o MVP não publica automaticamente; é 100% entrega de pacote para download (reavaliar como fase 2 do produto);
- Multi-agência completa (um admin gerenciando N clientes com faturamento por cliente);
- Clonagem de voz custom por upload de áudio do cliente;
- Editor visual avançado (timeline manual de vídeo);
- App mobile nativo;
- Exposição de configuração de fornecedor a qualquer usuário final (mesmo admin) — tier é o único controle exposto.

> Qualquer item movido do backlog para o MVP deve gerar atualização deste PRD antes de virar tarefa de desenvolvimento.

## 10. Stack Tecnológico e Camada de Provedores

A stack define a fundação técnica (frontend, dados, orquestração) e os fornecedores iniciais de cada capacidade — sempre escondidos atrás de um tier de qualidade/custo, nunca escolhidos diretamente pelo cliente.

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend/Dados | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Orquestração/automação | n8n |
| **LLM Provider** (fornecedor inicial) | OpenAI e/ou Claude (Anthropic) |
| **Avatar Provider** (fornecedor inicial) | HeyGen |
| **Voice Provider** (fornecedor inicial) | ElevenLabs |
| **Media Provider** (fornecedor inicial) | a definir — ver §13.6 |
| **Trend Source Provider** | Anthropic (busca web nativa) — ver [architecture.md §3.3](docs/architecture.md#33-trend-engine) |
| **Billing** (Missão 6 — módulo dedicado, não Provider Layer) | Mercado Pago (assinatura recorrente + pagamento avulso) — ver [architecture.md §12](docs/architecture.md#12-billing-módulo-dedicado-★-novo-missão-6) |

Detalhamento de como essas peças se conectam em [docs/architecture.md](docs/architecture.md).

## 11. Métricas de Sucesso

- Tempo médio de "conversa inicial → pacote de conteúdo pronto";
- Nº de campanhas geradas por marca ativa/mês;
- Taxa de aprovação sem retrabalho;
- **Taxa de aceitação de sugestões do "O que funcionou"** (sinal de que o Brand Evolution está gerando valor real);
- Retenção mensal de marcas ativas;
- Distribuição de uso por tier de provedor (sinal de precificação/custo).

## 12. Glossário

- **Organização (Org):** conta cliente, pode conter múltiplas marcas (plano Business).
- **Marca (Brand):** identidade de conteúdo — unidade central de trabalho.
- **Campanha:** conjunto de conteúdos gerados a partir de uma estratégia/tendência.
- **Peça de conteúdo (Content Piece):** unidade individual dentro de uma campanha.
- **Pacote de Conteúdo (Content Package):** conjunto de todas as peças de uma campanha, entregue para download.
- **Modo de produção:** como uma peça visual é materializada (avatar, vídeo licenciado, mídia própria, híbrido, texto).
- **Crédito:** unidade consumível para geração que excede a cota do plano.
- **Core Engine:** módulo interno de lógica de produto, nunca exposto por nome ao usuário (Brand Brain, Knowledge Base, Trend Engine, Asset Engine, Learning Engine, Intelligence Hub).
- **Brand Brain:** identidade operante da marca (alimentada pelo onboarding conversacional e pelo Brand Evolution); exposta como "Conheça sua empresa".
- **Knowledge Base:** conhecimento retrivável da marca; exposta como "Ensine sua empresa para a IA".
- **Trend Engine:** descoberta/ranqueamento de tendências; exposta como "O que está em alta".
- **Asset Engine:** materialização das peças de conteúdo; parte de "Criar campanha".
- **Learning Engine:** motor de aprendizado contínuo; produto exposto como **Brand Evolution** / "O que funcionou".
- **Intelligence Hub:** painel de especialistas de IA + Coordinator AI que decide toda estratégia/decisão importante.
- **Especialista (Specialist Agent):** papel de IA dentro do Intelligence Hub (Marketing, Copy, Branding, Nicho, SEO, Redes Sociais, Dados).
- **Coordinator AI:** papel que consolida as opiniões dos especialistas em uma estratégia única.
- **Provider (Provedor plugável):** adapter substituível que implementa uma capacidade externa (LLM, Avatar, Voice, Media, Trend Source).
- **Tier de Provedor:** nível de qualidade/custo escolhido pelo cliente (Econômico, Balanceado, Premium) — nunca o fornecedor em si.

## 13. Decisões em Aberto (precisam de aprovação antes de virar escopo)

1. ~~**Especialistas do Intelligence Hub:** os 7 listados rodam sempre todos juntos para toda campanha, ou o conjunto varia por tipo de decisão?~~ **Resolvido arquiteturalmente (revisão 10) e implementado (revisão 11):** o conjunto agora é dado, não código — cada especialista declara em quais tipos de decisão participa (`applies_to` no Specialist Registry, [architecture.md §4.1](docs/architecture.md#41-specialist-registry-especialistas-plugáveis-★-novo-revisão-10)). Seed em produção: Marketing Strategy, Branding e Copywriting (`campaign_strategy`); Marketing Strategy e Branding também cobrem `trend_ranking` (Missão 5); 1 Coordinator, generalizado para ser independente do tipo de decisão (Missão 5, migration `0007`). ~~Ainda pendente: revisão do conteúdo exato de cada `system_prompt`.~~ **Resolvido (revisão 13):** os 4 prompts passaram por validação qualitativa real e foram aprovados pelo dono do produto — ver [architecture.md §10, item 7](docs/architecture.md#10-decisões-em-aberto-arquitetura) e [docs/prompts/](docs/prompts/). Especialistas adicionais continuam sendo decisão de produto a fechar conforme a necessidade de cada missão futura.
2. **Mapeamento tier → fornecedor:** que fornecedores concretos compõem cada tier (Econômico/Balanceado/Premium) por capacidade (LLM/Avatar/Voice/Media)? Isso é uma decisão de custo/qualidade a ser fechada antes da implementação da Provider Layer.
3. ~~**Frequência do Brand Evolution:** a cada quantas aprovações/rejeições uma nova sugestão é gerada? Existe um mínimo de dados antes da primeira sugestão aparecer?~~ **Resolvido (preparação Missão 8, Learning Engine):** análise sob demanda (usuário aciona, sem cron/n8n), com mínimo de 5 `learning_signals` (aprovação/rejeição/edição de peça) não usados numa análise anterior antes de qualquer sugestão poder ser gerada — evita sugestão fraca a partir de 1-2 eventos. Gratuito em todos os planos. Ver [architecture.md §3.6](docs/architecture.md#36-learning-engine-produto-brand-evolution) e [flows.md, Fluxo 8](docs/flows.md#fluxo-8--o-que-funcionou-brand-evolution--learning-engine).
4. ~~Quais formatos do pacote de conteúdo (§4.3) são gerados sempre, e quais são opcionais/configuráveis por campanha?~~ **Resolvido para o MVP da Missão 7:** todos os 9 formatos continuam previstos por campanha — os 5 textuais (legenda, blog, email, roteiro, teleprompter) são sempre gerados por IA; os 4 visuais (vídeo, stories, carrossel, thumbnail) exigem que o cliente envie o próprio arquivo (upload manual, `production_mode = own_media`) até o Media/Avatar/Voice Provider existirem. Nenhum formato é opcional/configurável ainda — essa granularidade fica para quando a geração automática de mídia existir. Ver [architecture.md §3.5](docs/architecture.md#35-asset-engine).
5. ~~Limites numéricos exatos por plano (cota de campanhas, nº de marcas no Starter/Pro).~~ **Resolvido (Missão 6):** ver §8 — sem contador de cota separado, o limite é o `grant_plan` de créditos mensal (Starter 100 / Pro 500 / Business 1.500), 1 marca em Starter/Pro, até 5 em Business.
6. Banco de vídeos públicos licenciados: qual provedor/fonte será integrado como Media Provider inicial?
7. ~~A conversa inicial de onboarding ("Conheça sua empresa") é síncrona (chat em tempo real) ou pode ser feita em etapas assíncronas (ex: e-mail com perguntas)?~~ **Resolvido (revisão técnica pré-Missão 2):** síncrona — interface de chat em tempo real, com persistência por resposta permitindo pausar/retomar a qualquer momento (nunca por e-mail em etapas). Já especificado em detalhe em [ux-design.md §4.2](docs/ux-design.md#42-conversa-com-o-consultor-onboarding-conversacional) e [architecture.md §6](docs/architecture.md#6-conversa-de-onboarding-arquitetura).
8. ~~**Persona da Ayon:** ela se apresenta sempre na primeira pessoa sem nome próprio, ou ganha um nome/identidade mais pessoal?~~ **Resolvido (revisão técnica pré-Missão 2):** "Ayon" é o nome da consultora — já usado consistentemente em primeira pessoa em todo exemplo de copy deste documento e de `ux-design.md`. Não é "sem nome": a interface pode e deve se referir a ela como Ayon (ex: cabeçalho da conversa, mensagens).
9. **Atalho de contexto por link:** vale, já no MVP, aceitar um link de site/Instagram no início da conversa "Conheça sua empresa" para a Ayon chegar com "dever de casa feito" (reduz o que precisa ser perguntado do zero)? Implica capacidade de leitura externa ainda não modelada em [docs/architecture.md](docs/architecture.md). **Ainda em aberto** — recomendação: adiar para depois da v1 da Missão 2, não bloqueia o início da implementação.

## 14. Histórico

Ver [docs/changelog.md](docs/changelog.md) para o registro de todas as mudanças de escopo, com data e motivo.
