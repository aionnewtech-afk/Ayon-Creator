-- ★ Achado real (pedido direto do usuário — testou uma campanha real com um
-- briefing detalhado, 6 destinos nomeados + gancho + fechamento, e o roteiro
-- final saiu genérico, citando só ~4 dos 6 destinos, em prosa de venda): o
-- objetivo bruto digitado pelo usuário NUNCA era persistido em lugar nenhum
-- — só sobrevivia até o painel de especialistas rodar, que o resume em
-- `strategy_summary.consolidated_strategy` (3-5 frases objetivas, por design
-- do Coordinator). `generateTextPiece` (script final) só recebia essa versão
-- já resumida — qualquer lista de itens específicos do briefing original
-- (destinos, produtos, dicas) se perdia nesse resumo antes de chegar no
-- roteiro. `objective`/`research_notes` guardam as fontes completas pra
-- `generateTextPiece` poder citar itens concretos de verdade, não só o
-- resumo.
--
-- `content_style` — pedido direto do usuário — "queria incluir a opção de
-- criar campanha com cunho mais comercial - ou criar conteúdo numa pegada
-- mais institucional, com dicas, informações": escolha explícita na criação
-- da campanha, influencia o tom do painel de especialistas e do roteiro
-- final (packages/core/src/intelligence-hub/intelligence-hub-prompts.ts,
-- packages/core/src/asset-engine/asset-generation-prompts.ts).
alter table public.campaigns
  add column objective text,
  add column content_style text not null default 'comercial' check (content_style in ('comercial', 'institucional')),
  add column research_notes text;
