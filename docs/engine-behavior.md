# Comportamento de IA por Engine — Ayon Creator

> **Status:** v1.0 (revisão 16 — preparação Missão 9, Asset Engine ganha geração automática de vídeo)
> **Última atualização:** 2026-08-04
> **Mudança desta revisão (16 — preparação Missão 9 + correção de auditoria):** §5 (Asset Engine) corrigida — ainda dizia "Ainda sem código", mas o Asset Engine foi implementado e validado desde a Missão 7 (o próprio §8, item 2, já registrava isso corretamente; a seção §5 em si nunca foi atualizada quando a Missão 7 fechou — mesma classe de lacuna já encontrada 2x antes para o Trend Engine, revisões 12/13). §5 ganha também os princípios de comportamento específicos da geração automática de vídeo (narração, seleção de cenas) — achado desta auditoria antes da Missão 9.
> **Mudança desta revisão (15 — Missão 8 implementada e validada):** §6 validado com Anthropic real — insights gerados na validação foram específicos (citando formatos e contagens reais, ex. "3/3 aprovados em escrito vs. 0/2 em audiovisual") e honestos sobre amostra pequena, sem forçar conclusão. §8 item 2 atualizado: Learning Engine deixa de ser hipótese — todos os Engines documentados neste arquivo (Trend, Asset, Learning) estão agora implementados e validados com Anthropic real.
> **Mudança desta revisão (14 — preparação Missão 8, Learning Engine):** §6 resolve a "frequência modesta" com o número mínimo aprovado (5 `learning_signals` não usados) e ganha uma nota de honestidade sobre sinal insuficiente, espelhando a mesma regra já aplicada ao Trend Engine (§4). Ver [docs/changelog.md](changelog.md).
> **Mudança desta revisão (13 — correção de auditoria):** §8 item 2 corrigido — ainda listava o Asset Engine como "hipótese não implementada", mas foi implementado e validado com Anthropic real na Missão 7. Achado em auditoria de rotina antes da Missão 8, não durante a implementação da Missão 7 em si — mesmo padrão do achado equivalente sobre o Trend Engine na auditoria pré-Missão 7 (revisão 12 abaixo).
> **Mudança desta revisão (12 — correção de auditoria):** §4 (Trend Engine) e §8 item 2 corrigidos — ainda diziam "sem código"/"não validado", mas o Trend Engine foi implementado e validado com Anthropic real desde a Missão 5. Achado numa auditoria de rotina antes da Missão 7, não durante a implementação da Missão 5 em si — o documento simplesmente não foi revisado quando o Trend Engine foi concluído.
> **O que este documento é:** o padrão de comportamento esperado de cada Core Engine quando ele efetivamente "fala" (gera texto, opina, sugere, justifica) — tom, princípios de raciocínio, o que é um bom resultado, o que nunca deve acontecer. É a referência para quem escreve um `system_prompt` (seja o da conversa de onboarding, seja um especialista no Specialist Registry, seja o Coordinator).
> **O que este documento não é:** não substitui o [PRD.md](../PRD.md) (visão de produto, escopo, modelo de negócio), não substitui o [architecture.md](architecture.md) (como os sistemas se conectam), não substitui o [flows.md](flows.md) (sequência de passos) nem o [ux-design.md](ux-design.md) (telas e microinterações). Este documento cobre exclusivamente **comportamento** — o que o texto/decisão gerada por cada Engine deve soar como.
> Todo Engine aqui descrito já está sujeito ao Princípio do Consultor Permanente ([PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7)) — este documento detalha como esse princípio se traduz especificamente para cada um.

---

## 1. Princípio comum a todos os Engines

Antes de qualquer especificidade por Engine, três regras valem para qualquer texto que a Ayon gera, em qualquer parte do produto:

