# Convenções de Engenharia — Ayon Creator

> Este documento **não** é um dos 5 documentos de produto (PRD.md, docs/architecture.md, docs/database.md, docs/flows.md, docs/ux-design.md) — é um guia de engenharia, versionado à parte, sem o mesmo fluxo de aprovação de escopo de produto. Mudanças aqui não exigem atualização do PRD, mas devem ser consistentes com `docs/architecture.md`.

## 1. Estrutura de monorepo

- `apps/web` — única aplicação cliente-facing. Conhece rotas, sessão, Server Actions.
- `packages/ui` — componentes de apresentação puros. **Nunca** importa Supabase, `next/navigation` ou qualquer coisa acoplada a uma rota específica. Deve poder ser usado por uma futura segunda app sem modificação.
- `packages/core` — lógica de domínio agnóstica de framework: repositories, logger, validadores, e (futuramente) Core Engines. **Nunca** importa nada de `next/*` ou de componentes React.
- `packages/types` — tipos compartilhados (schema do Supabase + tipos de domínio). Não contém lógica.

Regra simples: se o código faz uma pergunta de UI ("como isso aparece?"), vai em `ui`. Se faz uma pergunta de negócio/dados ("o que isso significa, como isso é persistido?"), vai em `core`. Se é só forma ("qual o shape disso?"), vai em `types`.

## 2. Camada de acesso a dados (Repository Pattern)

Fluxo obrigatório, sem exceção:

```
Tela (apps/web) → Server Action → Repository (packages/core) → Supabase
```

- Nenhum componente ou página em `apps/web` importa o client Supabase diretamente.
- Toda tabela tem um repository dedicado (`organization.repository.ts`, `brand.repository.ts`, `user.repository.ts`, ...) — único lugar que conhece o nome da tabela e o formato das linhas.
- Server Actions validam input e orquestram repositories; não contêm query SQL nem lógica de RLS.
- Lógica de negócio (regras, decisões) fica em `packages/core`, nunca dentro de componentes React.

## 3. Convenção de auditoria

Toda tabela nova, a menos que haja justificativa explícita em contrário no PR/migration, tem:

- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`, mantida por trigger `set_updated_at()`
- `created_by uuid references auth.users` (nullable — ações de sistema não têm ator)
- `deleted_at timestamptz` (nullable) — soft delete

Exceção: tabelas de log/evento imutável (ex.: `audit_logs`) não têm `deleted_at` nem `updated_at` — um log não é editado nem "deletado suavemente".

## 4. Soft delete

- Nunca `DELETE` de uma linha de domínio pelo código da aplicação — sempre `UPDATE ... SET deleted_at = now()`.
- RLS **não** filtra `deleted_at` (RLS decide *quem* pode ver a linha, não *se* ela está "viva"). O filtro `deleted_at is null` é responsabilidade do Repository em toda query de leitura.
- Hard delete só acontece via operação administrativa manual, fora do fluxo normal da aplicação.

## 5. Migrations

- Uma migration por mudança de schema logicamente coesa (não uma por tabela isolada, nem uma migration gigante por sprint).
- Nome: `NNNN_descricao_curta.sql`, numeração sequencial.
- Toda tabela com `organization_id` (direto ou via `brand_id`) tem RLS habilitado na mesma migration que a cria — nunca em uma migration separada posterior.
- **`INSERT ... RETURNING` (o que `.insert().select()` do supabase-js sempre faz) exige que a linha também passe pela policy de SELECT, não só pela de INSERT/WITH CHECK.** Se a policy de SELECT depende de um estado que só existe *depois* do insert (ex.: virar membro de uma organização que acabou de ser criada), o insert falha com erro de RLS mesmo que o WITH CHECK esteja correto. Ao desenhar uma policy de SELECT para uma tabela que também recebe inserts "de bootstrap" (o próprio criador), inclua sempre uma cláusula alternativa tipo `or created_by = auth.uid()` / `or actor_user_id = auth.uid()`.

## 6. Feature flags

- `feature_flags` é global nesta fase (sem override por organização) — ver decisão em aberto em `docs/database.md` §10.6.
- Leitura via `packages/core` (nunca hardcoded em componente); default seguro é sempre `enabled = false` até decisão explícita.

## 7. Commits

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
- Escopo da Sprint no corpo do commit quando relevante (ex.: `feat(sprint-1): estrutura de autenticação`).

## 8. Nomenclatura

- Arquivos: `kebab-case` (`brand.repository.ts`, `empty-state.tsx`).
- Componentes React: `PascalCase` (`EmptyState`, `Sidebar`).
- Tabelas/colunas: `snake_case`, sempre no singular para colunas e no plural para tabelas.

## 9. TypeScript

- `strict: true` em todos os `tsconfig.json` do monorepo, sem exceção por pacote.
- Nenhum `any` implícito; `unknown` + narrowing quando o tipo de fato não é conhecido.

## 10. Histórico

Ver [docs/changelog.md](docs/changelog.md) — mudanças de convenção relevantes para o escopo de produto também são registradas lá.
