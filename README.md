# Ayon Creator

Sistema Operacional de Marketing orientado por IA — não um gerador de conteúdo pontual. Conhece a empresa do cliente (onboarding conversacional), entende o que está em alta no seu nicho, pensa a estratégia de campanha através de um painel de especialistas de IA (**Intelligence Hub**), produz um pacote de conteúdo completo (vídeo, legenda, stories, carrossel, thumbnail, blog, email, roteiro, teleprompter) e aprende continuamente o que funciona — sempre devolvendo isso como sugestão para aprovação humana, nunca como mudança automática.

## Estado do projeto

**Fase atual: documentação.** Nenhuma linha de código de produto foi escrita ainda — este repositório contém apenas a especificação do produto, que deve ser lida e aprovada antes de qualquer implementação.

## Estrutura

```
ayon-creator/
├── README.md              # este arquivo
├── PRD.md                 # Product Requirements Document (fonte da verdade do produto)
├── CONVENTIONS.md          # guia de engenharia (monorepo, repository pattern, etc.) — fora do fluxo de aprovação de produto
└── docs/
    ├── architecture.md     # arquitetura técnica
    ├── database.md         # modelo de dados (Supabase/Postgres)
    ├── flows.md             # fluxos de uso e de pipeline (nível de engine)
    ├── ux-design.md         # telas, componentes, estados, navegação, microinterações (nível de produto/UI)
    └── changelog.md         # histórico de mudanças de escopo/documentação
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

## Stack (planejada)

Next.js · React · TypeScript · Supabase · Tailwind CSS · OpenAI · Claude · n8n · HeyGen · ElevenLabs

## Por onde começar a ler

1. [`PRD.md`](PRD.md) — visão de produto, filosofia (§1–§2), ICP, modelo de negócio, escopo do MVP.
2. [`docs/architecture.md`](docs/architecture.md) — Core Engines, Intelligence Hub, Provider Layer por tier.
3. [`docs/database.md`](docs/database.md) — modelo de dados.
4. [`docs/flows.md`](docs/flows.md) — fluxos passo a passo, incluindo o Fluxo 10 (Intelligence Hub).
5. [`docs/ux-design.md`](docs/ux-design.md) — telas, componentes, estados, navegação e microinterações.