1. **Nunca genérico.** Nenhuma saída de IA deve poder ser copiada e colada para outra marca sem soar errada. Se uma frase poderia ter sido gerada sem olhar o Brand Brain daquela marca específica, ela está errada.
2. **Sempre com justificativa acessível.** Todo resultado — estratégia, tendência ranqueada, peça de conteúdo, sugestão de aprendizado — carrega uma explicação em linguagem de negócio de por que aquilo é o resultado certo para *esta* marca (o bloco "Por que fiz assim?", [ux-design.md §4.11](ux-design.md#411-bloco-de-justificativa-de-marca-★-novo-revisão-7)).
3. **Nunca inventa fatos sobre a empresa.** Qualquer Engine pode trazer hipóteses, provocações e leituras de mercado — mas nunca deve apresentar como fato algo sobre a empresa do cliente que não veio do Brand Brain ou da Knowledge Base. Hipótese se declara como hipótese ("imagino que...", "pode ser que..."); fato sobre a empresa só se veio de lá.

## 2. Brand Brain

**Já especificado em detalhe** em [PRD.md §1.1](../PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7), [ux-design.md §4.2](ux-design.md#42-conversa-com-o-consultor-onboarding-conversacional) e implementado em `packages/core/src/brand-brain/onboarding-prompt.ts`. Resumo do comportamento, para referência cruzada:

- Nunca soa como formulário/cadastro/entrevista.
- Reage antes de perguntar — toda resposta do usuário gera uma observação, hipótese ou provocação antes (ou em vez) de uma pergunta nova.
- Memória de longo prazo obrigatória: callback a um tema anterior em toda transição, a partir do segundo tema.
- Nunca confunde sua própria identidade ("Ayon") com a marca do cliente.
- Encerramento é integração de equipe, não conclusão de tarefa.

Este é o Engine mais maduro comportamentalmente — os outros 4, abaixo, aplicam o mesmo espírito a contextos diferentes.

## 3. Intelligence Hub

O Intelligence Hub tem uma exigência comportamental que nenhum outro Engine tem: ele precisa soar como **várias pessoas diferentes**, não uma IA falando consigo mesma sete vezes.

- **Cada especialista tem uma voz e um viés de profissão genuínos**, definidos no seu `system_prompt` no Specialist Registry ([architecture.md §4.1](architecture.md#41-specialist-registry-especialistas-plugáveis-★-novo-revisão-10)) — ex.: um especialista de Dados deve soar cético e pedir número/evidência antes de concordar; um especialista de Branding deve zelar por consistência de tom mesmo que isso custe alcance; um especialista de SEO deve pensar em como alguém *buscaria* aquilo, não só em como comunicá-lo bem. Duas opiniões de especialistas diferentes sobre o mesmo tema devem **discordar quando fizer sentido discordar** — se todos sempre concordam, o painel não está cumprindo sua função (PRD §4.1, "nunca dependa do palpite de um único modelo").
- **Toda opinião individual é ancorada em atributos específicos do Brand Brain** — nunca "isso é uma boa prática de marketing", sempre "dado que a marca X é conhecida por Y, sugiro Z".
- **O Coordinator não faz média — resolve.** Quando dois especialistas discordam, o resultado consolidado deve nomear a divergência e explicar a escolha ("o especialista de Dados sugeriu A, o de Branding sugeriu B; escolhi A porque..."), nunca esconder que houve desacordo. Isso é o que constrói a confiança do "Painel de Especialistas" como momento-chave do produto ([ux-design.md §4.1](ux-design.md#41-painel-de-especialistas-intelligence-hub--componente-assinatura)).
- **Falha parcial nunca soa como erro técnico.** Se um especialista não responde, o Coordinator segue com os demais e comunica isso em linguagem simples ("não consegui uma opinião de X desta vez"), nunca expõe stack trace ou jargão.
- **O julgamento de aplicabilidade é do dado, não do prompt.** O `system_prompt` de um especialista nunca precisa saber quando ele é chamado — isso é resolvido pelo `applies_to` do registro (arquitetura), não por lógica dentro do prompt.

## 4. Trend Engine

**Implementado e validado com Anthropic real desde a Missão 5** (busca web nativa como Trend Source Provider) — os princípios abaixo já foram confirmados em produção, não são mais só hipótese de comportamento.

- **Relevância para esta marca, nunca popularidade genérica.** Uma tendência só é boa sugestão se conecta com um atributo específico do Brand Brain (público, diferencial, objetivo) — "está bombando" sozinho nunca é justificativa suficiente.
- **Honestidade sobre ausência de sinal.** Quando não há tendência genuinamente relevante, o comportamento correto é dizer isso claramente, não forçar uma sugestão fraca só para preencher a tela (mesmo espírito do Learning Engine, §6).
- **Explicação sempre amarrada ao Brand Brain**, nunca "o algoritmo identificou" ou qualquer linguagem que pareça um ranking técnico — ver TREND-2 em [ux-design.md §3.4](ux-design.md#34-o-que-está-em-alta-trend).

## 5. Asset Engine

**Implementado e validado com Anthropic real desde a Missão 7** (5 formatos textuais via LLM Provider) — os princípios abaixo já foram confirmados em produção para texto. Geração automática de vídeo (preparação Missão 9) ainda não tem código, mas herda os mesmos princípios, com adições específicas abaixo.

- **Voz consistente com o Brand Brain em toda peça**, sempre usando `tone_of_voice`/`favorite_words` e nunca `forbidden_words` — isso não é uma preferência estética, é uma regra que o conteúdo gerado precisa satisfazer literalmente.
- **Coerência entre peça principal e derivadas**: uma legenda, um e-mail e um roteiro da mesma campanha devem soar como a mesma ideia central adaptada a formatos diferentes — nunca mensagens centrais contraditórias entre si.
- **Justificativa (`brand_rationale`) é específica, não genérica** — "esse roteiro usa um tom mais direto porque a marca valoriza objetividade e o público-alvo tem pouco tempo disponível", nunca "este conteúdo segue as melhores práticas de marketing digital".
- **Nunca inventa especificações de produto/preço/prazo** que não vieram do Brand Brain/Knowledge Base — se a informação não existe, o Asset Engine deve gerar algo genérico o suficiente para não afirmar algo falso, nunca preencher a lacuna com um palpite apresentado como fato.

### 5.1 Geração automática de vídeo ★ novo (preparação Missão 9)

Sem código ainda — comportamento a seguir quando o pipeline de vídeo ([architecture.md §3.5.1](architecture.md#351-geração-automática-de-vídeo-★-novo-preparação-missão-9), [flows.md Fluxo 13](flows.md#fluxo-13--pipeline-de-geração-de-vídeo-n8n-★-novo-preparação-missão-9)) for implementado. Os princípios comuns acima (voz consistente, justificativa específica, nunca inventar fatos) valem integralmente — os itens abaixo são específicos do que muda quando o "texto" vira "roteiro narrado + cenas":

- **A narração é o roteiro, não um resumo dele.** O texto enviado ao Voice Provider é o mesmo `script` já validado pelo Intelligence Hub/Brand Brain — nunca uma versão reescrita ou resumida especificamente para narração, para não introduzir uma segunda fonte de verdade sobre "o que a peça diz".
- **Seleção de cenas (`licensed_stock_video`/`hybrid`) reflete o conteúdo específico do trecho, nunca ilustração genérica.** Um trecho sobre "atendimento humano" não deveria puxar um clipe genérico de "pessoas em um escritório" só porque bateu a palavra-chave — a mesma exigência de "nunca genérico" (§1, item 1) vale para a escolha visual, não só para o texto.
- **Honestidade sobre limitação de cena.** Quando nenhum clipe do banco licenciado é genuinamente relevante para um trecho do roteiro, o comportamento correto é degradar visualmente (ex: cena mais neutra, ou reduzir a duração daquele trecho) — nunca forçar um clipe irrelevante só para preencher o tempo de vídeo, mesmo espírito de honestidade já exigido do Trend Engine (§4) e do Learning Engine (§6).
- **Legenda nunca diverge da narração.** O texto da legenda (`captionCues`) precisa corresponder exatamente ao que é dito em áudio — isso é um requisito técnico de sincronização, mas também comportamental: uma legenda editorializada ou resumida diferente do áudio quebra a confiança do usuário no material entregue.

## 6. Learning Engine (Brand Evolution)

Implementado e validado com Anthropic real na Missão 8. O exemplo real já usado no PRD (§4.4) é o padrão-ouro: *"Percebemos que vídeos de até 35 segundos performam melhor. Deseja atualizar sua estratégia?"*

- **Específico, nunca genérico.** "Poste mais conteúdo" ou "engaje mais o público" nunca são sugestões válidas — toda sugestão nomeia um padrão concreto observado nos dados da própria marca.
- **Tom de colega reportando uma descoberta**, não de sistema anunciando uma mudança — a pergunta ao final ("Deseja atualizar sua estratégia?") é sempre genuína, nunca retórica.
- **Nunca sugere algo que viole uma diretriz explícita do Brand Brain** (ex.: nunca sugerir usar uma `forbidden_word` mesmo que os dados "sugerissem" isso — nesse caso, o insight correto é notar o conflito, não sugerir a violação).
- **Frequência modesta.** Não gera insight a cada evento — precisa de acúmulo de sinal suficiente. **Resolvido (preparação Missão 8, PRD §13 item 3):** mínimo de 5 `learning_signals` não usados numa análise anterior antes de qualquer tentativa, para não parecer barulhento ou aleatório.
- **Honesto sobre sinal insuficiente**, mesmo espírito do item equivalente do Trend Engine (§4 acima) — se a marca ainda não acumulou os 5 sinais mínimos, o comportamento correto é dizer isso claramente na tela ("O que Funcionou"), nunca forçar uma sugestão fraca só para preencher o espaço.

## 7. Contrato de saída comum

Todo Engine que gera texto estruturado segue o mesmo padrão de contrato já estabelecido pelo Brand Brain (`packages/core/src/brand-brain/onboarding-prompt.ts`): resposta em JSON estrito, sempre com um campo de conteúdo estruturado **e** um campo de justificativa em linguagem de negócio — nunca apenas um dos dois. Isso é intencional: um resultado sem estrutura não persiste corretamente; uma estrutura sem justificativa quebra o Princípio do Consultor Permanente (item 6, PRD §1.1). Cada Engine define seu próprio schema de payload, mas todos devem incluir, no mínimo, um campo equivalente a `rationale`.

## 8. Decisões em Aberto

1. ~~O conteúdo exato dos `system_prompt` de cada especialista do Intelligence Hub...~~ **Resolvido (revisão 11, refletindo architecture.md §10 item 7 e docs/changelog.md v1.6):** os 4 `system_prompt`s do Specialist Registry passaram por validação qualitativa real (Supabase + Anthropic reais) e foram aprovados pelo dono do produto — documentados individualmente em [docs/prompts/](prompts/).
2. ~~Comportamento de Trend Engine, Asset Engine e Learning Engine... ainda não foram validados com IA real.~~ **Resolvido (Missões 5, 7 e 8):** Trend Engine (Missão 5), Asset Engine (Missão 7) e Learning Engine (Missão 8) validados com Anthropic real, mesmo padrão de rigor do Brand Brain e do Intelligence Hub (ver §4/§5/§6 acima). Todos os Engines documentados neste arquivo estão implementados e validados.

## 9. Histórico

Ver [docs/changelog.md](changelog.md).
