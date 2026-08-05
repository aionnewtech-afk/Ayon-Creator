# PRD — Ayon Creator

> **Status do documento:** v1.0 (revisão 29 — Missão 12 aprovada, ajustes incorporados) — dono do produto aprovou o Super Admin completo (§9.5) com 9 ajustes: 2 papéis administrativos (`super_admin`/`support_admin`, não só um) com matriz de capacidades explícita; `plans` com um conjunto de campos bem mais amplo, preparando o modelo de negócio para migrar de "só crédito" para "crédito + limite por recurso"; banner de impersonação com texto exato e sem botão de fechar; `provider_call_logs` com modelo/endpoint/tokens/request ID; Feedbacks virando CRM interno; Dashboard e Organizações com métricas/campos ampliados; gestão real de Providers (API key sem tocar `.env`); e o bypass de créditos/limites aplicado aos 2 papéis administrativos, não só a `super_admin`. Implementação autorizada. Decisões residuais não relacionadas à filosofia seguem listadas em §13 e podem ser resolvidas durante o desenvolvimento, conforme necessidade.
> **Última atualização:** 2026-08-05
> **Mudança da revisão 27 (Missão 11 aprovada, ressalva de composição resolvida):** dono do produto exigiu análise arquitetural real (pesquisa, não suposição) comparando Shotstack com ferramentas dedicadas de design-automation antes de implementar a composição de `stories`/`carousel`/`thumbnail` — feita, documentada em [architecture.md §14.4.1](docs/architecture.md#1441-análise-arquitetural--mecanismo-de-composição-★-exigido-pelo-dono-do-produto-antes-do-código); a pesquisa real também corrigiu um erro da revisão anterior (o mecanismo proposto, asset `html` do Shotstack, está sendo descontinuado e nunca suportou imagem dentro do HTML — substituído por timeline em camadas, mesma técnica já validada no vídeo). 2 novos requisitos incorporados: múltiplas opções por peça quando financeiramente viável (§9.4 item 5), e identidade visual consistente entre todas as peças de uma mesma campanha (§9.4 item 5). Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 26 (Missão 11 aprovada, escopo ajustado):** dono do produto aprovou a revisão 25 com ajustes substanciais em §9.4: identidade visual vira "ativo permanente" com 5 campos (não só logo+cor); **legenda removida do vídeo** (contradição resolvida com o item de qualidade explícito, que também deixa de citar legenda); narração ganha seleção automática de voz por marca (nicho/público/tom/idioma), `default_voice_ref` como override manual; seleção de mídia passa a ser por trecho do roteiro, não uma busca única; `stories`/`carousel`/`thumbnail` ganham composição real (branding+tipografia+layout), não só foto+logo; progresso ganha percentual e tempo estimado; player ganha copiar link + preparação arquitetural (não implementação) para publicação futura em Instagram/Facebook. Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 25 (preparação Missão 11, Refinamento da Experiência de Geração de Conteúdo):** nova §9.4 — missão exclusivamente de refinamento (nenhum Core Engine/capability novo do Provider Gateway), atacando qualidade percebida do pacote gerado: identidade visual automática (logo + cor da marca), legendas sem corte, narração menos artificial, geração automática também para `stories`/`carousel`/`thumbnail` (upload manual permanece como alternativa), thumbnail com composição inteligente, vídeo com transições/ritmo, seleção de cenas mais relevante, progresso granular durante a geração, player com baixar/compartilhar. Auditoria prévia (docs/changelog.md) encontrou: `ElevenLabsVoiceProvider` nunca aplica `voice_settings`/`voiceRef` (sempre usa a voz padrão, mesmo com `brand_brain_profiles.default_voice_ref` já existente no schema desde a Missão 2 e nunca lido); seleção de cenas repete deliberadamente o último candidato quando a busca esgota antes da duração total; `brands` não tem nenhum campo de identidade visual. Decisões do dono do produto após a auditoria: sem novos formatos no pacote (`Capa`/`Imagem do Feed` ficam fora, só `stories`/`carousel`/`thumbnail` ganham geração automática); imagens vêm de banco de fotos licenciadas (Pexels Photos), não de geração por IA; cada formato mantém seu próprio botão "Gerar automaticamente" (sem botão único "Gerar tudo"); cor da marca é um campo manual no Perfil da Marca (definido 1x, aplicado automaticamente depois). Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 24 (Missão 10 aprovada, escopo ajustado):** dono do produto aprovou a documentação e pediu 2 ajustes antes do código: categoria ganha uma 4ª opção **Outro** (nem toda mensagem se encaixa em Sugestão/Bug/Dificuldade); e captura automática de contexto (rota atual, versão da aplicação, navegador) junto de cada envio, para nunca precisar perguntar "em qual tela aconteceu?" depois. Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 23 (preparação Missão 10):** nova §9.3 — botão global "Enviar feedback" (sugestão/bug/dificuldade de uso), grava em `user_feedback` (data, usuário, marca, categoria, descrição). Utilitário transversal, não um Core Engine — mesmo raciocínio já usado para justificar o Billing como módulo dedicado (arch. §12). Sem interface administrativa nesta missão, por decisão explícita do dono do produto. Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 22 (Missão 9 dividida em 2 etapas):** decisão do dono do produto — reduzir o risco de retrabalho começando por uma fatia vertical menor, mesmo princípio de "uma fatia por vez" já usado em todas as missões anteriores. **Etapa 1 (MVP real da Missão 9):** só `licensed_stock_video` — narração via ElevenLabs + cenas via Pexels + composição via Shotstack, pipeline completo de ponta a ponta (roteiro → narração → cenas → MP4). **Etapa 2 (futura, recurso Premium):** `ai_avatar` (HeyGen) e `hybrid` (que depende de avatar) — a Provider Layer permanece preparada para HeyGen desde já (contrato `avatar` documentado, [architecture.md §5](docs/architecture.md#5-provider-layer-adapters-plugáveis-resolvidos-por-tier)), mas **nenhuma implementação de avatar bloqueia o fechamento da Etapa 1**. Quando implementado, avatar de IA passa a ser um recurso exclusivo do tier Premium — decisão de produto nova desta revisão, não apenas um adiamento técnico. Ver [docs/changelog.md](docs/changelog.md).
> **Mudança da revisão 21 (Missão 9 aprovada):** dono do produto aprovou a documentação da revisão 20 e fechou as decisões restantes: modos `stock_video`/`ai_avatar`/`hybrid` confirmados (mapeados a `licensed_stock_video`/`ai_avatar`/`hybrid` no schema — §4.2), nome "Asset Engine" mantido, `video_render` confirmado como capability nova do Provider Gateway, n8n confirmado como orquestrador oficial dos pipelines assíncronos. **Fornecedores concretos definidos para o MVP** (§10, §13 itens 2/6/10 resolvidos): Voice Provider = **ElevenLabs**, Avatar Provider = **HeyGen** (ambos já eram o fornecedor inicial documentado desde a revisão 3, nunca implementados até agora), Media Provider = **Pexels** (banco de vídeo licenciado, API gratuita para uso comercial — escolha adequada a um MVP sensível a custo, filosofia já registrada em §8), Video Render Provider = **Shotstack** (composição de vídeo via API, timeline em JSON, suporta 9:16 e legendas — contrato compatível com `composeVideo` já especificado em [architecture.md §3.5.1](docs/architecture.md#351-geração-automática-de-vídeo-★-novo-preparação-missão-9)). Mapeamento **tier → fornecedor** resolvido para o MVP como um único fornecedor por capability, sem variação por tier ainda (diferenciação por tier dentro de cada capability fica para quando houver demanda real de custo/qualidade — mesmo raciocínio já usado para o Coordinator/especialistas do Intelligence Hub). Valores exatos de créditos (`video_generation`, item 11) permanecem em aberto, por decisão explícita do dono do produto. Ver [docs/changelog.md](docs/changelog.md) para o relato completo.
> **Mudança da revisão 20 (preparação Missão 9):** o **Asset Engine** (nome interno mantido — decisão explícita do dono do produto: não é um rebranding para "Multimedia Engine", só uma expansão de responsabilidade) ganha capacidade de gerar vídeo automaticamente, ativando pela primeira vez os modos de produção `ai_avatar`, `licensed_stock_video` e `hybrid` já documentados desde a revisão 3 (§4.2) mas nunca implementados. Escopo do MVP desta missão: vídeo vertical 9:16, narração por IA, montagem automática (avatar de IA e/ou banco de vídeo licenciado), legendas, exportação em MP4, integração ao pacote final da campanha. Isso ativa 3 capacidades novas na Provider Layer (Avatar, Voice, Media, já previstas na stack desde a revisão 3, mas nunca implementadas) mais uma capacidade inteiramente nova, **Video Render** (composição final de cenas + narração + legenda em um vídeo único — ver [architecture.md §5](docs/architecture.md#5-provider-layer-adapters-plugáveis-resolvidos-por-tier)), e ativa o **n8n** oficialmente na arquitetura pela primeira vez, como orquestrador dos pipelines assíncronos de geração de vídeo (ver [architecture.md §8](docs/architecture.md#8-papel-do-n8n)). Geração de vídeo passa a ter precificação própria em créditos, separada da geração de texto — valores exatos permanecem decisão em aberto (§13, novo item 10). Fornecedores concretos de Media Provider, Video Render Provider, Avatar Provider e Voice Provider seguem em aberto (§13, itens 2 e 6) — bloqueiam o início do código desta missão, não a preparação da documentação. Ver [docs/changelog.md](docs/changelog.md) para o relato completo da auditoria que precedeu esta revisão.
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

> **A partir da Missão 9 (revisão 22 — dividida em 2 etapas):** para o formato `video` do pacote de conteúdo — ver [architecture.md §3.5](docs/architecture.md#35-asset-engine). **Etapa 1:** só **Vídeos públicos licenciados** (`licensed_stock_video`) ganha implementação real. **Etapa 2 (futura, recurso Premium):** **Avatar de IA** e **Híbrido** — documentados e com contrato de Provider Layer preparado, mas não implementados até a Etapa 1 fechar. `stories`/`carousel`/`thumbnail` continuam `own_media` (upload manual), fora de escopo em ambas as etapas.
>
> **A partir da Missão 11 (§9.4):** `stories`/`carousel`/`thumbnail` ganham um novo modo, **Fotos públicas licenciadas** (`licensed_stock_photo`) — mesmo espírito de `licensed_stock_video`, agora para imagem. Diferente do `video` (que substituiu o upload manual por completo na Missão 9), aqui o upload manual **continua disponível como alternativa** — decisão explícita do dono do produto, cada peça oferece as duas opções lado a lado.

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
4. **Criar campanha** — geração de estratégia via Intelligence Hub (painel de especialistas + Coordinator) e produção do pacote de conteúdo completo (§4.3) no(s) modo(s) de produção aplicável(is), incluindo, a partir da Missão 9 (Etapa 1), geração automática de vídeo a partir de banco de vídeo licenciado: vídeo vertical 9:16, narração por IA, montagem automática de cenas, legendas e exportação em MP4, integrado ao pacote final da campanha (§4.3) como qualquer outro formato. Avatar de IA fica para a Etapa 2 (recurso Premium — §4.2). A partir da Missão 11 (§9.4), `stories`/`carousel`/`thumbnail` também podem ser gerados automaticamente (banco de fotos licenciadas + identidade visual da marca), com upload manual mantido como alternativa; a peça de vídeo ganha identidade visual automática, legendas revisadas, narração mais natural, seleção de cena mais relevante e progresso granular durante a geração.
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

### 9.3 Feedback do Usuário ★ novo (Missão 10)

Canal simples para o usuário reportar sugestões, bugs ou dificuldades de uso sem sair da plataforma — não é um Core Engine nem um módulo de produto (mesma lógica de "por que não é X" já usada para o Billing, §10/arch. §12): é um utilitário transversal, disponível em qualquer tela autenticada.

- **Escopo do MVP desta missão:** botão "Enviar feedback" acessível globalmente (layout autenticado), abre um modal simples com categoria (Sugestão / Bug / Dificuldade de uso / **Outro**) e descrição em texto livre. Ao enviar, grava data, usuário, marca/organização, categoria, descrição e **contexto automático** (rota atual, versão da aplicação, navegador — capturado sem exigir nada do usuário, decisão do dono do produto: "evita que eu precise perguntar depois em qual tela isso aconteceu") — sem confirmação além de um toast simples.
- **Explicitamente fora de escopo agora:** nenhuma interface administrativa de leitura/triagem do feedback recebido (decisão do dono do produto) — consulta, quando necessária, é direta no banco. Sem resposta ao usuário, sem status (aberto/resolvido), sem anexos/screenshot.
- Não afeta nenhum Core Engine existente, nenhum fluxo de créditos, nenhuma peça de conteúdo.

### 9.4 Refinamento da Experiência de Geração de Conteúdo ★ Missão 11 aprovada, escopo ajustado

Missão exclusivamente de refinamento — **nenhum Core Engine novo, nenhuma capability nova no Provider Gateway, nenhuma arquitetura redesenhada.** Objetivo: o pacote de conteúdo gerado parecer produzido por uma agência profissional, aumentando o valor percebido do produto antes de qualquer investimento futuro em avatar de IA (Etapa 2 da Missão 9).

**Escopo do MVP desta missão (aprovado, com ajustes do dono do produto):**

1. **Identidade visual como ativo permanente da marca:** logo, cor primária, cor secundária, fonte (opcional) e estilo visual — todos definidos **uma vez** no Perfil da Marca (§4.12/arch. §14.1), aplicados automaticamente em todo vídeo, thumbnail, stories, carrossel e qualquer formato de imagem futuro, sempre que a IA gera conteúdo — sem nenhuma configuração por peça. Marca sem logo cadastrado gera normalmente, com o layout se adaptando para nunca deixar espaço vazio (arch. §14.8).
2. **Sem legenda embutida no vídeo** — decisão do dono do produto (ajuste desta revisão): a legenda foi removida do escopo, simplificando o pipeline de narração/composição (arch. §14.2). Não confundir com o formato textual "Legenda" do pacote (§4.3), que não muda.
3. **Narração com voz escolhida automaticamente por marca:** o pipeline passa a escolher a voz mais adequada considerando nicho, público, tom de voz e idioma da marca — não apenas ajustar parâmetros de síntese. `default_voice_ref` continua existindo para o usuário sobrescrever manualmente quando quiser (arch. §14.3).
4. **Seleção de mídia por trecho do roteiro:** em vez de uma única busca genérica para o vídeo inteiro, cada trecho do roteiro (ex. "Conheça Gramado..." → "Lago Negro..." → "Café colonial...") gera sua própria busca de cena específica, evitando repetição (arch. §14.7).
5. **Geração automática de mais formatos, com composição real:** `stories`, `carousel` e `thumbnail` passam a poder ser gerados automaticamente — não uma foto de banco com uma logo colada em cima, mas uma composição real (branding + tipografia + título + layout + elementos gráficos), mantendo o upload manual como alternativa em cada peça (arch. §14.4). Mecanismo de composição escolhido após análise arquitetural comparando Shotstack (fornecedor já contratado) com ferramentas dedicadas de design-automation — decisão registrada em arch. §14.4.1, exigida pelo dono do produto antes do código.
   - **Múltiplas opções:** quando financeiramente viável, mais de 1 candidato é gerado por peça na mesma rodada, e o usuário escolhe qual usar (arch. §14.4.2).
   - **Identidade visual consistente entre peças da mesma campanha:** decisões estilísticas feitas por IA (cor de destaque, redação do título curto, layout) são resolvidas uma vez por campanha, nunca peça a peça (arch. §14.4.3).
6. **Thumbnail inteligente:** mesma composição do item 5, com foco em parecer "feita por um designer" — título curto, boa leitura em miniatura, contraste e identidade visual (arch. §14.5).
7. **Vídeo com mais produção:** transições, zoom sutil quando fizer sentido, abertura/encerramento — sem aumentar significativamente o tempo de renderização (arch. §14.6).
8. **Branding inteligente/adaptativo:** logo aparece discretamente quando cadastrada; quando não há logo, o template se adapta automaticamente — nunca um espaço vazio (arch. §14.8).
9. **Progresso granular com percentual e tempo estimado:** estados específicos durante a geração assíncrona (etapa atual, ex. "Buscando cenas...", "Gerando narração...", "Renderizando...", "Aplicando identidade visual...", "Finalizando..."), acompanhados de percentual aproximado e, quando possível, tempo estimado restante — não mais um único texto genérico sem noção de progresso (arch. §14.9).
10. **Player melhor:** vídeo maior, baixar, copiar link, compartilhar (nativo do navegador) e gerar de novo (equivalente a "regenerar" — não há editor de vídeo, ver §9.2). Arquitetura preparada (não implementada) para uma futura publicação direta em Instagram/Facebook, reaproveitando `publishing_channels`/`publications` já documentadas (arch. §14.10).

**Explicitamente fora de escopo desta missão:**

- Novos formatos no pacote (`Capa`, `Imagem do Feed`) — decisão do dono do produto após a auditoria, para não expandir o schema do pacote nesta missão.
- Geração de imagem por IA generativa (novo Provider) — imagens vêm de banco de fotos licenciadas (Pexels) compostas via o Video Render Provider já contratado (Shotstack), mesmo fornecedor.
- Botão único "Gerar tudo de uma vez" — cada formato automático mantém seu próprio botão, mesmo padrão já validado do vídeo (Missão 9).
- Editor de vídeo/timeline manual — já fora de escopo do MVP (§9.2); "editar" no player significa editar o roteiro e gerar de novo, não recompor a timeline manualmente.
- Publicação automática de fato em redes sociais — o botão Compartilhar desta missão é client-side (Web Share API/copiar link); a arquitetura fica preparada para uma implementação futura, não implementada agora (§9.2).
- Avatar de IA (HeyGen) — permanece na Etapa 2 da Missão 9, sem relação com esta missão.

**Validação obrigatória antes de encerrar (critério de conclusão explícito, dono do produto):** pelo menos 5 vídeos reais (Todo Canto, destinos/roteiros diferentes) aprovados visualmente, cobrindo: voz soando natural, vídeo com aparência profissional, branding consistente em todas as peças, e stories/thumbnails parecendo trabalho de designer — mesmo princípio de validação real de toda missão anterior. A missão só é considerada concluída quando os 5 vídeos forem aprovados visualmente.

### 9.5 Super Admin — Plataforma Administrativa ★ Missão 12 aprovada

Não é uma funcionalidade para clientes — é a infraestrutura para **operar, monitorar e testar a plataforma sem depender do Supabase Studio**, restrita a **2 papéis novos**, `super_admin` e `support_admin` (★ ajuste do dono do produto), de escopo de **plataforma inteira** (não de organização, diferente de `owner`/`admin`/`editor`/`viewer` — §8).

**Achado de auditoria (antes de qualquer rascunho):** o pedido presumia que `is_super_admin()` e `has_role()` já existiam no banco — não existem. O que existe: `is_org_member()`/`is_org_admin()`/`is_org_editor()` (funções SQL de RLS, escopo por organização), `hasMinimumRole()` (TS, mesmo escopo), e nenhum conceito de papel de plataforma em lugar nenhum do schema. Também não existe hoje nenhum limite de vídeos/imagens/campanhas/usuários por plano (o modelo de cobrança é 100% por crédito), nem instrumentação de latência/custo/erro por chamada a provedor. Detalhe técnico completo: [architecture.md §15](docs/architecture.md#15-super-admin--plataforma-administrativa-★-missão-12).

**Modelo de acesso (decisão do dono do produto, todas as recomendações aceitas):**

1. `platform_admins` é uma tabela dedicada, não um valor de `organization_members.role` nem uma coluna em `user_profiles` — desacoplado por completo do papel que a pessoa tem dentro de qualquer organização. **2 papéis (★ ajuste, round 2):** `super_admin` (tudo — editar planos, editar providers, ajustar créditos, impersonar, excluir organizações, criar admins) e `support_admin` (impersonar, visualizar tudo, responder feedback, ajustar créditos — **sem** editar planos, editar providers, excluir organizações, criar admins, cancelar assinatura). Matriz completa: [architecture.md §15.1.1](docs/architecture.md#1511-matriz-de-capacidades).
2. O(s) admin(s) têm uma **organização própria dedicada** ("casa"), ilimitada, para testar qualquer funcionalidade do produto sem tocar em dado de cliente real.
3. **Impersonação** ("Entrar como organização") é um mecanismo separado, disponível para os 2 papéis, para suporte/diagnóstico dentro de uma organização de cliente real — nunca consome o saldo de créditos daquela organização (o bypass acompanha quem está agindo, não a organização visitada, independente de qual dos 2 papéis); a organização visitada nunca vê nenhuma cobrança pelo uso do admin. **UI obrigatória e inescapável (★ ajuste, round 2):** barra fixa no topo, sem botão de fechar — "Você está visualizando como: [Organização]" + "Sair da impersonação".
4. Os limites de vídeos/imagens/campanhas/usuários pedidos na tela de Planos entram **só como campos editáveis** nesta missão — sem nenhum bloqueio real de criação nos fluxos existentes (decisão explícita do dono do produto, para não expandir o escopo para dentro de Server Actions já em produção). Virar bloqueio de verdade é uma missão futura, escopada separadamente — **mas já deve reutilizar o mesmo bypass de admin desta missão quando isso acontecer** (★ ajuste, round 2, item 9).
5. **`plans` ganha um conjunto de campos bem maior que o originalmente pedido (★ ajuste, round 2, item 1)** — o modelo de negócio está migrando de "só crédito" para "crédito + limite por recurso"; a tabela já fica preparada (marcas/usuários/campanhas/vídeos por mês/imagens por mês, armazenamento, fila prioritária, vídeo com IA, API, personalização de marca, times, white-label) para não exigir migration nova daqui a poucos meses, mesmo que vários desses campos fiquem sem nenhuma validação ligada nesta missão (item 4 acima).

**Super Admin ilimitado (requisito obrigatório do pedido):** créditos infinitos, nenhuma cobrança/débito, nenhum bloqueio por assinatura inativa, nenhuma limitação de quantidade — sempre que o **ator autenticado** for `platform_admin` (★ ajuste, round 2 — aplicado aos 2 papéis, não só `super_admin`: uma sessão de suporte de `support_admin` impersonando um cliente real não pode debitar o cliente por engano, o que contradiria a decisão do item 3 acima), mesmo impersonando uma organização de cliente real. Centralizado num único ponto (o portão de crédito existente, `ensureSufficientCredits`/`recordConsumption`, [architecture.md §12.3](docs/architecture.md#123-onde-o-portão-de-crédito-é-verificado)) — nunca checagens de admin espalhadas por Server Actions/componentes individuais.

**Telas administrativas (menu dedicado, fora da navegação de cliente — "qualquer papel" = `super_admin` e `support_admin`; ações marcadas exigem `super_admin`):**

1. **Dashboard** (qualquer papel) — organizações, usuários, campanhas (criadas/concluídas), vídeos/imagens gerados, créditos (consumidos/disponíveis), planos, trials, uso por provedor, geração de IA por dia, erros recentes; **★ métricas ampliadas (round 2, item 6):** receita MRR, ARR, trials ativos, conversão trial→pago, créditos consumidos hoje, gasto estimado com IA hoje, margem estimada, providers mais utilizados — tudo lido do banco real (nenhum número mockado).
2. **Organizações** (qualquer papel; **excluir e cancelar assinatura exigem `super_admin`**) — listar/editar/bloquear/desbloquear/excluir (soft delete)/alterar plano/alterar créditos/renovar ou cancelar trial/**"Entrar como organização"** (impersonação); **★ campos visíveis ampliados (round 2, item 7):** plano, créditos, consumo do mês, quantidade de campanhas/vídeos/imagens, última atividade, data de criação.
3. **Usuários** (qualquer papel) — listar/editar/bloquear/desbloquear/alterar papel/redefinir senha/remover; organização, último login, status, função.
4. **Planos** (só `super_admin`) — editar Starter/Pro/Business (rótulo na UI livre; chave no banco continua `business` — ver decisão em §13) e o conjunto ampliado de campos (item 5 acima). Sem migration destrutiva.
5. **Trials** (qualquer papel) — criar/renovar/cancelar/alterar dias/converter em assinatura; dias restantes, expiração, status.
6. **Créditos** (qualquer papel) — saldo/histórico/compras/consumo/bônus por organização; adicionar/remover/ajustar, sempre gerando auditoria.
7. **Mercado Pago** (qualquer papel; **cancelar assinatura exige `super_admin`**) — visualizar assinatura/pagamentos/webhooks/status; sincronizar, reenviar webhook, cancelar assinatura.
8. **Feedbacks** (qualquer papel) — consome `user_feedback` (Missão 10, até agora sem interface de leitura — §9.3); **★ vira CRM interno (round 2, item 5):** filtros por categoria, arquivar, responder internamente (nunca enviado ao usuário), marcar como resolvido, excluir, exportar CSV.
9. **Providers** (leitura: qualquer papel; **gestão exige `super_admin`**) — Anthropic/ElevenLabs/Pexels/Shotstack: latência, erros, custo estimado, chamadas, disponibilidade, e **★ campos ampliados (round 2, item 4):** modelo, endpoint, tokens de entrada/saída, créditos cobrados, request ID, status — dado real, com instrumentação nova nos 4 adapters existentes (nenhum provedor tem isso hoje). **★ Gestão real (round 2, item 8):** ativar/desativar provider, trocar provider padrão, trocar API key **sem alterar `.env`** (credencial passa a viver no banco), colocar em manutenção.
10. **Logs** (qualquer papel) — erros, pipelines, renderizações, n8n, pagamentos, providers, com filtro por data/organização/usuário/provedor.
11. **Branding** (qualquer papel) — visualizar todas as marcas; trocar logo/editar identidade/fontes/cores/ativos (mesmos campos do Perfil da Marca, Missão 11, agora com visão administrativa cross-organização).
12. **Auditoria** (qualquer papel) — toda ação administrativa registra usuário, **papel no momento da ação**, data, ação, antes, depois, IP e User-Agent (tabela nova, dedicada — `audit_logs` existente não muda, ver §13).
13. **Configurações** (só `super_admin`) — parâmetros globais/valores padrão/providers/créditos/planos/flags futuras.

**Fora do escopo desta missão:** bloqueio real de limites de plano (item 4 acima); qualquer funcionalidade nova para o cliente final; renomear `business` para `enterprise` no banco (decisão do dono do produto — §13); criptografia dedicada (pgsodium/Vault) para `provider_configs.credential_value` — protegida pela mesma política de RLS (só service role) já usada para todo segredo deste schema, sem introduzir uma camada nova só para esta missão.

## 10. Stack Tecnológico e Camada de Provedores

A stack define a fundação técnica (frontend, dados, orquestração) e os fornecedores iniciais de cada capacidade — sempre escondidos atrás de um tier de qualidade/custo, nunca escolhidos diretamente pelo cliente.

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend/Dados | Supabase (Postgres, Auth, Storage, Edge Functions) |
| **LLM Provider** (fornecedor inicial) | OpenAI e/ou Claude (Anthropic) |
| **Avatar Provider** (fornecedor inicial) | HeyGen — fornecedor definido, implementação adiada para a **Etapa 2 da Missão 9** (recurso Premium); Provider Layer já preparada para o contrato `avatar` desde já |
| **Voice Provider** (fornecedor inicial) | ElevenLabs |
| **Media Provider** (fornecedor inicial) | **Pexels** ★ definido (Missão 9) — banco de vídeo licenciado, API gratuita para uso comercial — ver §13.6 |
| **Video Render Provider** (fornecedor inicial) ★ novo (Missão 9) | **Shotstack** ★ definido — capacidade nova, composição final de vídeo (cenas + narração + identidade visual da marca → MP4, sem legenda embutida a partir da Missão 11, §9.4) via API com timeline em JSON; também compõe imagem (`stories`/`carousel`/`thumbnail`, Missão 11) via timeline em camadas (imagem+shape+texto, `output: jpg/png` — mecanismo escolhido após análise arquitetural comparando com ferramentas dedicadas de design-automation, [architecture.md §14.4.1](docs/architecture.md#1441-análise-arquitetural--mecanismo-de-composição-★-exigido-pelo-dono-do-produto-antes-do-código)); nunca um fornecedor de mídia/avatar/voz — ver §13.10 e [architecture.md §5](docs/architecture.md#5-provider-layer-adapters-plugáveis-resolvidos-por-tier) |
| **Trend Source Provider** | Anthropic (busca web nativa) — ver [architecture.md §3.3](docs/architecture.md#33-trend-engine) |
| **Orquestração/automação** | n8n — ativado oficialmente na Missão 9 (pipelines assíncronos de geração de vídeo), até então não implementado — ver [architecture.md §8](docs/architecture.md#8-papel-do-n8n) |
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
2. ~~**Mapeamento tier → fornecedor:** que fornecedores concretos compõem cada tier (Econômico/Balanceado/Premium) por capacidade (LLM/Avatar/Voice/Media/Video Render)?~~ **Resolvido para o MVP (revisão 21):** um único fornecedor por capability, o mesmo em todos os tiers — Voice = ElevenLabs, Avatar = HeyGen, Media = Pexels, Video Render = Shotstack (§10). O tier continua controlando o modelo de LLM (já implementado) e, futuramente, pode passar a variar fornecedor por capability também — não há necessidade real disso ainda, então fica adiado (mesmo raciocínio já usado para o LLM dos especialistas do Intelligence Hub, [architecture.md §10, item 5](docs/architecture.md#10-decisões-em-aberto-arquitetura)).
3. ~~**Frequência do Brand Evolution:** a cada quantas aprovações/rejeições uma nova sugestão é gerada? Existe um mínimo de dados antes da primeira sugestão aparecer?~~ **Resolvido (preparação Missão 8, Learning Engine):** análise sob demanda (usuário aciona, sem cron/n8n), com mínimo de 5 `learning_signals` (aprovação/rejeição/edição de peça) não usados numa análise anterior antes de qualquer sugestão poder ser gerada — evita sugestão fraca a partir de 1-2 eventos. Gratuito em todos os planos. Ver [architecture.md §3.6](docs/architecture.md#36-learning-engine-produto-brand-evolution) e [flows.md, Fluxo 8](docs/flows.md#fluxo-8--o-que-funcionou-brand-evolution--learning-engine).
4. ~~Quais formatos do pacote de conteúdo (§4.3) são gerados sempre, e quais são opcionais/configuráveis por campanha?~~ **Resolvido para o MVP da Missão 7:** todos os 9 formatos continuam previstos por campanha — os 5 textuais (legenda, blog, email, roteiro, teleprompter) são sempre gerados por IA; os 4 visuais (vídeo, stories, carrossel, thumbnail) exigem que o cliente envie o próprio arquivo (upload manual, `production_mode = own_media`) até o Media/Avatar/Voice Provider existirem. Nenhum formato é opcional/configurável ainda — essa granularidade fica para quando a geração automática de mídia existir. Ver [architecture.md §3.5](docs/architecture.md#35-asset-engine). **★ Ampliado na Missão 9 (preparação):** "até o Media/Avatar/Voice Provider existirem" deixa de ser uma condição futura indefinida — é exatamente o que a Missão 9 endereça. `production_mode` passa a cobrir também `ai_avatar`, `licensed_stock_video` e `hybrid` para o formato `video` (§4.2); `stories`/`carousel`/`thumbnail` permanecem `own_media` por enquanto (fora do escopo desta missão — ver [architecture.md §3.5](docs/architecture.md#35-asset-engine)). Ainda não é "opcional/configurável por campanha": o modo de produção do vídeo continua uma decisão do sistema/estratégia, não uma escolha explícita do usuário nesta missão.
5. ~~Limites numéricos exatos por plano (cota de campanhas, nº de marcas no Starter/Pro).~~ **Resolvido (Missão 6):** ver §8 — sem contador de cota separado, o limite é o `grant_plan` de créditos mensal (Starter 100 / Pro 500 / Business 1.500), 1 marca em Starter/Pro, até 5 em Business.
6. ~~Banco de vídeos públicos licenciados: qual provedor/fonte será integrado como Media Provider inicial?~~ **Resolvido (revisão 21): Pexels** — API de banco de vídeo licenciado, gratuita para uso comercial, adequada a um MVP sensível a custo (mesma filosofia de §8). Adapter implementa o contrato `media` já especificado ([architecture.md §5](docs/architecture.md#5-provider-layer-adapters-plugáveis-resolvidos-por-tier)) — trocar de fornecedor no futuro é só um novo adapter, sem mudança no Asset Engine.
7. ~~A conversa inicial de onboarding ("Conheça sua empresa") é síncrona (chat em tempo real) ou pode ser feita em etapas assíncronas (ex: e-mail com perguntas)?~~ **Resolvido (revisão técnica pré-Missão 2):** síncrona — interface de chat em tempo real, com persistência por resposta permitindo pausar/retomar a qualquer momento (nunca por e-mail em etapas). Já especificado em detalhe em [ux-design.md §4.2](docs/ux-design.md#42-conversa-com-o-consultor-onboarding-conversacional) e [architecture.md §6](docs/architecture.md#6-conversa-de-onboarding-arquitetura).
8. ~~**Persona da Ayon:** ela se apresenta sempre na primeira pessoa sem nome próprio, ou ganha um nome/identidade mais pessoal?~~ **Resolvido (revisão técnica pré-Missão 2):** "Ayon" é o nome da consultora — já usado consistentemente em primeira pessoa em todo exemplo de copy deste documento e de `ux-design.md`. Não é "sem nome": a interface pode e deve se referir a ela como Ayon (ex: cabeçalho da conversa, mensagens).
9. **Atalho de contexto por link:** vale, já no MVP, aceitar um link de site/Instagram no início da conversa "Conheça sua empresa" para a Ayon chegar com "dever de casa feito" (reduz o que precisa ser perguntado do zero)? Implica capacidade de leitura externa ainda não modelada em [docs/architecture.md](docs/architecture.md). **Ainda em aberto** — recomendação: adiar para depois da v1 da Missão 2, não bloqueia o início da implementação.
10. ~~**Fornecedor do Video Render Provider e mecanismo de legendas:** qual serviço externo de composição de vídeo (cenas + narração + legenda → MP4) é o fornecedor inicial da nova capacidade `video_render`? E as legendas são sincronizadas a partir do texto do roteiro ou de uma transcrição real do áudio narrado?~~ **Resolvido (revisão 21): Shotstack** como Video Render Provider (composição via API, timeline em JSON, suporta 9:16 e burn-in de legenda). Legendas resolvidas como consequência da escolha do Voice Provider (ElevenLabs, item 2): a API já retorna marcação de tempo por caractere junto do áudio sintetizado — usada diretamente para montar `captionCues`, sem precisar de uma capacidade de transcrição separada. O fallback de estimativa por proporção de caracteres (descrito em [architecture.md §3.5.1](docs/architecture.md#351-geração-automática-de-vídeo-★-novo-preparação-missão-9)) permanece como caminho defensivo, não o principal.
11. **★ novo (preparação Missão 9) — Precificação em créditos da geração de vídeo:** decisão explícita do dono do produto (Missão 9): geração de vídeo tem `trigger_reason` próprio em `credit_pricing` (`video_generation`), separado de `asset_generation` (texto) — mas os valores exatos por tier permanecem em aberto até serem definidos. **Não bloqueia** o início do código — a tabela `credit_pricing` aceita novas linhas sem migration de schema (mesmo padrão de `asset_generation` na Missão 7); o valor pode ser ajustado por `UPDATE` a qualquer momento antes do lançamento. Ver [database.md §7.3](docs/database.md#73-credit_pricing).
12. ~~**★ novo (preparação Missão 12) — Modelo de identidade do Super Admin, organização de testes, créditos na impersonação, limites de plano, nomenclatura de plano, tabela de auditoria administrativa, exclusão de organização, observabilidade de providers:** 8 decisões levantadas na auditoria, todas com recomendação apresentada.~~ **Resolvido (todas as 8 recomendações aceitas pelo dono do produto):** `platform_admins` como tabela dedicada (não papel de organização); organização "casa" dedicada para o(s) admin(s) testarem, separada de impersonação; impersonação nunca debita a organização visitada (bypass acompanha o ator, não a organização); limites de plano entram só como campos editáveis nesta missão, sem bloqueio real; instrumentação real de latência/custo/erro nos 4 providers existentes (sem versão "leve" derivada); chave `business` mantida no banco, rótulo livre na UI; auditoria administrativa em tabela nova (`admin_audit_logs`), `audit_logs` existente intocada; exclusão de organização é soft delete (`deleted_at`, já existente na tabela). **9 ajustes adicionais na aprovação (round 2), todos incorporados:** 2 papéis administrativos (`super_admin`/`support_admin`, matriz de capacidades em [architecture.md §15.1.1](docs/architecture.md#1511-matriz-de-capacidades)) em vez de 1 só; `plans` com conjunto de campos bem mais amplo (limites + capacidade + flags de recurso, preparando o modelo de negócio); banner de impersonação com texto exato, sem botão de fechar; `provider_call_logs` com modelo/endpoint/tokens/request ID; Feedbacks vira CRM interno (arquivar/responder internamente/resolver); Dashboard ganha MRR/ARR/conversão trial/gasto estimado/margem/providers mais usados; Organizações ganha visão de consumo/contagens/última atividade; gestão real de Providers (ativar/desativar/trocar padrão/API key sem `.env`/manutenção, só `super_admin`); bypass de créditos/limites estendido aos 2 papéis (não só `super_admin`), para não contradizer a decisão de que a organização impersonada nunca é cobrada. Detalhe completo em [architecture.md §15](docs/architecture.md#15-super-admin--plataforma-administrativa-★-missão-12). **Documentação aprovada — implementação autorizada.**

## 14. Histórico

Ver [docs/changelog.md](docs/changelog.md) para o registro de todas as mudanças de escopo, com data e motivo.
