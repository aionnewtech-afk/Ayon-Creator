# Prompts dos Especialistas — Specialist Registry

Um documento por especialista/Coordinator do Intelligence Hub (`specialists`, ver [architecture.md §4.1](../architecture.md#41-specialist-registry-especialistas-plugáveis-★-novo-revisão-10)). Esta pasta é a **referência oficial** para evoluir cada especialista de forma deliberada — separa o comportamento de IA (o quê e por quê) da implementação em código (como é resolvido em runtime).

Não substitui:
- [`docs/engine-behavior.md`](../engine-behavior.md) — comportamento das Engines como um todo (tom, princípios cross-cutting).
- O `system_prompt` em produção, na tabela `specialists` — continua sendo **dado**, nunca hardcoded. O texto aqui documentado deve ser mantido em sincronia com o que está em produção; mudar um prompt em produção sem atualizar o documento correspondente é considerado dívida de documentação.

## Especialistas documentados

| Documento | `key` | Papel |
|---|---|---|
| [marketing-strategy.md](marketing-strategy.md) | `marketing_strategy` | Posicionamento, público-alvo, canais |
| [branding.md](branding.md) | `branding` | Coerência de identidade de marca |
| [copywriting.md](copywriting.md) | `copywriting` | Mensagem central da campanha |
| [coordinator.md](coordinator.md) | `coordinator` | Consolidação das opiniões numa estratégia única |

## Quando adicionar um novo documento

Todo novo especialista adicionado ao Specialist Registry (via `INSERT` em `specialists`, nunca mudança de código — ver [architecture.md §4.1](../architecture.md#41-specialist-registry-especialistas-plugáveis-★-novo-revisão-10)) ganha um documento aqui **antes** do INSERT ir para produção, seguindo o mesmo template desta pasta.
