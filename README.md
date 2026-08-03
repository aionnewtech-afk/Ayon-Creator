# Ayon Creator

Sistema Operacional de Marketing orientado por IA — não um gerador de conteúdo pontual. Conhece a empresa do cliente (onboarding conversacional), entende o que está em alta no seu nicho, pensa a estratégia de campanha através de um painel de especialistas de IA (**Intelligence Hub**), produz um pacote de conteúdo completo (vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro, teleprompter) e aprende continuamente o que funciona — sempre devolvendo isso como sugestão para aprovação humana, nunca como mudança automática.

## Estado do projeto

**Sprint 1**, **Missão 2 — "Conheça sua empresa"** (onboarding conversacional) e **Missão 3 — Specialist Registry + primeiro Intelligence Hub funcional** implementadas e validadas ponta a ponta (Supabase + Anthropic reais) — ver [CHANGELOG.md](CHANGELOG.md) (`v0.3.0`). **Filosofia de produto consolidada** (Princípio do Consultor Permanente — ver [PRD.md §1.1](PRD.md#11-princípio-do-consultor-permanente-★-novo-revisão-7)). Painel de 3 especialistas (Marketing, Branding, Copy) + Coordinator AI resolvidos via Specialist Registry — nunca hardcoded — validados quanto a personalidade distinta, divergência real e consolidação ancorada no Brand Brain. Roadmap confirmado a partir daqui: **Missão 4 — Ensine sua Empresa para a IA** (Knowledge Base), depois Trend Engine, Billing, Asset Engine e Learning Engine, nessa ordem. Nova documentação de referência para evolução dos especialistas em [docs/prompts/](docs/prompts/).

## Estrutura

```
ayon-creator/
├── README.md              # este arquivo
├── PRD.md                 # Product Requirements Document (fonte da verdade do produto)
├── CONVENTIONS.md          # guia de engenharia (monorepo, repository pattern, etc.) — fora do fluxo de aprovação de produto
├── CHANGELOG.md            # histórico de releases de código (versionado, distinto do changelog de escopo/doc)
└── docs/
    ├── architecture.md     # arquitetura técnica
    ├── database.md         # modelo de dados (Supabase/Postgres)
    ├── flows.md             # fluxos de uso e de pipeline (nível de engine)
    ├── ux-design.md         # telas, componentes, estados, navegação, microinterações (nível de produto/UI)
    ├── engine-behavior.md   # comportamento de IA esperado de cada Core Engine (tom, princípios, não estrutura/processo)
    ├── changelog.md         # histórico de mudanças de escopo/documentação
    └── prompts/             # um documento por especialista do Specialist Registry — referência oficial para evoluí-los
```

## Princípio de linguagem

O usuário nunca vê jargão técnico. Nomes como *Brand Brain*, *Trend Engine*, *Learning Engine*, *Asset Engine* e *Knowledge Base* são módulos internos — a interface usa sempre linguagem de negócio ("Conheça sua empresa", "Ensine sua empresa para a IA", "O que está em alta", "Criar campanha", "O que funcionou"). Ver mapeamento completo em [PRD.md §2](PRD.md#2-linguagem-motores-internos-vs-produto).

## Regra de trabalho

1. Nenhuma funcionalidade é implementada sem estar documentada e **aprovada** em `PRD.md`.
2. Toda nova funcionalidade solicitada segue esta ordem:
   1. Atualizar `PRD.md`;
   2. Atualizar `docs/architecture.md`;
   3. Atualizar `docs/database.md`;
   4. Atualizar `docs/flows.md`;
   5. Atualizar `docs/ux-design.md` (telas, componentes, estados, navegação, microinterações);
   6. Registrar em `docs/changelog.md`;
   7. Só então — e somente após aprovação — iniciar código.
3. Decisões em aberto ficam explícitas em cada documento (seção "Decisões em Aberto") até serem resolvidas.
4. `docs/engine-behavior.md` é atualizado sempre que o comportamento esperado de um Core Engine muda — não é um gate de aprovação de escopo como os 5 acima, é a referência de tom/princípios para quem escreve prompts.
5. `docs/prompts/` documenta cada especialista do Specialist Registry individualmente (objetivo, responsabilidades, system prompt, entradas/saídas, exemplos, restrições, critérios de qualidade) — referência oficial para evoluí-los deliberadamente, separando comportamento de IA da implementação em código.

## Stack (planejada)

Next.js · React · TypeScript · Supabase · Tailwind CSS · OpenAI · Claude · n8n · HeyGen · ElevenLabs

## Por onde começar a ler

1. [`PRD.md`](PRD.md) — visão de produto, filosofia (§1–§2), ICP, modelo de negócio, escopo do MVP.
2. [`docs/architecture.md`](docs/architecture.md) — Core Engines, Intelligence Hub, Provider Layer por tier.
3. [`docs/database.md`](docs/database.md) — modelo de dados.
4. [`docs/flows.md`](docs/flows.md) — fluxos passo a passo, incluindo o Fluxo 10 (Intelligence Hub).
5. [`docs/ux-design.md`](docs/ux-design.md) — telas, componentes, estados, navegação e microinterações.
6. [`docs/engine-behavior.md`](docs/engine-behavior.md) — comportamento de IA esperado de cada Core Engine (tom, princípios de raciocínio) — referência para quem escreve prompts.
7. [`docs/prompts/`](docs/prompts/) — um documento por especialista do Specialist Registry.
