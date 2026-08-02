# PRD — Ayon Creator

> **Status do documento:** Rascunho v1.0 (revisão 3 — filosofia de produto e Intelligence Hub) — aguardando aprovação
> **Última atualização:** 2026-08-01
> **Regra do projeto:** Nenhuma linha de código é escrita sem que a funcionalidade correspondente esteja documentada aqui (e nos documentos irmãos: [architecture.md](docs/architecture.md), [database.md](docs/database.md), [flows.md](docs/flows.md)) **e aprovada pelo dono do produto**. Todo pedido de nova funcionalidade dispara atualização destes 4 documentos, nessa ordem, antes de qualquer implementação. Histórico de mudanças em [docs/changelog.md](docs/changelog.md).

---

## 1. Visão Geral

**A Ayon Creator não é um gerador de conteúdo. É um Sistema Operacional de Marketing orientado por IA.**

Ela não entrega "peças avulsas" — ela conhece a empresa do cliente, entende o que está em alta no mercado dele, pensa a estratégia como faria uma equipe de especialistas de marketing, produz o material necessário para executar essa estratégia, e aprende continuamente o que funciona, sempre devolvendo essa aprendizagem ao usuário como sugestão — nunca como mudança automática e silenciosa de comportamento.

Ela substitui o papel que hoje seria de uma pequena equipe (estrategista, redator, designer, social media, analista de dados) por um sistema orientado por IA, operado por um único usuário.

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

### 4.4 Brand Evolution — aprendizado contínuo com aprovação humana

A Ayon Creator aprende continuamente com o uso (aprovações, rejeições, edições, e futuramente performance publicada), mas **nunca altera o comportamento da marca automaticamente**. Toda aprendizagem vira uma sugestão explícita, apresentada em linguagem simples, que o usuário aceita ou recusa. Exemplo de interação real do produto:

> "Percebemos que vídeos de até 35 segundos performam melhor. Deseja atualizar sua estratégia?"

Na interface, esta capacidade aparece como **"O que funcionou"**.

### 4.5 Onboarding Conversacional

Não há formulário de cadastro de marca. O onboarding é uma **entrevista conduzida pela IA** ("Conheça sua empresa"), que conversa com o cliente para extrair:

- História da empresa
- Produtos
- Clientes
- Tom de voz
- Concorrentes
- Objetivos
- Diferenciais
- Palavras proibidas
- Palavras favoritas

As respostas alimentam diretamente o Brand Brain (identidade operante da marca) e ficam também registradas como conhecimento bruto pesquisável ("Ensine sua empresa para a IA").

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
- **Onboarding conversacional**: a IA entrevista o cliente, em vez de formulários frios;
- **Pacote de conteúdo completo** por campanha (vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro, teleprompter);
- **Simplicidade de fornecedor**: o cliente escolhe um nível de qualidade/custo (Econômico, Balanceado, Premium) — nunca precisa saber ou escolher qual IA está por trás;
- **Arquitetura modular e agnóstica de fornecedor** internamente — protege o produto de dependência de qualquer IA específica (ver [docs/architecture.md](docs/architecture.md));
- Multi-marca desde a arquitetura, permitindo evolução para agências sem retrabalho.

## 8. Modelo de Negócio

SaaS por assinatura, com 3 planos + créditos avulsos.

| Plano | Público | Inclui |
|---|---|---|
| **Starter** | Pequenos negócios testando o produto | Geração de conteúdo limitada (cota mensal), 1 marca |
| **Pro** | Negócios com produção recorrente | Conteúdo ilimitado*, todos os formatos, tier de provedor "Balanceado" incluso |
| **Business** | Múltiplos clientes/marcas | Múltiplas marcas, times/permissões, tier de provedor "Premium" incluso |

`*` "Ilimitado" sujeito a fair use e a consumo de créditos.

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

1. **Onboarding conversacional** ("Conheça sua empresa") — entrevista guiada por IA que popula o Brand Brain.
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

Detalhamento de como essas peças se conectam em [docs/architecture.md](docs/architecture.md).

## 11. Métricas de Sucesso

- Tempo médio de "briefing/entrevista → pacote de conteúdo pronto";
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

1. **Especialistas do Intelligence Hub:** os 7 listados (Marketing, Copy, Branding, Nicho, SEO, Redes Sociais, Dados) rodam sempre todos juntos para toda campanha, ou o conjunto varia por tipo de decisão (ex: estratégia de campanha usa os 7, geração de uma legenda avulsa usa só Copy + Branding)?
2. **Mapeamento tier → fornecedor:** que fornecedores concretos compõem cada tier (Econômico/Balanceado/Premium) por capacidade (LLM/Avatar/Voice/Media)? Isso é uma decisão de custo/qualidade a ser fechada antes da implementação da Provider Layer.
3. **Frequência do Brand Evolution:** a cada quantas aprovações/rejeições uma nova sugestão é gerada? Existe um mínimo de dados antes da primeira sugestão aparecer?
4. Quais formatos do pacote de conteúdo (§4.3) são gerados sempre, e quais são opcionais/configuráveis por campanha?
5. Limites numéricos exatos por plano (cota de campanhas, nº de marcas no Starter/Pro).
6. Banco de vídeos públicos licenciados: qual provedor/fonte será integrado como Media Provider inicial?
7. A entrevista de onboarding ("Conheça sua empresa") é síncrona (chat em tempo real) ou pode ser feita em etapas assíncronas (ex: e-mail com perguntas)?

## 14. Histórico

Ver [docs/changelog.md](docs/changelog.md) para o registro de todas as mudanças de escopo, com data e motivo.
