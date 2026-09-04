-- ★ Achado real (pedido direto do usuário — "no formato Stories, melhorar o
-- controle de elementos... marca menor por padrão, permitir alterar tamanho
-- e movimentar; permitir editar o texto direto no editor, aumentar/diminuir
-- fonte, movimentar"): até aqui a composição de foto (stories/carousel/
-- thumbnail) era 100% server-side com layout fixo (título/subheadline/CTA
-- vindos só do `visual_brief` gerado por LLM, logo sempre no mesmo tamanho/
-- canto) — nenhum controle manual existia. `visual_overrides` guarda ajustes
-- por PEÇA (não por campanha, ao contrário de `campaigns.visual_brief` —
-- stories/carousel/thumbnail têm proporções diferentes, cada um pode
-- precisar de um ajuste diferente), lidos por `composePhotoContentPiece`
-- (packages/core/src/asset-engine/photo-pipeline-compose.ts) na próxima
-- geração.
alter table public.content_pieces
  add column visual_overrides jsonb;
